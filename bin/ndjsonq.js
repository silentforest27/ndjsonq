#!/usr/bin/env node
'use strict';

const { run } = require('../src/query');

run(process.argv.slice(2))
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    process.stderr.write(`ndjsonq: ${error.message}\n`);
    process.exitCode = 1;
  });
