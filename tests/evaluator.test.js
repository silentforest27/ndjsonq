'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { deepEqual, getPath, project, splitPath } = require('../src/evaluator');

test('deepEqual compares object keys in any order', () => {
  assert.equal(deepEqual({ a: 1, b: 2 }, { b: 2, a: 1 }), true);
  assert.equal(deepEqual({ a: 1 }, { a: 2 }), false);
  assert.equal(deepEqual([1, 2], [1, 2]), true);
});

test('deepEqual handles null and undefined consistently', () => {
  assert.equal(deepEqual(null, undefined), true);
  assert.equal(deepEqual(undefined, null), true);
  assert.equal(deepEqual(null, 0), false);
});

test('deepEqual handles deeply nested structures without stack overflow', () => {
  function nest(depth, leaf = 1) {
    let result = leaf;
    for (let i = 0; i < depth; i += 1) {
      result = [result];
    }
    return result;
  }

  const left = nest(5000);
  const right = nest(5000);
  const different = nest(5000, 2);

  assert.equal(deepEqual(left, right), true);
  assert.equal(deepEqual(left, different), false);
});

test('getPath resolves nested and array paths', () => {
  const record = { user: { scores: [10, 20] } };
  assert.equal(getPath(record, 'user.scores.1'), 20);
  assert.equal(getPath(record, 'user.missing'), undefined);
});

test('getPath resolves bracket and quoted paths', () => {
  const record = { items: [{ name: 'Ada' }], values: { 'dotted.key': 42 } };
  assert.equal(getPath(record, 'items[0].name'), 'Ada');
  assert.equal(getPath(record, "values['dotted.key']"), 42);
});

test('splitPath breaks paths into segments', () => {
  assert.deepEqual(splitPath('a.b[2].c'), ['a', 'b', '2', 'c']);
  assert.deepEqual(splitPath("items[0]['nested.key']"), ['items', '0', 'nested.key']);
});

test('splitPath trims whitespace around segments', () => {
  assert.deepEqual(splitPath('a . b [ 0 ] . c'), ['a', 'b', '0', 'c']);
});

test('splitPath unescapes unicode escapes in bracketed paths', () => {
  assert.deepEqual(splitPath("values['\\u0041']"), ['values', 'A']);
});

test('splitPath preserves text after a unicode escape in bracketed paths', () => {
  assert.deepEqual(splitPath("values['\\u0041tail']"), ['values', 'Atail']);
  assert.deepEqual(splitPath("values['\\u0041\\u0042']"), ['values', 'AB']);
});

test('project copies selected nested fields', () => {
  const record = { id: 1, user: { name: 'Ada', secret: 'x' } };
  assert.deepEqual(project(record, ['id', 'user.name']), { id: 1, user: { name: 'Ada' } });
});
