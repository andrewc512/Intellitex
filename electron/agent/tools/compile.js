const { compile } = require('../../compiler');
const path = require('path');

const definition = {
  type: 'function',
  function: {
    name: 'compile_file',
    description:
      'Compile a .tex file using pdflatex. ' +
      'Returns success status, errors, and warnings. ' +
      'Always call this after editing to verify the LaTeX is valid.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Absolute path to the .tex file to compile.',
        },
      },
      required: ['path'],
    },
  },
};

async function execute({ path: filePath }) {
  if (path.extname(filePath).toLowerCase() !== '.tex') {
    return { error: 'Only .tex files can be compiled.' };
  }
  try {
    const result = await compile(filePath);
    return {
      success: result.success,
      errors: result.errors,
      pdfPath: result.pdfPath ?? null,
    };
  } catch (err) {
    return { error: err.message };
  }
}

module.exports = { definition, execute };
