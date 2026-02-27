/**
 * .itek transpiler — converts a parsed document AST into a LaTeX string.
 *
 * Uses a Jake's-Resume–style template with clean ATS-friendly formatting.
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

// ── Preamble ─────────────────────────────────────────────────────────────────

function preamble() {
  return [
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
    "\\addtolength{\\oddsidemargin}{-0.5in}",
    "\\addtolength{\\evensidemargin}{-0.5in}",
    "\\addtolength{\\textwidth}{1in}",
    "\\addtolength{\\topmargin}{-.5in}",
    "\\addtolength{\\textheight}{1.0in}",
    "",
    "\\urlstyle{same}",
    "\\raggedbottom",
    "\\raggedright",
    "\\setlength{\\tabcolsep}{0in}",
    "",
    "\\titleformat{\\section}{\\vspace{-4pt}\\scshape\\raggedright\\large}{}{0em}{}[\\color{black}\\titlerule\\vspace{-5pt}]",
    "",
    "% ── Resume commands ──",
    "\\newcommand{\\resumeItem}[1]{\\item\\small{#1 \\vspace{-2pt}}}",
    "\\newcommand{\\resumeSubheading}[4]{",
    "  \\vspace{-2pt}\\item",
    "    \\begin{tabular*}{0.97\\textwidth}[t]{l@{\\extracolsep{\\fill}}r}",
    "      \\textbf{#1} & #2 \\\\",
    "      \\textit{\\small#3} & \\textit{\\small #4} \\\\",
    "    \\end{tabular*}\\vspace{-7pt}",
    "}",
    "\\newcommand{\\resumeProjectHeading}[2]{",
    "    \\item",
    "    \\begin{tabular*}{0.97\\textwidth}{l@{\\extracolsep{\\fill}}r}",
    "      \\small#1 & #2 \\\\",
    "    \\end{tabular*}\\vspace{-7pt}",
    "}",
    "\\newcommand{\\resumeSubHeadingListStart}{\\begin{itemize}[leftmargin=0.15in, label={}]}",
    "\\newcommand{\\resumeSubHeadingListEnd}{\\end{itemize}}",
    "\\newcommand{\\resumeItemListStart}{\\begin{itemize}[label=$\\bullet$]}",
    "\\newcommand{\\resumeItemListEnd}{\\end{itemize}\\vspace{-5pt}}",
  ];
}

// ── Header (name + socials) ──────────────────────────────────────────────────

function renderHeader(doc) {
  const lines = [];
  const socials = doc.sections.find((s) => s.type === "socials");

  lines.push("\\begin{center}");
  lines.push(
    `  \\textbf{\\Huge \\scshape ${escapeLatex(doc.name)}} \\\\ \\vspace{1pt}`
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
  lines.push("\\section{Education}");
  lines.push("\\resumeSubHeadingListStart");

  const renderEntry = (name, f) => {
    const school = escapeLatex(name);
    const loc = escapeLatex(fieldVal(f.loc || f.location || ""));
    const deg = fieldVal(f.degree || "");
    const gpa = fieldVal(f.gpa || "");
    const degree = gpa ? `${deg}; GPA: ${gpa}` : deg;
    const grad = escapeLatex(fieldVal(f.grad || f.graduation || ""));

    lines.push("  \\resumeSubheading");
    lines.push(`    {${school}}{${loc}}`);
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
  lines.push(`\\section{${escapeLatex(capitalize(section.type))}}`);
  lines.push("\\resumeSubHeadingListStart");

  for (const entry of section.entries) {
    const f = entry.fields;
    const name = escapeLatex(entry.name);
    const loc = escapeLatex(fieldVal(f.loc || f.location || ""));
    const role = escapeLatex(fieldVal(f.role || f.title || ""));
    const date = escapeLatex(fieldVal(f.date || ""));

    lines.push("  \\resumeSubheading");
    lines.push(`    {${name}}{${loc}}`);
    lines.push(`    {${role}}{${date}}`);

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
  lines.push("\\section{Technical Skills}");
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
  lines.push(`\\section{${escapeLatex(capitalize(section.type))}}`);
  lines.push("\\resumeSubHeadingListStart");

  for (const entry of section.entries) {
    const f = entry.fields;
    const name = escapeLatex(entry.name);
    const stack = fieldVal(f.stack || f.technologies || f.tech || "");
    const date = escapeLatex(fieldVal(f.date || ""));

    if (stack) {
      lines.push("  \\resumeProjectHeading");
      lines.push(
        `    {\\textbf{${name}} $|$ \\emph{${escapeLatex(stack)}}}{${date}}`
      );
    } else {
      lines.push("  \\resumeProjectHeading");
      lines.push(`    {\\textbf{${name}}}{${date}}`);
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

function transpile(doc) {
  const out = [];

  out.push(...preamble());
  out.push("");
  out.push("\\begin{document}");
  out.push("");

  out.push(...renderHeader(doc));
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

module.exports = { transpile, escapeLatex };
