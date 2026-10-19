'use strict';

module.exports = {
  tokenize: require('./tokenizer').tokenize,
  parseExpression: require('./parser').parseExpression,
  evaluate: require('./evaluator').evaluate,
  truthy: require('./evaluator').truthy,
  getPath: require('./evaluator').getPath,
  project: require('./evaluator').project,
  run: require('./query').run
};
