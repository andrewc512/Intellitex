/**
 * .itek parser — converts itek source into a structured document AST.
 *
 * Grammar (indentation-based, line-oriented):
 *
 *   @resume <name>          document declaration
 *   #<section>              section header
 *   company <name>          entry in #experience
 *   project <name>          entry in #projects
 *   organization <name>     entry in #leadership
 *   ## <entry>              generic entry (works in any section)
 *   <key>: <value>          field (plain value)
 *   <key>: "<value>"        field (quoted value)
 *   <key>: <url>            field (URL / email in angle brackets)
 *   * <text>                bullet point
 */

const ENTRY_MARKERS = ["company", "project", "organization"];

function parse(source) {
  const lines = source.split("\n");
  const doc = { name: "", sections: [] };

  let currentSection = null;
  let currentEntry = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith("@resume ")) {
      doc.name = trimmed.slice(8).trim();
      continue;
    }

    // #section but NOT ## (entry)
    if (/^#(?!#)/.test(trimmed)) {
      const sectionName = trimmed.replace(/^#\s*/, "").trim().toLowerCase();
      currentSection = { type: sectionName, fields: {}, entries: [] };
      doc.sections.push(currentSection);
      currentEntry = null;
      continue;
    }

    // ## generic entry OR semantic entry markers (company / project / organization)
    let entryName = null;
    if (/^##\s+/.test(trimmed)) {
      entryName = trimmed.replace(/^##\s+/, "").trim();
    } else {
      const lower = trimmed.toLowerCase();
      for (const marker of ENTRY_MARKERS) {
        // "company Name" or "company: Name" or "company: "Name""
        if (lower.startsWith(marker + " ") || lower.startsWith(marker + ":")) {
          let raw = trimmed.slice(marker.length).trim();
          if (raw.startsWith(":")) raw = raw.slice(1).trim();
          if (raw.startsWith('"') && raw.endsWith('"')) raw = raw.slice(1, -1);
          entryName = raw;
          break;
        }
      }
    }
    if (entryName !== null) {
      currentEntry = { name: entryName, fields: {}, bullets: [] };
      if (currentSection) currentSection.entries.push(currentEntry);
      continue;
    }

    if (trimmed.startsWith("* ")) {
      const bullet = trimmed.slice(2).trim();
      if (currentEntry) {
        currentEntry.bullets.push(bullet);
      } else if (currentSection) {
        if (!currentSection.bullets) currentSection.bullets = [];
        currentSection.bullets.push(bullet);
      }
      continue;
    }

    // key: value
    const colonIdx = trimmed.indexOf(":");
    if (colonIdx > 0) {
      const key = trimmed.slice(0, colonIdx).trim().toLowerCase();
      let value = trimmed.slice(colonIdx + 1).trim();

      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }

      let url = null;
      if (value.startsWith("<") && value.endsWith(">")) {
        url = value.slice(1, -1);
        value = url;
      }

      const target = currentEntry || currentSection;
      if (target) {
        target.fields[key] = url ? { text: value, url } : value;
      }
      continue;
    }
  }

  return doc;
}

module.exports = { parse };
