const fs = require('fs/promises');
const path = require('path');

const ALLOWED_EXTENSIONS = new Set(['.tex', '.bib', '.cls', '.sty', '.itek']);

const definition = {
  type: 'function',
  function: {
    name: 'write_file',
    description:
      'Overwrite a LaTeX file with entirely new content. ' +
      'Use this for large-scale rewrites. ' +
      'Prefer str_replace for smaller, targeted changes.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Absolute path to the LaTeX file.',
        },
        content: {
          type: 'string',
          description: 'The complete new content to write to the file.',
        },
      },
      required: ['path', 'content'],
    },
  },
};

async function execute({ path: filePath, content }) {
  const ext = path.extname(filePath).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return { error: `File type "${ext}" is not allowed. Only .tex, .bib, .cls, .sty files are supported.` };
  }
  try {
    await fs.writeFile(filePath, content, 'utf-8');
    return { success: true, newContent: content };
  } catch (err) {
    return { error: err.message };
  }
}

module.exports = { definition, execute };
