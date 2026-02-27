const fs = require('fs/promises');
const path = require('path');

const ALLOWED_EXTENSIONS = new Set(['.tex', '.bib', '.cls', '.sty']);

const definition = {
  type: 'function',
  function: {
    name: 'str_replace',
    description:
      'Replace an exact string in a LaTeX file with new text. ' +
      'old_str must match exactly (including all whitespace and newlines). ' +
      'Prefer this over write_file for targeted changes.',
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
      return { error: 'old_str not found in the file. Ensure it matches exactly, including all whitespace.' };
    }
    const occurrences = content.split(old_str).length - 1;
    if (occurrences > 1) {
      return { error: `old_str appears ${occurrences} times. Provide a more specific string to avoid ambiguous replacements.` };
    }
    const newContent = content.replace(old_str, new_str);
    await fs.writeFile(filePath, newContent, 'utf-8');
    return { success: true, newContent };
  } catch (err) {
    return { error: err.message };
  }
}

module.exports = { definition, execute };
