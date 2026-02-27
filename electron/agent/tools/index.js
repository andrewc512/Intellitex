const readFile = require('./read-file');
const strReplace = require('./str-replace');
const writeFile = require('./write-file');
const compileFile = require('./compile');
const think = require('./think');

const _tools = [think, readFile, strReplace, writeFile, compileFile];

const definitions = _tools.map((t) => t.definition);

const _executors = {
  think: think.execute,
  read_file: readFile.execute,
  str_replace: strReplace.execute,
  write_file: writeFile.execute,
  compile_file: compileFile.execute,
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
