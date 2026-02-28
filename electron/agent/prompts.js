// ── System prompts ────────────────────────────────────────────────────────────

const TEX_SYSTEM_PROMPT = `You are a LaTeX editing assistant built into IntelliTex, a resume editor.

For simple questions (e.g. "what does \\vspace do?"), just answer directly without calling any tools.

For editing tasks:
1. The file content is already loaded in context — do NOT call read_file unless you need to re-read after making edits.
2. Make changes with str_replace or line_replace. Use write_file only for full rewrites.
3. Call compile_file to verify the result compiles without errors.
4. If compilation fails, fix the errors and compile again.

## Critical rules for str_replace

- Copy old_str directly from the file content in context. Never retype or paraphrase.
- Keep old_str SHORT (1-3 lines) and unique in the file.
- If old_str appears multiple times, include one surrounding line to disambiguate.
- Whitespace must match exactly: leading spaces, trailing spaces, blank lines, indentation.
- If str_replace fails, re-read the file and try again with the corrected string.

## LaTeX special characters

When writing or rewriting LaTeX content, always escape special characters:
- Use \\% for percent signs (bare % starts a comment and silently eats the rest of the line)
- Use \\$ for dollar signs, \\& for ampersands, \\# for hash, \\_ for underscores (outside commands)

Be concise and action-oriented. Default to under ~120 words unless the user asks for more detail.

Only touch .tex, .bib, .cls, or .sty files.`;

// ── itek prompt ──────────────────────────────────────────────────────────────

const ITEK_SYSTEM_PROMPT = `You are an itek resume editing assistant built into IntelliTex.

itek is a lightweight plain-text resume language that transpiles to LaTeX. You edit the .itek source directly — never write raw LaTeX. The app compiles .itek → LaTeX → PDF automatically.

## itek language reference

Use the lookup_itek_reference tool to look up itek syntax, section definitions, fields, and examples. Topics: grammar, socials, education, experience, leadership, projects, skills, special, all.

If a relevant itek reference section is already provided in context, do NOT call lookup_itek_reference — use what's there.

## Compilation

compile_file handles the full .itek → LaTeX → PDF pipeline automatically. You do NOT need a .tex file — just call compile_file on the .itek file and it will transpile and compile in one step.

Compile errors reference the generated LaTeX, not the .itek source. If a compile error mentions a line number, it refers to the intermediate LaTeX — look at the content of the .itek file to find the corresponding source and fix it there.

For editing tasks:
1. The file content is already loaded in context — do NOT call read_file unless you need to re-read after making edits.
2. Check if the relevant itek reference section is in context. Only call lookup_itek_reference if it is not.
3. Make changes with str_replace or line_replace.
4. Call compile_file to verify the result.
5. If compilation fails, fix the .itek source and compile again.

## Critical rules for str_replace

- Copy old_str exactly from the file content in context — every space and newline must match.
- Keep old_str short (1-3 lines) and unique.
- If str_replace fails, re-read the file and try again with the corrected string.

Be concise and action-oriented. Only touch .itek files.`;

// ── Summary instruction (appended only for multi-turn conversations) ─────────

const SUMMARY_INSTRUCTION = `

## Summary block (required)

At the end of your response, append a summary block:

[[SUMMARY]]
Goal: ... | Progress: ... | Decisions: ... | Next: ... | Files: ...
[[/SUMMARY]]

Keep it under 40 words total. Use "None" for empty fields. Do not mention the summary in the main response.`;

// ── Exports ───────────────────────────────────────────────────────────────────

function getSystemPrompt(filePath, hasHistory) {
  let prompt;
  if (filePath && filePath.endsWith('.itek')) {
    prompt = ITEK_SYSTEM_PROMPT;
  } else {
    prompt = TEX_SYSTEM_PROMPT;
  }
  // Only add summary overhead for multi-turn conversations where we need
  // context carry-over. One-shot tasks don't need it.
  if (hasHistory) {
    prompt += SUMMARY_INSTRUCTION;
  }
  return prompt;
}

// ── Context builder ──────────────────────────────────────────────────────────

