#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const readline = require('node:readline');

const { parseExpression } = require('./parser');
const { evaluate, truthy, project } = require('./evaluator');
const { version } = require('../package.json');

const USAGE = `Usage: ndjsonq [options] [file] [expression]

Filter, project, and format newline-delimited JSON records.

Options:
  --select FIELDS   Comma-separated fields to include in output
  --format FORMAT   Output format: json, compact, or pretty
  --limit N         Maximum number of matching records to output
  --offset N        Number of matching records to skip
  --skip N          Alias for --offset
  --count           Count matching records instead of printing them
  -V, --version     Show version number
  -h, --help        Show this help message

Reads from standard input when no file is given or when file is "-".
`;

function takeValue(argv, index, name) {
  if (index + 1 >= argv.length) {
    throw new Error(`Missing value for ${name}`);
  }
  return argv[index + 1];
}

function parseNonNegativeInteger(name, value) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) {
    throw new Error(`Invalid ${name} value`);
  }
  return number;
}

function splitSelect(input) {
  const fields = [];
  let current = '';
  let depth = 0;
  let quote = null;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];

    if (quote) {
      current += char;
      if (char === '\\' && i + 1 < input.length) {
        current += input[i + 1];
        i += 1;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      current += char;
      continue;
    }

    if (char === '[') {
      depth += 1;
      current += char;
      continue;
    }

    if (char === ']' && depth > 0) {
      depth -= 1;
      current += char;
      continue;
    }

    if (char === ',' && depth === 0) {
      if (current.trim() !== '') {
        fields.push(current.trim());
      }
      current = '';
      continue;
    }

    current += char;
  }

  if (current.trim() !== '') {
    fields.push(current.trim());
  }

  return fields;
}

function parseArgs(argv) {
  const options = {
    select: null,
    format: 'json',
    limit: null,
    offset: 0,
    count: false,
    version: false,
    help: false
  };
  const positionals = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--') {
      positionals.push(...argv.slice(i + 1));
      break;
    }

    if (arg === '-h' || arg === '--help') {
      options.help = true;
      continue;
    }

    if (arg === '-V' || arg === '--version') {
      options.version = true;
      continue;
    }

    if (arg === '-c' || arg === '--count') {
      options.count = true;
      continue;
    }

    if (arg === '-s' || arg === '--select') {
      options.select = takeValue(argv, i, '--select');
      i += 1;
      continue;
    }

    if (arg.startsWith('--select=')) {
      options.select = arg.slice('--select='.length);
      continue;
    }

    if (arg === '-f' || arg === '--format') {
      options.format = takeValue(argv, i, '--format');
      i += 1;
      continue;
    }

    if (arg.startsWith('--format=')) {
      options.format = arg.slice('--format='.length);
      continue;
    }

    if (arg === '-l' || arg === '--limit') {
      options.limit = parseNonNegativeInteger(
        '--limit',
        takeValue(argv, i, '--limit')
      );
      i += 1;
      continue;
    }

    if (arg.startsWith('--limit=')) {
      options.limit = parseNonNegativeInteger(
        '--limit',
        arg.slice('--limit='.length)
      );
      continue;
    }

    if (arg === '-o' || arg === '--offset' || arg === '--skip') {
      options.offset = parseNonNegativeInteger(
        arg.startsWith('--skip') ? '--skip' : '--offset',
        takeValue(argv, i, arg)
      );
      i += 1;
      continue;
    }

    if (arg.startsWith('--offset=') || arg.startsWith('--skip=')) {
      const name = arg.startsWith('--offset=') ? '--offset' : '--skip';
      options.offset = parseNonNegativeInteger(
        name,
        arg.slice(name.length + 1)
      );
      continue;
    }

    if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}`);
    }

    positionals.push(arg);
  }

  if (positionals.length > 2) {
    throw new Error('Too many positional arguments');
  }

  return { options, positionals };
}

function resolvePositionals(positionals) {
  let filePath = null;
  let expression = null;

  for (const positional of positionals) {
    if (positional === '-' || fs.existsSync(positional)) {
      if (filePath !== null) {
        throw new Error('Too many positional arguments');
      }
      filePath = positional;
    } else {
      if (expression !== null) {
        throw new Error('Too many positional arguments');
      }
      expression = positional;
    }
  }

  return { filePath, expression };
}

async function run(argv) {
  try {
    const { options, positionals } = parseArgs(argv);

    if (options.help) {
      process.stdout.write(USAGE);
      return 0;
    }

    if (options.version) {
      process.stdout.write(`${version}\n`);
      return 0;
    }

    if (options.format !== 'json' &&
        options.format !== 'compact' &&
        options.format !== 'pretty') {
      throw new Error('Invalid --format value');
    }

    const { filePath, expression } = resolvePositionals(positionals);
    const filter = expression ? parseExpression(expression) : null;
    const fields =
      options.select === null ? null : splitSelect(options.select);

    if (options.select !== null && (!fields || fields.length === 0)) {
      throw new Error('Invalid --select value');
    }

    const input =
      filePath === null || filePath === '-'
        ? process.stdin
        : fs.createReadStream(filePath, { encoding: 'utf8' });

    const rl = readline.createInterface({
      input,
      crlfDelay: Infinity
    });

    let count = 0;
    let matched = 0;
    let outputCount = 0;
    let isFirstLine = true;

    try {
      for await (const rawLine of rl) {
        const line = isFirstLine
          ? rawLine.replace(/^\uFEFF/, '')
          : rawLine;
        isFirstLine = false;

        if (line.trim() === '') {
          continue;
        }

        let record;
        try {
          record = JSON.parse(line);
        } catch {
          throw new Error('invalid JSON');
        }

        const isMatch = filter ? truthy(evaluate(filter, record)) : true;
        if (!isMatch) {
          continue;
        }

        count += 1;

        if (options.count) {
          continue;
        }

        matched += 1;
        if (matched <= options.offset) {
          if (
            options.limit !== null &&
            matched >= options.offset + options.limit
          ) {
            break;
          }
          continue;
        }

        if (options.limit !== null && outputCount >= options.limit) {
          break;
        }

        const output = fields ? project(record, fields) : record;
        const text =
          options.format === 'pretty'
            ? JSON.stringify(output, null, 2)
            : JSON.stringify(output);
        process.stdout.write(`${text}\n`);
        outputCount += 1;

        if (options.limit !== null && outputCount >= options.limit) {
          break;
        }
      }
    } finally {
      rl.close();
      if (input !== process.stdin) {
        input.destroy();
      }
    }

    if (options.count) {
      process.stdout.write(`${count}\n`);
    }

    return 0;
  } catch (error) {
    process.stderr.write(
      `ndjsonq: ${error && error.message ? error.message : error}\n`
    );
    return 1;
  }
}

module.exports = { run };
