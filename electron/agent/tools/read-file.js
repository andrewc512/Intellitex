const fs = require('fs/promises');
const path = require('path');

const ALLOWED_EXTENSIONS = new Set(['.tex', '.bib', '.cls', '.sty']);

const definition = {
  type: 'function',
  function: {
    name: 'read_file',
    description: 'Read the current content of a LaTeX file.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Absolute path to the LaTeX file.',
        },
      },
      required: ['path'],
    },
  },
};

async function execute({ path: filePath }) {
  const ext = path.extname(filePath).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return { error: `File type "${ext}" is not allowed. Only .tex, .bib, .cls, .sty files are supported.` };
  }
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return { content };
  } catch (err) {
    return { error: `Failed to read file: ${err.message}` };
  }
}

module.exports = { definition, execute };