const MAX_INLINE_LINES = 300;
const WINDOW_BEFORE = 30;
const WINDOW_AFTER = 30;

function formatLines(lines, offset) {
  return lines.map((l, i) => `${offset + i}: ${l}`).join('\n');
}

/**
 * Build the dynamic context message injected alongside the system prompt.
 *
 * Key optimization: we inject the file content directly so the model never
 * needs to waste a round-trip calling read_file on the first turn.
 * For files with a selection, we send a focused window around the selection
 * instead of the entire file.
 */
function buildContext(context) {
  const parts = [];

  if (context.summary) parts.push(`Previous conversation summary:\n${context.summary}`);
  if (context.filePath) parts.push(`File: ${context.filePath}`);

  // ── Inject file content ────────────────────────────────────────────────
  if (context.content) {
    const lines = context.content.split('\n');
    const totalLines = lines.length;

    if (context.selection && totalLines > MAX_INLINE_LINES) {
      // Selection-based windowing: show a focused region around the selection
      const selStart = Math.max(1, context.selection.startLine);
      const selEnd = Math.min(totalLines, context.selection.endLine);
      const winStart = Math.max(1, selStart - WINDOW_BEFORE);
      const winEnd = Math.min(totalLines, selEnd + WINDOW_AFTER);
      const slice = lines.slice(winStart - 1, winEnd);
      parts.push(`\nFile content (lines ${winStart}-${winEnd} of ${totalLines}, around selection ${selStart}-${selEnd}):`);
      parts.push(formatLines(slice, winStart));
      parts.push(`(Use read_file with startLine/endLine if you need lines outside this range.)`);
    } else if (totalLines <= MAX_INLINE_LINES) {
      // Small file: inline the whole thing
      parts.push(`\nFile content (${totalLines} lines):`);
      parts.push(formatLines(lines, 1));
    } else {
      // Large file, no selection: show head + tail
      const HEAD = 200;
      const TAIL = 60;
      const tailStart = Math.max(HEAD + 1, totalLines - TAIL + 1);
      parts.push(`\nFile content (${totalLines} lines, showing 1-${HEAD} and ${tailStart}-${totalLines}):`);
      parts.push(formatLines(lines.slice(0, HEAD), 1));
      parts.push(`... lines ${HEAD + 1}-${tailStart - 1} omitted (use read_file with startLine/endLine) ...`);
      parts.push(formatLines(lines.slice(tailStart - 1), tailStart));
    }
  }

  // ── Selection marker ───────────────────────────────────────────────────
  if (context.selection) {
    parts.push(`\nSelected lines: ${context.selection.startLine} to ${context.selection.endLine}`);
  }

  // ── Compile errors ─────────────────────────────────────────────────────
  if (context.compileErrors?.length) {
    parts.push('\nCompile errors:');
    const maxErrors = 5;
    const shown = context.compileErrors.slice(0, maxErrors);
    for (const e of shown) parts.push(`  - Line ${e.line}: ${e.message}`);
    if (context.compileErrors.length > maxErrors) {
      parts.push(`  - (${context.compileErrors.length - maxErrors} more errors not shown)`);
    }
  }

  return parts.join('\n');
}

// ── itek reference inlining ──────────────────────────────────────────────────

const itekRef = require('./itek-reference.json');

/**
 * Detect which itek sections are present in the file content and return
 * the relevant reference snippets to inline into context.
 * This eliminates the need for a lookup_itek_reference call on the first turn.
 */
function getRelevantItekReference(content) {
  if (!content) return null;
  const sectionPattern = /^#(\w+)/gm;
  const found = new Set();
  let match;
  while ((match = sectionPattern.exec(content)) !== null) {
    found.add(match[1].toLowerCase());
  }
  if (found.size === 0) return null;

  const parts = [];
  for (const name of found) {
    const section = itekRef.sections[name];
    if (section) {
      parts.push(`### ${name}\n${JSON.stringify(section, null, 2)}`);
    }
  }
  if (parts.length === 0) return null;
  return `itek reference for sections in this file:\n${parts.join('\n\n')}`;
}

module.exports = { getSystemPrompt, buildContext, getRelevantItekReference };
