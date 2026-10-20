'use strict';

const evaluator = require('./evaluator');

module.exports = {
  tokenize: require('./tokenizer').tokenize,
  parseExpression: require('./parser').parseExpression,
  evaluate: evaluator.evaluate,
  truthy: evaluator.truthy,
  getPath: evaluator.getPath,
  setPath: evaluator.setPath,
  splitPath: evaluator.splitPath,
  deepEqual: evaluator.deepEqual,
  project: evaluator.project,
  run: require('./query').run
};
