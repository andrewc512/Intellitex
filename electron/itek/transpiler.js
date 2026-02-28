/**
 * .itek transpiler — converts a parsed document AST into a LaTeX string.
 *
 * Uses a Jake's-Resume–style template with clean ATS-friendly formatting.
 * Supports parameterized spacing for dynamic single-page fitting.
 */

// ── Helpers ──────────────────────────────────────────────────────────────────

function escapeLatex(text) {
  if (typeof text !== "string") return String(text);
  return text.replace(/[\\&%$#_{}~^]/g, (m) => {
    switch (m) {
      case "\\": return "\\textbackslash{}";
      case "~":  return "\\textasciitilde{}";
      case "^":  return "\\textasciicircum{}";
      default:   return "\\" + m;
    }
  });
}

function fieldVal(field) {
  if (!field) return "";
  if (typeof field === "object" && field.url) return field.text;
  return String(field);
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function stripProtocol(url) {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

function formatPhone(raw) {
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return String(raw);
}

function fmtPt(n) {
  return String(Math.round(n * 10) / 10);
}

function fmtIn(n) {
  return String(Math.round(n * 100) / 100);
}

// ── Spacing configuration ────────────────────────────────────────────────────

const DEFAULT_SPACING = {
  sectionBefore: -6,
  sectionAfter: -6,
  // Space before each company / institution heading (ACM, UCSB, IntelliTex, etc).
  // Small positive default so experience/company headings get similar breathing
  // room to project headings, even before dynamic spacing kicks in.
  subheadingBefore: 1,
  // Space after the two-line subheading block (before bullets).
  subheadingAfter: -7,
  // Extra gap between the company line and the role/date line inside the
  // subheading tabular. Slightly tighter than LaTeX default, but still leaves
  // visible air around the job title.
  subheadingRowGap: -1.5,
  itemAfter: -2,
  listEndAfter: -6,
  projectAfter: -7,
  headerAfter: -1,
  topMargin: -0.6,
  textheight: 1.15,
};

const CONDENSE_LIMITS = {
  sectionBefore: -10,
  sectionAfter: -11,
  // When we really have to squeeze, this can go slightly negative to pull
  // entries closer together, but only after less important gaps have been used.
  subheadingBefore: -4,
  subheadingAfter: -13,
  subheadingRowGap: -6,
  itemAfter: -6,
  listEndAfter: -11,
  projectAfter: -13,
  headerAfter: -4,
  topMargin: -1.0,
  textheight: 1.6,
};

const EXPAND_LIMITS = {
  sectionBefore: -1,
  sectionAfter: -1,
  subheadingBefore: 3,
  subheadingAfter: -3,
  subheadingRowGap: 0,
  itemAfter: 0,
  listEndAfter: -1,
  projectAfter: -3,
  headerAfter: 6,
  topMargin: -0.5,
  textheight: 1.0,
};

// Keys whose whitespace should be preserved longer when condensing.
// Value is a power-curve exponent: 1 = linear (normal), higher = more
// resistant. At scale 1.0 every key still reaches its full condense limit,
// but at moderate scales these keys stay much closer to their defaults.
const CONDENSE_PRESERVE = {
  subheadingBefore: 3,
};

/**
 * Calculate spacing config from a continuous scale.
 * scale  0  = default
 * scale >0  = condense (up to +1 = maximum tightening)
 * scale <0  = expand   (down to -1 = maximum loosening)
 *
 * Most parameters interpolate linearly. Keys listed in CONDENSE_PRESERVE use a
 * power curve so they resist condensing and only shrink significantly at high
 * scale values — preserving visually important whitespace (e.g. the gap above
 * subheadings) for as long as possible.
 */
function calculateSpacing(scale) {
  if (scale === 0) return { ...DEFAULT_SPACING };

  const target = scale > 0 ? CONDENSE_LIMITS : EXPAND_LIMITS;
  const t = Math.min(1, Math.abs(scale));

  const result = {};
  for (const key of Object.keys(DEFAULT_SPACING)) {
    const ease =
      scale > 0 && CONDENSE_PRESERVE[key]
        ? Math.pow(t, CONDENSE_PRESERVE[key])
        : t;
    result[key] =
      DEFAULT_SPACING[key] + ease * (target[key] - DEFAULT_SPACING[key]);
  }
  return result;
}

/**
 * Count the number of each spacing-relevant element in the document AST.
 * Used to estimate how much vertical space can be recovered or added.
 */
function countSpacingPoints(doc) {
  let sections = 0;
  let subheadings = 0;
  let projectHeadings = 0;
  let bullets = 0;
  let bulletLists = 0;

  for (const section of doc.sections) {
    if (section.type === "socials") continue;
    sections++;

    switch (section.type) {
      case "education": {
        const entries = section.entries.length > 0
          ? section.entries
          : [{ fields: section.fields, bullets: [] }];

        for (const entry of entries) {
          subheadings++;
          const f = entry.fields || {};
          if (f.courses || f.coursework) {
            bullets++;
            bulletLists++;
          }
        }
        break;
      }

      case "skills":
        break;

      case "projects":
        for (const entry of section.entries) {
          projectHeadings++;
          if (entry.bullets && entry.bullets.length) {
            bullets += entry.bullets.length;
            bulletLists++;
          }
        }
        break;

      default:
        for (const entry of section.entries) {
          subheadings++;
          if (entry.bullets && entry.bullets.length) {
            bullets += entry.bullets.length;
            bulletLists++;
          }
        }
        break;
    }
  }

  return { sections, subheadings, projectHeadings, bullets, bulletLists };
}

// ── Preamble ─────────────────────────────────────────────────────────────────

function preamble(options = {}) {
  const sp = options.spacing || DEFAULT_SPACING;
  const measure = options.measure || false;

  const lines = [
    "\\documentclass[letterpaper,11pt]{article}",
    "",
    "\\usepackage[utf8]{inputenc}",
    "\\usepackage[T1]{fontenc}",
    "\\usepackage{lmodern}",
    "\\usepackage[empty]{fullpage}",
    "\\usepackage{titlesec}",
    "\\usepackage{enumitem}",
    "\\usepackage[hidelinks]{hyperref}",
    "\\usepackage{fancyhdr}",
    "\\usepackage{tabularx}",
    "\\usepackage{xcolor}",
    "",
    "\\pagestyle{fancy}",
    "\\fancyhf{}",
    "\\fancyfoot{}",
    "\\renewcommand{\\headrulewidth}{0pt}",
    "\\renewcommand{\\footrulewidth}{0pt}",
    "",
    "\\addtolength{\\oddsidemargin}{-0.6in}",
    "\\addtolength{\\evensidemargin}{-0.6in}",
    "\\addtolength{\\textwidth}{1.2in}",
    `\\addtolength{\\topmargin}{${fmtIn(sp.topMargin)}in}`,
    `\\addtolength{\\textheight}{${fmtIn(sp.textheight)}in}`,
    "",
    "\\urlstyle{same}",
    "\\raggedbottom",
    "\\raggedright",
    "\\setlength{\\tabcolsep}{0in}",
    "",
    `\\titleformat{\\section}{\\vspace{${fmtPt(sp.sectionBefore)}pt}\\scshape\\raggedright\\large\\bfseries}{}{0em}{}[\\color{black}\\titlerule\\vspace{${fmtPt(sp.sectionAfter)}pt}]`,
    "",
    "% ── Resume commands ──",
    `\\newcommand{\\resumeItem}[1]{\\item\\small{#1 \\vspace{${fmtPt(sp.itemAfter)}pt}}}`,
    "\\newcommand{\\resumeSubheading}[4]{",
    `  \\vspace{${fmtPt(sp.subheadingBefore)}pt}\\item`,
    "    \\begin{tabular*}{0.97\\textwidth}[t]{l@{\\extracolsep{\\fill}}r}",
    `      \\textbf{#1} & #2 \\\\[${fmtPt(sp.subheadingRowGap)}pt]`,
    "      \\textit{\\small#3} & \\textit{\\small #4} \\\\",
    `    \\end{tabular*}\\vspace{${fmtPt(sp.subheadingAfter)}pt}`,
    "}",
    "\\newcommand{\\resumeExpSubheading}[4]{",
    `  \\vspace{${fmtPt(sp.subheadingBefore)}pt}\\item`,
    "    \\begin{tabular*}{0.97\\textwidth}[t]{l@{\\extracolsep{\\fill}}r}",
    `      \\textbf{#1} & \\textbf{#2} \\\\[${fmtPt(sp.subheadingRowGap)}pt]`,
    "      \\textit{\\small#3} & \\textit{\\small #4} \\\\",
    `    \\end{tabular*}\\vspace{${fmtPt(sp.subheadingAfter)}pt}`,
    "}",
    "\\newcommand{\\resumeProjectHeading}[2]{",
    "    \\item",
    "    \\begin{tabular*}{0.97\\textwidth}{l@{\\extracolsep{\\fill}}r}",
    "      \\small#1 & #2 \\\\",
    `    \\end{tabular*}\\vspace{${fmtPt(sp.projectAfter)}pt}`,
    "}",
    "\\newcommand{\\resumeSubHeadingListStart}{\\begin{itemize}[leftmargin=0.15in, label={}]}",
    "\\newcommand{\\resumeSubHeadingListEnd}{\\end{itemize}}",
    "\\newcommand{\\resumeItemListStart}{\\begin{itemize}[label=$\\bullet$]}",
    `\\newcommand{\\resumeItemListEnd}{\\end{itemize}\\vspace{${fmtPt(sp.listEndAfter)}pt}}`,
  ];

  if (measure) {
    lines.push("");
    lines.push("\\makeatletter");
    lines.push("\\AtEndDocument{%");
    lines.push("  \\typeout{ITEK_PAGETOTAL: \\the\\pagetotal}%");
    lines.push("  \\typeout{ITEK_TEXTHEIGHT: \\the\\textheight}%");
    lines.push("  \\typeout{ITEK_PAGES: \\the\\value{page}}%");
    lines.push("}");
    lines.push("\\makeatother");
  }

  return lines;
}

// ── Header (name + socials) ──────────────────────────────────────────────────

function renderHeader(doc, options = {}) {
  const sp = options.spacing || DEFAULT_SPACING;
  const lines = [];
  const socials = doc.sections.find((s) => s.type === "socials");

  lines.push("\\begin{center}");
  lines.push(
    `  \\textbf{\\Huge \\scshape ${escapeLatex(doc.name)}} \\\\ \\vspace{${fmtPt(sp.headerAfter)}pt}`
  );

  if (socials) {
    const f = socials.fields;
    const parts = [];

    if (f.number) {
      parts.push(`\\small ${escapeLatex(formatPhone(fieldVal(f.number)))}`);
    }
    if (f.email) {
      const email = fieldVal(f.email);
      const url = typeof f.email === "object" ? f.email.url : email;
      parts.push(`\\href{mailto:${url}}{\\underline{${escapeLatex(email)}}}`);
    }
    for (const key of ["linkedin", "github", "website", "portfolio"]) {
      if (f[key]) {
        const url = typeof f[key] === "object" ? f[key].url : f[key];
        parts.push(
          `\\href{${url}}{\\underline{${escapeLatex(stripProtocol(url))}}}`
        );
      }
    }

    if (parts.length) lines.push(`  ${parts.join(" $|$ ")}`);
  }

  lines.push("\\end{center}");
  return lines;
}

// ── Section renderers ────────────────────────────────────────────────────────

function renderEducation(section) {
  const lines = [];
  lines.push("\\section{EDUCATION}");
  lines.push("\\resumeSubHeadingListStart");

  const renderEntry = (name, f) => {
    const school = escapeLatex(name);
    const loc = escapeLatex(fieldVal(f.loc || f.location || ""));
    const deg = fieldVal(f.degree || "");
    const gpa = fieldVal(f.gpa || "");
    const degree = gpa ? `${deg} - GPA: ${gpa}` : deg;
    const rawGrad = escapeLatex(fieldVal(f.grad || f.graduation || ""));
    const grad = rawGrad ? `Expected Graduation: ${rawGrad}` : "";

    lines.push("  \\resumeSubheading");
    lines.push(`    {${school}}{\\textbf{${loc}}}`);
    lines.push(`    {${escapeLatex(degree)}}{${grad}}`);

    const courses = fieldVal(f.courses || f.coursework || "");
    if (courses) {
      lines.push("  \\resumeItemListStart");
      lines.push(
        `    \\resumeItem{\\textbf{Relevant Coursework:} ${escapeLatex(courses)}}`
      );
      lines.push("  \\resumeItemListEnd");
    }
  };

  if (section.entries.length > 0) {
    for (const entry of section.entries) renderEntry(entry.name, entry.fields);
  } else {
    renderEntry(fieldVal(section.fields.school || ""), section.fields);
  }

  lines.push("\\resumeSubHeadingListEnd");
  return lines;
}

function renderExperience(section) {
  const lines = [];
  const title =
    section.type === "experience"
      ? "EXPERIENCE"
      : section.type === "leadership"
      ? "LEADERSHIP"
      : escapeLatex(capitalize(section.type));
  lines.push(`\\section{${title}}`);
  lines.push("\\resumeSubHeadingListStart");

  for (const entry of section.entries) {
    const f = entry.fields;
    const name = escapeLatex(entry.name);
    const loc = escapeLatex(fieldVal(f.loc || f.location || ""));
    const role = escapeLatex(fieldVal(f.role || f.title || ""));
    const date = escapeLatex(fieldVal(f.date || ""));

    lines.push("  \\resumeExpSubheading");
    lines.push(`    {${name}}{${date}}`);
    lines.push(`    {${role}}{${loc}}`);

    if (entry.bullets.length) {
      lines.push("  \\resumeItemListStart");
      for (const b of entry.bullets) {
        lines.push(`    \\resumeItem{${escapeLatex(b)}}`);
      }
      lines.push("  \\resumeItemListEnd");
    }
  }

  lines.push("\\resumeSubHeadingListEnd");
  return lines;
}

function renderSkills(section) {
  const lines = [];
  lines.push("\\section{TECHNICAL SKILLS}");
  lines.push("\\begin{itemize}[leftmargin=0.15in, label={}]");
  lines.push("  \\small{\\item{");

  const entries = Object.entries(section.fields);
  entries.forEach(([key, value], i) => {
    const val = escapeLatex(fieldVal(value));
    const suffix = i < entries.length - 1 ? " \\\\" : "";
    lines.push(
      `    \\textbf{${escapeLatex(capitalize(key))}}{: ${val}}${suffix}`
    );
  });

  lines.push("  }}");
  lines.push("\\end{itemize}");
  return lines;
}

function renderProjects(section) {
  const lines = [];
  const title =
    section.type === "projects"
      ? "PROJECTS"
      : escapeLatex(capitalize(section.type));
  lines.push(`\\section{${title}}`);
  lines.push("\\resumeSubHeadingListStart");

  for (const entry of section.entries) {
    const f = entry.fields;
    const name = escapeLatex(entry.name);
    const stack = fieldVal(f.stack || f.technologies || f.tech || "");
    const date = escapeLatex(fieldVal(f.date || ""));

    if (stack) {
      lines.push("  \\resumeProjectHeading");
      lines.push(
        `    {\\textbf{${name}} $|$ \\emph{${escapeLatex(stack)}}}{\\textbf{${date}}}`
      );
    } else {
      lines.push("  \\resumeProjectHeading");
      lines.push(`    {\\textbf{${name}}}{\\textbf{${date}}}`);
    }

    if (entry.bullets.length) {
      lines.push("  \\resumeItemListStart");
      for (const b of entry.bullets) {
        lines.push(`    \\resumeItem{${escapeLatex(b)}}`);
      }
      lines.push("  \\resumeItemListEnd");
    }
  }

  lines.push("\\resumeSubHeadingListEnd");
  return lines;
}

// ── Main transpile ───────────────────────────────────────────────────────────

function transpile(doc, options = {}) {
  const out = [];

  out.push(...preamble(options));
  out.push("");
  out.push("\\begin{document}");
  out.push("");

  out.push(...renderHeader(doc, options));
  out.push("");

  for (const section of doc.sections) {
    if (section.type === "socials") continue;

    switch (section.type) {
      case "education":
        out.push(...renderEducation(section));
        break;
      case "experience":
      case "leadership":
        out.push(...renderExperience(section));
        break;
      case "skills":
        out.push(...renderSkills(section));
        break;
      case "projects":
        out.push(...renderProjects(section));
        break;
      default:
        if (section.entries.length) {
          out.push(...renderExperience(section));
        }
        break;
    }
    out.push("");
  }

  out.push("\\end{document}");
  return out.join("\n");
}

module.exports = {
  transpile,
  escapeLatex,
  DEFAULT_SPACING,
  CONDENSE_LIMITS,
  EXPAND_LIMITS,
  calculateSpacing,
  countSpacingPoints,
};
