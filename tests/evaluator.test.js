'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { deepEqual, getPath, project } = require('../src/evaluator');

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

test('project copies selected nested fields', () => {
  const record = { id: 1, user: { name: 'Ada', secret: 'x' } };
  assert.deepEqual(project(record, ['id', 'user.name']), { id: 1, user: { name: 'Ada' } });
});
