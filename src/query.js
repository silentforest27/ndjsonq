'use strict';

const fs = require('fs');
const readline = require('readline');
const { parseExpression } = require('./parser');
const { evaluate, truthy, project } = require('./evaluator');

function longName(short) {
  return {
    w: 'where',
    s: 'select',
    f: 'format',
    n: 'limit',
    c: 'count',
    h: 'help',
    v: 'version',
    o: 'offset'
  }[short] || short;
}

function setOption(opts, name, value) {
  switch (name) {
    case 'where':
    case 'w':
      opts.where = value;
      break;
    case 'select':
    case 's':
    case 'fields':
      opts.select = value;
      break;
    case 'format':
    case 'f':
      opts.format = value;
      break;
    case 'limit':
    case 'n':
      opts.limit = value;
      break;
    case 'offset':
    case 'o':
      opts.offset = value;
      break;
    case 'count':
    case 'c':
      opts.count = true;
      break;
    case 'help':
    case 'h':
      opts.help = true;
      break;
    case 'version':
    case 'v':
      opts.version = true;
      break;
    default:
      throw new Error(`Unknown option: --${name}`);
  }
}

function parseArgs(argv) {
  const opts = { format: 'jsonl', count: false };
  const positionals = [];
  let i = 0;

  while (i < argv.length) {
    const arg = argv[i];
    if (arg === '--') {
      positionals.push(...argv.slice(i + 1));
      break;
    }

    if (arg.startsWith('--')) {
      const equals = arg.indexOf('=');
      if (equals >= 0) {
        setOption(opts, arg.slice(2, equals), arg.slice(equals + 1));
        i += 1;
      } else {
        const name = arg.slice(2);
        if (name === 'count' || name === 'help' || name === 'version') {
          setOption(opts, name, true);
          i += 1;
        } else {
          i += 1;
          if (i >= argv.length) throw new Error(`Missing value for --${name}`);
          setOption(opts, name, argv[i]);
          i += 1;
        }
      }
    } else if (arg.startsWith('-') && arg.length > 1) {
      const name = longName(arg.slice(1));
      if (name === 'count' || name === 'help' || name === 'version') {
        setOption(opts, name, true);
        i += 1;
      } else {
        i += 1;
        if (i >= argv.length) throw new Error(`Missing value for -${arg.slice(1)}`);
        setOption(opts, name, argv[i]);
        i += 1;
      }
    } else {
      positionals.push(arg);
      i += 1;
    }
  }

  if (opts.where && positionals.length > 0) {
    opts.file = positionals[0];
  } else if (!opts.where) {
    if (positionals.length >= 2) {
      const [first, second] = positionals;
      if (fs.existsSync(first) && !fs.existsSync(second)) {
        opts.file = first;
        opts.where = second;
      } else if (!fs.existsSync(first) && fs.existsSync(second)) {
        opts.file = second;
        opts.where = first;
      } else {
        opts.file = first;
        opts.where = second;
      }
    } else if (positionals.length === 1) {
      if (fs.existsSync(positionals[0])) {
        opts.file = positionals[0];
      } else {
        opts.where = positionals[0];
      }
    }
  }
  if (positionals.length > 2) {
    throw new Error('Too many positional arguments');
  }

  if (opts.limit === undefined) {
    opts.limit = Infinity;
  } else {
    const value = Number(opts.limit);
    if (!Number.isFinite(value) || value < 0) {
      throw new Error('Invalid --limit value');
    }
    opts.limit = value;
  }

  if (opts.offset === undefined) {
    opts.offset = 0;
  } else {
    const value = Number(opts.offset);
    if (!Number.isFinite(value) || value < 0) {
      throw new Error('Invalid --offset value');
    }
    opts.offset = value;
  }

  const formats = new Set(['jsonl', 'compact', 'pretty']);
  if (!formats.has(opts.format)) {
    throw new Error(`Invalid --format value: ${opts.format}`);
  }

  return opts;
}

function printHelp() {
  process.stdout.write(
    `Usage: ndjsonq [file] [where] [options]\n` +
      `       ndjsonq --where EXPR [file] [options]\n\n` +
      `Filter, project, and format newline-delimited JSON (NDJSON) records.\n\n` +
      `Options:\n` +
      `  -w, --where EXPR       Filter expression. Records are kept when EXPR is truthy.\n` +
      `  -s, --select FIELDS    Comma-separated fields to include in each output record.\n` +
      `  -n, --limit COUNT      Maximum number of records to emit.\n` +
      `      --offset COUNT      Number of matching records to skip.\n` +
      `  -f, --format FORMAT    Output format: jsonl (default), compact, or pretty.\n` +
      `  -c, --count            Print only the number of matching records.\n` +
      `  -h, --help             Show this help.\n` +
      `  -v, --version          Show version.\n\n` +
      `Expression examples:\n` +
      `  ndjsonq data.ndjson 'age >= 18 && status == "active"'\n` +
      `  ndjsonq --select id,name --limit 10 data.ndjson\n` +
      `  cat data.ndjson | ndjsonq 'user.role == "admin"'\n\n` +
      `Expression language:\n` +
      `  Paths: user.name, items[0]\n` +
      `  Operators: == != < <= > >= && || ! + - * / %\n` +
      `  Membership: value in array, substring in string, key in object\n` +
      `  Literals: numbers, strings, booleans, null, and arrays\n` +
      `  Functions: length, lower, upper, trim, exists, type, number, string,\n` +
      `             abs, min, max, keys, contains, includes\n`
  );
}

function printVersion() {
  const pkg = require('../package.json');
  process.stdout.write(`${pkg.version}\n`);
}

function formatRecord(value, format) {
  return format === 'pretty'
    ? JSON.stringify(value, null, 2)
    : JSON.stringify(value);
}

async function run(argv) {
  const opts = parseArgs(argv);

  if (opts.help) {
    printHelp();
    return 0;
  }
  if (opts.version) {
    printVersion();
    return 0;
  }

  const whereNode = opts.where ? parseExpression(opts.where) : null;
  const selectFields = opts.select
    ? opts.select.split(',').map((field) => field.trim()).filter(Boolean)
    : null;

  const projectRecord = (record) =>
    selectFields ? project(record, selectFields) : record;

  if (opts.count) {
    const input = opts.file ? fs.createReadStream(opts.file) : process.stdin;
    const rl = readline.createInterface({ input, crlfDelay: Infinity });
    let count = 0;

    for await (const line of rl) {
      if (line.trim() === '') continue;
      let record;
      try {
        record = JSON.parse(line);
      } catch (error) {
        throw new Error(`invalid JSON: ${error.message}`);
      }
      if (whereNode && !truthy(evaluate(whereNode, record))) continue;
      count += 1;
    }

    process.stdout.write(`${count}\n`);
    return 0;
  }

  const input = opts.file ? fs.createReadStream(opts.file) : process.stdin;
  const rl = readline.createInterface({ input, crlfDelay: Infinity });
  let matching = 0;
  let emitted = 0;

  for await (const line of rl) {
    if (line.trim() === '') continue;
    let record;
    try {
      record = JSON.parse(line);
    } catch (error) {
      throw new Error(`invalid JSON: ${error.message}`);
    }
    if (whereNode && !truthy(evaluate(whereNode, record))) continue;

    matching += 1;
    if (matching <= opts.offset) continue;
    if (emitted >= opts.limit) break;

    process.stdout.write(`${formatRecord(projectRecord(record), opts.format)}\n`);
    emitted += 1;
  }

  return 0;
}

module.exports = { run };
