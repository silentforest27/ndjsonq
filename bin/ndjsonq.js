#!/usr/bin/env node
'use strict';

process.stdout.on('error', (error) => {
  if (error && error.code === 'EPIPE') {
    process.exit(0);
    return;
  }
  process.stderr.write(`ndjsonq: ${error && error.message ? error.message : error}\n`);
  process.exit(1);
});

const { run } = require('../src/query');

run(process.argv.slice(2))
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    process.stderr.write(`ndjsonq: ${error.message}\n`);
    process.exitCode = 1;
  });
