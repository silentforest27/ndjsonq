'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { deepEqual, getPath, project, splitPath } = require('../src/evaluator');

test('deepEqual compares object keys in any order', () => {
  assert.equal(deepEqual({ a: 1, b: 2 }, { b: 2, a: 1 }), true);
  assert.equal(deepEqual({ a: 1 }, { a: 2 }), false);
  assert.equal(deepEqual([1, 2], [1, 2]), true);
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

test('project copies selected nested fields', () => {
  const record = { id: 1, user: { name: 'Ada', secret: 'x' } };
  assert.deepEqual(project(record, ['id', 'user.name']), { id: 1, user: { name: 'Ada' } });
});
