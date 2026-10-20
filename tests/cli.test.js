'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const BIN = path.join(__dirname, '..', 'bin', 'ndjsonq.js');

function runCli(args, input) {
  return spawnSync(process.execPath, [BIN, ...args], {
    input,
    encoding: 'utf8'
  });
}

test('filters and selects records', () => {
  const input = [
    JSON.stringify({ id: 1, age: 17, status: 'active' }),
    JSON.stringify({ id: 2, age: 20, status: 'active' }),
    JSON.stringify({ id: 3, age: 30, status: 'inactive' })
  ].join('\n');
  const result = runCli(['--select', 'id,age', 'age >= 18 && status == "active"'], input);
  assert.equal(result.status, 0);
  assert.equal(result.stdout, '{"id":2,"age":20}\n');
});

test('counts matching records', () => {
  const input = [
    JSON.stringify({ value: 1 }),
    JSON.stringify({ value: 2 }),
    JSON.stringify({ value: 3 })
  ].join('\n');
  const result = runCli(['--count', 'value > 1'], input);
  assert.equal(result.status, 0);
  assert.equal(result.stdout, '2\n');
});

test('reads a file and limits output', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ndjsonq-'));
  const file = path.join(directory, 'data.ndjson');
  fs.writeFileSync(
    file,
    [
      JSON.stringify({ id: 1 }),
      JSON.stringify({ id: 2 }),
      JSON.stringify({ id: 3 })
    ].join('\n') + '\n'
  );
  const result = runCli(['--limit', '2', file]);
  assert.equal(result.status, 0);
  assert.equal(result.stdout, '{"id":1}\n{"id":2}\n');
  fs.rmSync(directory, { recursive: true, force: true });
});

test('reads a file with a trailing expression', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ndjsonq-'));
  const file = path.join(directory, 'data.ndjson');
  fs.writeFileSync(
    file,
    [
      JSON.stringify({ id: 1 }),
      JSON.stringify({ id: 2 }),
      JSON.stringify({ id: 3 })
    ].join('\n') + '\n'
  );
  const result = runCli([file, 'id > 1']);
  assert.equal(result.status, 0);
  assert.equal(result.stdout, '{"id":2}\n{"id":3}\n');
  fs.rmSync(directory, { recursive: true, force: true });
});

test('reports invalid JSON and exits nonzero', () => {
  const result = runCli([], '{not json}\n');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /invalid JSON/);
});

test('pretty-prints records', () => {
  const input = JSON.stringify({ id: 2, age: 20 });
  const result = runCli(['--format', 'pretty'], input);
  assert.equal(result.status, 0);
  assert.equal(result.stdout, '{\n  "id": 2,\n  "age": 20\n}\n');
});

test('skips matching records with offset', () => {
  const input = [
    JSON.stringify({ id: 1 }),
    JSON.stringify({ id: 2 }),
    JSON.stringify({ id: 3 })
  ].join('\n');
  const result = runCli(['--offset', '1'], input);
  assert.equal(result.status, 0);
  assert.equal(result.stdout, '{"id":2}\n{"id":3}\n');
});
