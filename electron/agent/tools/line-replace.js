const fs = require('fs/promises');
const path = require('path');

const ALLOWED_EXTENSIONS = new Set(['.tex', '.bib', '.cls', '.sty', '.itek']);

const definition = {
  type: 'function',
  function: {
    name: 'line_replace',
    description:
      'Replace a range of lines in a LaTeX file with new text. ' +
      'More reliable than str_replace — you only need to specify line numbers, not exact content. ' +
      'Line numbers are 1-indexed. Both start_line and end_line are inclusive.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Absolute path to the LaTeX file.',
        },
        start_line: {
          type: 'integer',
          description: 'First line to replace (1-indexed, inclusive).',
        },
        end_line: {
          type: 'integer',
          description: 'Last line to replace (1-indexed, inclusive). Use same as start_line to replace a single line.',
        },
        new_text: {
          type: 'string',
          description: 'The replacement text (can be multiple lines). Use empty string to delete lines.',
        },
      },
      required: ['path', 'start_line', 'end_line', 'new_text'],
    },
  },
};

async function execute({ path: filePath, start_line, end_line, new_text }) {
  const ext = path.extname(filePath).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return { error: `File type "${ext}" is not allowed.` };
  }
  if (!Number.isInteger(start_line) || !Number.isInteger(end_line) || start_line < 1) {
    return { error: 'start_line and end_line must be positive integers.' };
  }
  if (end_line < start_line) {
    return { error: 'end_line must be >= start_line.' };
  }
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    if (start_line > lines.length) {
      return { error: `start_line ${start_line} is past end of file (${lines.length} lines).` };
    }
    const clampedEnd = Math.min(end_line, lines.length);

    // Show what's being replaced so the model can verify
    const replaced = lines.slice(start_line - 1, clampedEnd).join('\n');

    // Perform the replacement
    const newLines = new_text === '' ? [] : new_text.split('\n');
    lines.splice(start_line - 1, clampedEnd - start_line + 1, ...newLines);
    const newContent = lines.join('\n');

    await fs.writeFile(filePath, newContent, 'utf-8');
    return {
      success: true,
      linesReplaced: `${start_line}-${clampedEnd}`,
      oldText: replaced,
      newContent,
    };
  } catch (err) {
    return { error: err.message };
  }
}

module.exports = { definition, execute };
