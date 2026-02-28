const { parse } = require("./parser");
const {
  transpile,
  DEFAULT_SPACING,
  CONDENSE_LIMITS,
  EXPAND_LIMITS,
  calculateSpacing,
  countSpacingPoints,
} = require("./transpiler");

function itekToLatex(source, options) {
  const doc = parse(source);
  return transpile(doc, options);
}

module.exports = {
  parse,
  transpile,
  itekToLatex,
  DEFAULT_SPACING,
  CONDENSE_LIMITS,
  EXPAND_LIMITS,
  calculateSpacing,
  countSpacingPoints,
};
