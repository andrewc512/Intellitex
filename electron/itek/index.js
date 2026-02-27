const { parse } = require("./parser");
const { transpile } = require("./transpiler");

function itekToLatex(source) {
  const doc = parse(source);
  return transpile(doc);
}

module.exports = { parse, transpile, itekToLatex };
