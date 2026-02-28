const fs = require('fs/promises');
const path = require('path');

const ALLOWED_EXTENSIONS = new Set(['.tex', '.bib', '.cls', '.sty', '.itek']);

const definition = {
  type: 'function',
  function: {
    name: 'read_file',
    description: 'Read the current content of a LaTeX file. Prefer reading only relevant ranges for large files.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Absolute path to the LaTeX file.',
        },
        startLine: {
          type: 'number',
          description: 'Optional 1-based start line for a partial read.',
        },
        endLine: {
          type: 'number',
          description: 'Optional 1-based end line for a partial read.',
        },
      },
      required: ['path'],
    },
  },
};

const MAX_FULL_LINES = 400;
const HEAD_LINES = 200;
const TAIL_LINES = 60;

function formatLines(lines, offset) {
  return lines.map((line, i) => `${offset + i}: ${line}`).join('\n');
}

async function execute({ path: filePath, startLine, endLine }) {
  const ext = path.extname(filePath).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return { error: `File type "${ext}" is not allowed. Only .tex, .bib, .cls, .sty files are supported.` };
  }
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const allLines = raw.split('\n');
    const totalLines = allLines.length;

    if (startLine || endLine) {
      const start = Math.max(1, startLine || 1);
      const end = Math.min(totalLines, endLine || totalLines);
      const slice = allLines.slice(start - 1, end);
      const content = formatLines(slice, start);
      return { content, totalLines, startLine: start, endLine: end };
    }

    // Include line numbers so the model can use line_replace accurately.
    if (totalLines <= MAX_FULL_LINES) {
      const content = formatLines(allLines, 1);
      return { content, totalLines };
    }

    const head = allLines.slice(0, HEAD_LINES);
    const tailStart = Math.max(HEAD_LINES + 1, totalLines - TAIL_LINES + 1);
    const tail = allLines.slice(tailStart - 1);
    const contentParts = [
      formatLines(head, 1),
      `... omitted lines ${HEAD_LINES + 1}-${tailStart - 1} (use startLine/endLine to read a range) ...`,
      formatLines(tail, tailStart),
    ];
    return {
      content: contentParts.join('\n'),
      totalLines,
      truncated: true,
      note: `File has ${totalLines} lines. Returned lines 1-${HEAD_LINES} and ${tailStart}-${totalLines}.`,
    };
  } catch (err) {
    return { error: `Failed to read file: ${err.message}` };
  }
}

module.exports = { definition, execute };
