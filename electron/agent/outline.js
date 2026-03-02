// ── Document outline builder ─────────────────────────────────────────────────
// Generates a compact structural outline (~150 tokens) that gives the agent
// a "map" of the document before it sees the raw content.

/**
 * Build an outline for .itek files by scanning lines for structural markers.
 */
function buildItekOutline(content) {
  const lines = content.split('\n');
  const sections = [];
  let currentSection = null;
  let currentEntry = null;
  let resumeName = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // @resume marker
    const resumeMatch = line.match(/^@resume\s+(.+)/);
    if (resumeMatch) {
      resumeName = resumeMatch[1].trim();
      continue;
    }

    // #section marker
    const sectionMatch = line.match(/^#(\w+)\s*$/);
    if (sectionMatch) {
      // Close previous entry
      if (currentEntry && currentSection) {
        currentEntry.endLine = lineNum - 1;
        currentSection.entries.push(currentEntry);
        currentEntry = null;
      }
      // Close previous section
      if (currentSection) {
        currentSection.endLine = lineNum - 1;
        sections.push(currentSection);
      }
      currentSection = {
        name: sectionMatch[1].toUpperCase(),
        startLine: lineNum,
        endLine: null,
        entries: [],
        metadata: {},
      };
      continue;
    }

    if (!currentSection) continue;

    // Entry markers: company, project, organization, ##
    const entryMatch = line.match(/^\s+(company|project|organization|##)\s+(.+)/);
    if (entryMatch) {
      // Close previous entry
      if (currentEntry) {
        currentEntry.endLine = lineNum - 1;
        currentSection.entries.push(currentEntry);
      }
      currentEntry = {
        type: entryMatch[1],
        name: entryMatch[2].trim(),
        startLine: lineNum,
        endLine: null,
        bullets: 0,
        role: null,
        date: null,
      };
      continue;
    }

    // Bullets
    if (currentEntry && /^\s+\*\s/.test(line)) {
      currentEntry.bullets++;
      continue;
    }

    // Key-value fields
    const kvMatch = line.match(/^\s+(\w+):\s*(.+)/);
    if (kvMatch) {
      const key = kvMatch[1].toLowerCase();
      const value = kvMatch[2].trim().replace(/^"(.*)"$/, '$1');

      if (currentEntry) {
        if (key === 'role') currentEntry.role = value;
        if (key === 'date') currentEntry.date = value;
      } else {
        // Section-level metadata (education fields, skills categories, etc.)
        currentSection.metadata[key] = value;
      }
    }
  }

  // Close final entry and section
  if (currentEntry && currentSection) {
    currentEntry.endLine = lines.length;
    currentSection.entries.push(currentEntry);
  }
  if (currentSection) {
    currentSection.endLine = lines.length;
    sections.push(currentSection);
  }

  if (!resumeName && sections.length === 0) return null;

  // ── Format output ──────────────────────────────────────────────────────
  const out = ['Document outline:'];

  // Heading line (from @resume)
  if (resumeName) {
    out.push(`  HEADING (line 1): ${resumeName}`);
  }

  for (const sec of sections) {
    const range = `lines ${sec.startLine}-${sec.endLine}`;

    if (sec.name === 'SOCIALS') {
      out.push(`  SOCIALS (${range}): contact info`);
      continue;
    }

    if (sec.name === 'EDUCATION') {
      const parts = [];
      if (sec.metadata.school) parts.push(sec.metadata.school);
      if (sec.metadata.degree) parts.push(sec.metadata.degree);
      if (sec.metadata.gpa) parts.push(`GPA: ${sec.metadata.gpa}`);
      out.push(`  EDUCATION (${range}): ${parts.join(', ') || 'education info'}`);
      continue;
    }

    if (sec.name === 'SKILLS') {
      const categories = Object.keys(sec.metadata).join(', ');
      out.push(`  SKILLS (${range}): ${categories || 'skills'}`);
      continue;
    }

    // Sections with entries (experience, projects, leadership, etc.)
    if (sec.entries.length > 0) {
      out.push(`  ${sec.name} (${range}):`);
      for (const entry of sec.entries) {
        const parts = [entry.name];
        if (entry.role) parts.push(entry.role);
        if (entry.date) parts.push(entry.date);
        const entryRange = `lines ${entry.startLine}-${entry.endLine}`;
        out.push(`    - ${parts.join(', ')} (${entryRange}, ${entry.bullets} bullets)`);
      }
    } else {
      out.push(`  ${sec.name} (${range})`);
    }
  }

  return out.join('\n');
}

/**
 * Build an outline for .tex files by scanning for comment markers and LaTeX commands.
 */
function buildTexOutline(content) {
  const lines = content.split('\n');
  const sections = [];
  let currentSection = null;
  let currentEntry = null;
  let headingName = null;
  let headingEndLine = null;
  let itemCount = 0;
  let inItemize = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // %---SECTIONNAME--- or %-----------SECTIONNAME-----------
    const sectionMarker = line.match(/^%[-\s]*(\w+)[-\s]*$/);
    if (sectionMarker) {
      const name = sectionMarker[1].toUpperCase();

      // Close current itemize block
      if (inItemize && currentEntry) {
        currentEntry.bullets = itemCount;
        inItemize = false;
        itemCount = 0;
      }
      // Close previous entry
      if (currentEntry && currentSection) {
        currentEntry.endLine = lineNum - 1;
        currentSection.entries.push(currentEntry);
        currentEntry = null;
      }
      // Close previous section
      if (currentSection) {
        currentSection.endLine = lineNum - 1;
        sections.push(currentSection);
      }

      if (name === 'HEADING') {
        // HEADING is special — look ahead for name
        currentSection = null;
        // Scan ahead for the name
        for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
          const hMatch = lines[j].match(/\\textbf\{\\(?:Huge|Large)\s+(.+?)\}/);
          if (hMatch) {
            headingName = hMatch[1].trim();
            headingEndLine = j + 1; // will be refined when next section starts
            break;
          }
        }
        // Track heading end
        headingEndLine = lineNum;
        continue;
      }

      currentSection = {
        name,
        startLine: lineNum,
        endLine: null,
        entries: [],
        metadata: {},
      };
      continue;
    }

    // Track heading end line
    if (headingName && !currentSection && line.trim()) {
      headingEndLine = lineNum;
    }

    if (!currentSection) continue;

    // \textbf{Name} at the start — entry marker (but not category labels like \textbf{Languages:})
    const boldMatch = line.match(/\\textbf\{([^}]+)\}/);
    if (boldMatch && !line.match(/\\textbf\{\\(?:Huge|Large)/)) {
      const name = boldMatch[1].trim();

      // Check if this is a skills category (ends with :)
      if (name.endsWith(':')) {
        const category = name.replace(/:$/, '');
        currentSection.metadata[category.toLowerCase()] = true;
        continue;
      }

      // Close current itemize
      if (inItemize && currentEntry) {
        currentEntry.bullets = itemCount;
        inItemize = false;
        itemCount = 0;
      }
      // Close previous entry
      if (currentEntry) {
        currentEntry.endLine = lineNum - 1;
        currentSection.entries.push(currentEntry);
      }

      // Extract role/degree from \textit{...} on same or next line
      let role = null;
      let date = null;
      const italicMatch = line.match(/\\textit\{([^}]+)\}/);
      if (italicMatch) {
        role = italicMatch[1].trim();
      }
      // Check next line for \textit if not on same line
      if (!role && i + 1 < lines.length) {
        const nextItalic = lines[i + 1].match(/\\textit\{([^}]+)\}/);
        if (nextItalic) {
          role = nextItalic[1].trim();
        }
      }
      // Extract date from \hfill
      const dateMatch = line.match(/\\hfill\s+(.+?)(?:\s*\\\\|$)/);
      if (dateMatch) {
        date = dateMatch[1].trim();
      }

      currentEntry = {
        name,
        startLine: lineNum,
        endLine: null,
        bullets: 0,
        role,
        date,
      };
      continue;
    }

    // \begin{itemize}
    if (/\\begin\{itemize\}/.test(line)) {
      inItemize = true;
      itemCount = 0;
      continue;
    }

    // \end{itemize}
    if (/\\end\{itemize\}/.test(line)) {
      if (currentEntry) {
        currentEntry.bullets = itemCount;
      }
      inItemize = false;
      itemCount = 0;
      continue;
    }

    // \item
    if (inItemize && /\\item/.test(line)) {
      itemCount++;
    }
  }

  // Close final entry and section
  if (inItemize && currentEntry) {
    currentEntry.bullets = itemCount;
  }
  if (currentEntry && currentSection) {
    currentEntry.endLine = lines.length;
    currentSection.entries.push(currentEntry);
  }
  if (currentSection) {
    currentSection.endLine = lines.length;
    sections.push(currentSection);
  }

  if (!headingName && sections.length === 0) return null;

  // ── Format output ──────────────────────────────────────────────────────
  const out = ['Document outline:'];

  if (headingName) {
    // Find where heading ends (start of first section or end of file)
    const firstSectionLine = sections.length > 0 ? sections[0].startLine - 1 : headingEndLine;
    out.push(`  HEADING (lines 1-${firstSectionLine}): ${headingName}, contact info`);
  }

  for (const sec of sections) {
    const range = `lines ${sec.startLine}-${sec.endLine}`;

    if (sec.name === 'EDUCATION') {
      // Extract details from entries
      if (sec.entries.length > 0) {
        const entry = sec.entries[0];
        const parts = [entry.name];
        if (entry.role) parts.push(entry.role);
        out.push(`  EDUCATION (${range}): ${parts.join(', ')}`);
      } else {
        out.push(`  EDUCATION (${range})`);
      }
      continue;
    }

    if (sec.name === 'SKILLS') {
      const categories = Object.keys(sec.metadata).join(', ');
      out.push(`  SKILLS (${range}): ${categories || 'skills'}`);
      continue;
    }

    // Sections with entries
    if (sec.entries.length > 0) {
      out.push(`  ${sec.name} (${range}):`);
      for (const entry of sec.entries) {
        const parts = [entry.name];
        if (entry.role) parts.push(entry.role);
        if (entry.date) parts.push(entry.date);
        const entryRange = `lines ${entry.startLine}-${entry.endLine}`;
        out.push(`    - ${parts.join(', ')} (${entryRange}, ${entry.bullets} bullets)`);
      }
    } else {
      out.push(`  ${sec.name} (${range})`);
    }
  }

  return out.join('\n');
}

/**
 * Unified entry point — dispatches to the right builder based on file extension.
 */
function buildOutline(content, filePath) {
  if (!content || !filePath) return null;
  if (filePath.endsWith('.itek')) return buildItekOutline(content);
  if (filePath.endsWith('.tex')) return buildTexOutline(content);
  return null;
}

module.exports = { buildOutline, buildItekOutline, buildTexOutline };
