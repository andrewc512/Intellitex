const fs = require('fs/promises');
const path = require('path');

const ALLOWED_EXTENSIONS = new Set(['.tex', '.bib', '.cls', '.sty', '.itek']);

const definition = {
  type: 'function',
  function: {
    name: 'str_replace',
    description:
      'Replace an exact string in a LaTeX file with new text. ' +
      'old_str must match EXACTLY — copy it character-for-character from the file content, ' +
      'including all whitespace, indentation, and newlines. ' +
      'Keep old_str short (1-3 lines) and unique. Prefer this over write_file for targeted changes.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Absolute path to the LaTeX file.',
        },
        old_str: {
          type: 'string',
          description: 'The exact text to find and replace.',
        },
        new_str: {
          type: 'string',
          description: 'The replacement text.',
        },
      },
      required: ['path', 'old_str', 'new_str'],
    },
  },
};

async function execute({ path: filePath, old_str, new_str }) {
  const ext = path.extname(filePath).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return { error: `File type "${ext}" is not allowed.` };
  }
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    if (!content.includes(old_str)) {
      // Help the model self-correct by showing a snippet of the file.
      // Find the most similar region using the first line of old_str.
      const firstLine = old_str.split('\n')[0].trim();
      const lines = content.split('\n');
      let hint = '';
      if (firstLine.length > 5) {
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes(firstLine) || firstLine.includes(lines[i].trim())) {
            const start = Math.max(0, i - 2);
            const end = Math.min(lines.length, i + 5);
            hint = `\n\nNearest matching region (lines ${start + 1}-${end}):\n` +
              lines.slice(start, end).map((l, j) => `${start + j + 1}: ${l}`).join('\n');
            break;
          }
        }
      }
      if (!hint) {
        // Show a portion of the file so the model can see the actual content
        const preview = lines.slice(0, 30).map((l, j) => `${j + 1}: ${l}`).join('\n');
        hint = `\n\nFile preview (first 30 lines):\n${preview}`;
      }
      return { error: `old_str not found in the file. Ensure it matches exactly — every space, tab, and newline must be identical.${hint}` };
    }
    const occurrences = content.split(old_str).length - 1;
    if (occurrences > 1) {
      return { error: `old_str appears ${occurrences} times. Include more surrounding lines to make it unique.` };
    }
    const newContent = content.replace(old_str, new_str);
    await fs.writeFile(filePath, newContent, 'utf-8');
    return { success: true, newContent };
  } catch (err) {
    return { error: err.message };
  }
}

module.exports = { definition, execute };
