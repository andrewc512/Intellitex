const { compile } = require('../../compiler');
const path = require('path');

const COMPILABLE_EXTS = ['.tex', '.itek'];

const definition = {
  type: 'function',
  function: {
    name: 'compile_file',
    description:
      'Compile a .tex or .itek file. ' +
      'For .itek files the full transpile → LaTeX → PDF pipeline runs automatically. ' +
      'Returns success status, errors, and warnings. ' +
      'Always call this after editing to verify the result is valid.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Absolute path to the .tex or .itek file to compile.',
        },
      },
      required: ['path'],
    },
  },
};

async function execute({ path: filePath }) {
  if (!COMPILABLE_EXTS.includes(path.extname(filePath).toLowerCase())) {
    return { error: 'Only .tex and .itek files can be compiled.' };
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
