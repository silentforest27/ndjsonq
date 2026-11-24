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

test('ternary expressions', () => {
  assert.equal(evalExpr('age >= 18 ? "adult" : "minor"', { age: 20 }), 'adult');
  assert.equal(evalExpr('age >= 18 ? "adult" : "minor"', { age: 16 }), 'minor');
  assert.deepEqual(evalExpr('flag ? [1, 2] : [3, 4]', { flag: false }), [3, 4]);
  assert.equal(evalExpr('false ? missing() : 42', {}), 42);
});

test('aggregate helpers accept arrays or arguments', () => {
  assert.equal(evalExpr('sum(values)', { values: [1, 2, 3] }), 6);
  assert.equal(evalExpr('sum(1, 2, 3)'), 6);
  assert.equal(evalExpr('avg(values)', { values: [1, 2, 3] }), 2);
  assert.equal(evalExpr('avg(1, 2, 3)'), 2);
  assert.equal(evalExpr('min(values)', { values: [3, 1, 2] }), 1);
  assert.equal(evalExpr('max(1, 2, 3)'), 3);
});

test('string, array, object, and utility helpers', () => {
  assert.equal(evalExpr('join(values, ",")', { values: ['a', 'b'] }), 'a,b');
  assert.deepEqual(evalExpr('split(text, ",")', { text: 'a,b' }), ['a', 'b']);
  assert.equal(evalExpr('slice(text, 1, 3)', { text: 'abcd' }), 'bc');
  assert.deepEqual(evalExpr('slice(values, 1)', { values: [1, 2, 3] }), [2, 3]);
  assert.equal(evalExpr('replace(text, "a", "b")', { text: 'banana' }), 'banana'.replace('a', 'b'));
  assert.equal(evalExpr('replaceAll(text, "a", "b")', { text: 'banana' }), 'bbnbnb');
  assert.equal(evalExpr('startsWith(text, "ab")', { text: 'abc' }), true);
  assert.equal(evalExpr('endsWith(text, "bc")', { text: 'abc' }), true);
  assert.equal(evalExpr('indexOf(values, 2)', { values: [1, 2, 3] }), 1);
  assert.deepEqual(evalExpr('reverse(values)', { values: [1, 2, 3] }), [3, 2, 1]);
  assert.deepEqual(evalExpr('sort(values)', { values: [3, 1, 2] }), [1, 2, 3]);
  assert.deepEqual(evalExpr('sort(values, "desc")', { values: [3, 1, 2] }), [3, 2, 1]);
  assert.deepEqual(evalExpr('unique(values)', { values: [1, 2, 1] }), [1, 2]);
  assert.deepEqual(evalExpr('distinct(values)', { values: [1, 2, 1] }), [1, 2]);
  assert.deepEqual(evalExpr('flatten(values)', { values: [1, [2, [3]]] }), [1, 2, [3]]);
  assert.deepEqual(evalExpr('flatten(values, 2)', { values: [1, [2, [3]]] }), [1, 2, 3]);
  assert.equal(evalExpr('first(values)', { values: [1, 2] }), 1);
  assert.equal(evalExpr('head(values)', { values: [1, 2] }), 1);
  assert.equal(evalExpr('last(values)', { values: [1, 2] }), 2);
  assert.deepEqual(evalExpr('tail(values)', { values: [1, 2, 3] }), [2, 3]);
  assert.deepEqual(evalExpr('concat(a, b)', { a: [1], b: [2, 3] }), [1, 2, 3]);
  assert.deepEqual(evalExpr('range(3)'), [0, 1, 2]);
  assert.deepEqual(evalExpr('range(1, 4)'), [1, 2, 3]);
  assert.deepEqual(evalExpr('values(obj)', { obj: { a: 1, b: 2 } }), [1, 2]);
  assert.deepEqual(evalExpr('entries(obj)', { obj: { a: 1 } }), [['a', 1]]);
  assert.equal(evalExpr('get(obj, "missing", 42)', { obj: { a: 1 } }), 42);
  assert.equal(evalExpr('has(obj, "a")', { obj: { a: 1 } }), true);
  assert.deepEqual(evalExpr('merge(a, b)', { a: { x: 1 }, b: { y: 2 } }), { x: 1, y: 2 });
  assert.deepEqual(evalExpr('pick(obj, "a", "c")', { obj: { a: 1, b: 2, c: 3 } }), { a: 1, c: 3 });
  assert.deepEqual(evalExpr('pick(obj, ["a", "c"])', { obj: { a: 1, b: 2, c: 3 } }), { a: 1, c: 3 });
  assert.deepEqual(evalExpr('omit(obj, "b")', { obj: { a: 1, b: 2, c: 3 } }), { a: 1, c: 3 });
  assert.equal(evalExpr('clamp(n, 0, 10)', { n: 15 }), 10);
  assert.equal(evalExpr('sign(n)', { n: -5 }), -1);
  assert.equal(evalExpr('trunc(n)', { n: 3.9 }), 3);
  assert.equal(evalExpr('coalesce(a, b)', { a: null, b: 7 }), 7);
  assert.deepEqual(
    evalExpr('sortBy(users, "age")', {
      users: [{ id: 2, age: 30 }, { id: 1, age: 10 }]
    }),
    [{ id: 1, age: 10 }, { id: 2, age: 30 }]
  );
  assert.deepEqual(
    evalExpr('sortBy(users, "age", "desc")', {
      users: [{ id: 1, age: 10 }, { id: 2, age: 30 }]
    }),
    [{ id: 2, age: 30 }, { id: 1, age: 10 }]
  );
});

test('trailing commas are allowed', () => {
  assert.deepEqual(evalExpr('[1, 2, 3,]', {}), [1, 2, 3]);
  assert.equal(evalExpr('sum(1, 2, 3,)', {}), 6);
});

test('flatten handles deeply nested arrays', () => {
  let value = 1;
  for (let i = 0; i < 5000; i += 1) {
    value = [value];
  }
  assert.deepEqual(evalExpr('flatten(value, 5000)', { value }), [1]);
});

test('sum handles deeply nested arrays', () => {
  let value = 1;
  for (let i = 0; i < 5000; i += 1) {
    value = [value];
  }
  assert.equal(evalExpr('sum(value)', { value }), 1);
});

test('unique handles large primitive arrays', () => {
  const values = Array.from({ length: 20000 }, (_, index) => index % 5000);
  assert.equal(evalExpr('unique(values)', { values }).length, 5000);
});
