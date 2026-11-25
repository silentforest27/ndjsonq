'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseExpression } = require('../src/parser');
const { evaluate } = require('../src/evaluator');

function evalExpr(expression, record) {
  return evaluate(parseExpression(expression), record);
}

test('grouping and keying helpers', () => {
  assert.deepEqual(
    evalExpr('groupBy(users, "role")', {
      users: [{ id: 1, role: 'admin' }, { id: 2, role: 'user' }, { id: 3, role: 'admin' }]
    }),
    { admin: [{ id: 1, role: 'admin' }, { id: 3, role: 'admin' }], user: [{ id: 2, role: 'user' }] }
  );
  assert.deepEqual(
    evalExpr('countBy(users, "role")', {
      users: [{ role: 'admin' }, { role: 'user' }, { role: 'admin' }]
    }),
    { admin: 2, user: 1 }
  );
  assert.deepEqual(
    evalExpr('keyBy(users, "id")', {
      users: [{ id: 1, name: 'Ada' }, { id: 2, name: 'Bob' }]
    }),
    { '1': { id: 1, name: 'Ada' }, '2': { id: 2, name: 'Bob' } }
  );
});

test('collection helpers', () => {
  assert.deepEqual(evalExpr('chunk(values, 2)', { values: [1, 2, 3, 4] }), [[1, 2], [3, 4]]);
  assert.deepEqual(evalExpr('zip(a, b)', { a: [1, 2], b: ['x', 'y'] }), [[1, 'x'], [2, 'y']]);
  assert.deepEqual(evalExpr('compact(values)', { values: [0, 1, false, 2, null, 3] }), [1, 2, 3]);
  assert.deepEqual(evalExpr('take(values, 2)', { values: [1, 2, 3] }), [1, 2]);
  assert.equal(evalExpr('nth(values, -1)', { values: [1, 2, 3] }), 3);
  assert.deepEqual(evalExpr('difference(values, [2])', { values: [1, 2, 2, 3] }), [1, 3]);
  assert.deepEqual(evalExpr('intersection(a, b)', { a: [1, 2, 2], b: [2, 3] }), [2]);
  assert.deepEqual(evalExpr('union(a, b)', { a: [1, 2], b: [2, 3] }), [1, 2, 3]);
});

test('membership and helper aliases', () => {
  assert.equal(evalExpr('\"admin\" not in roles', { roles: ['user', 'guest'] }), true);
  assert.equal(evalExpr('sumBy(users, \"score\")', { users: [{ score: 1 }, { score: 2 }] }), 3);
  assert.equal(evalExpr('get(text, 1)', { text: 'abc' }), 'b');
  assert.equal(evalExpr('size(text)', { text: 'abc' }), 3);
});
