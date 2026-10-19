'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseExpression } = require('../src/parser');
const { evaluate } = require('../src/evaluator');

function evalExpr(expression, record) {
  return evaluate(parseExpression(expression), record);
}

test('comparison and logical operators', () => {
  assert.equal(
    evalExpr('age >= 18 && status == "active"', { age: 20, status: 'active' }),
    true
  );
  assert.equal(
    evalExpr('age >= 18 && status == "active"', { age: 16, status: 'active' }),
    false
  );
});

test('paths, indexing, and arithmetic', () => {
  assert.equal(evalExpr('user.score + bonus', { user: { score: 5 }, bonus: 2 }), 7);
  assert.equal(
    evalExpr('items[1].name', { items: [{ name: 'a' }, { name: 'b' }] }),
    'b'
  );
});

test('in operator', () => {
  assert.equal(evalExpr('"admin" in roles', { roles: ['user', 'admin'] }), true);
  assert.equal(evalExpr('name in user', { name: 'id', user: { id: 1 } }), true);
  assert.equal(evalExpr('"lo" in text', { text: 'hello' }), true);
});

test('functions', () => {
  assert.equal(evalExpr('length(name)', { name: 'abc' }), 3);
  assert.equal(evalExpr('lower(name)', { name: 'ABC' }), 'abc');
  assert.equal(evalExpr('exists(missing)', { missing: null }), false);
  assert.equal(evalExpr('type(value)', { value: [1, 2] }), 'array');
});

test('array literals and string concatenation', () => {
  assert.deepEqual(evalExpr('[1, 2, 3]', {}), [1, 2, 3]);
  assert.equal(evalExpr('first + " " + last', { first: 'Ada', last: 'Lovelace' }), 'Ada Lovelace');
});
