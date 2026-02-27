const fs = require('fs/promises');
const path = require('path');

const ALLOWED_EXTENSIONS = new Set(['.tex', '.bib', '.cls', '.sty', '.itek']);

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
    const raw = await fs.readFile(filePath, 'utf-8');
    // Include line numbers so the model can use line_replace accurately
    const content = raw
      .split('\n')
      .map((line, i) => `${i + 1}: ${line}`)
      .join('\n');
    return { content, totalLines: raw.split('\n').length };
  } catch (err) {
    return { error: `Failed to read file: ${err.message}` };
  }
}

module.exports = { definition, execute };
