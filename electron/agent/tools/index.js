const readFile = require('./read-file');
const strReplace = require('./str-replace');
const lineReplace = require('./line-replace');
const writeFile = require('./write-file');
const compileFile = require('./compile');
const itekReference = require('./itek-reference');

const _tools = [readFile, strReplace, lineReplace, writeFile, compileFile, itekReference];

const definitions = _tools.map((t) => t.definition);

const _executors = {
  read_file: readFile.execute,
  str_replace: strReplace.execute,
  line_replace: lineReplace.execute,
  write_file: writeFile.execute,
  compile_file: compileFile.execute,
  lookup_itek_reference: itekReference.execute,
};

async function executeTool(name, args) {
  const fn = _executors[name];
  if (!fn) return { error: `Unknown tool: "${name}"` };
  try {
    return await fn(args);
  } catch (err) {
    return { error: err.message };
  }
}

module.exports = { definitions, executeTool };
