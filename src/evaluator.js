'use strict';

function truthy(value) {
  return (
    value !== null &&
    value !== undefined &&
    value !== false &&
    value !== 0 &&
    value !== '' &&
    !Number.isNaN(value)
  );
}

function unescapeBracketValue(value) {
  const inner = value.slice(1, -1);
  const escapes = {
    n: '\n',
    t: '\t',
    r: '\r',
    b: '\b',
    f: '\f',
    v: '\v',
    '"': '"',
    "'": "'",
    '\\': '\\'
  };
  let result = '';
  for (let i = 0; i < inner.length; i += 1) {
    const char = inner[i];
    if (char === '\\' && i + 1 < inner.length) {
      const escaped = inner[i + 1];
      result += Object.prototype.hasOwnProperty.call(escapes, escaped)
        ? escapes[escaped]
        : escaped;
      i += 1;
    } else {
      result += char;
    }
  }
  return result;
}

function splitPath(path) {
  const segments = [];
  const input = String(path);
  const length = input.length;
  let i = 0;

  while (i < length) {
    if (input[i] === '.') {
      i += 1;
      continue;
    }

    if (input[i] === '[') {
      i += 1;
      let depth = 1;
      let quote = null;
      let content = '';

      while (i < length && depth > 0) {
        const char = input[i];

        if (quote) {
          content += char;
          if (char === '\\' && i + 1 < length) {
            content += input[i + 1];
            i += 2;
            continue;
          }
          if (char === quote) {
            quote = null;
          }
          i += 1;
          continue;
        }

        if (char === '"' || char === "'") {
          quote = char;
          content += char;
          i += 1;
          continue;
        }

        if (char === '[') {
          depth += 1;
          content += char;
          i += 1;
          continue;
        }

        if (char === ']') {
          depth -= 1;
          if (depth === 0) {
            i += 1;
            break;
          }
          content += char;
          i += 1;
          continue;
        }

        content += char;
        i += 1;
      }

      let value = content.trim();
      if (
        value.length >= 2 &&
        ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'")))
      ) {
        value = unescapeBracketValue(value);
      }
      if (value !== '') {
        segments.push(value);
      }
      continue;
    }

    const start = i;
    while (i < length && input[i] !== '.' && input[i] !== '[') {
      i += 1;
    }
    const segment = input.slice(start, i);
    if (segment !== '') {
      segments.push(segment);
    }
  }

  return segments;
}

function getPath(record, path) {
  if (record == null) return undefined;
  let current = record;
  for (const part of splitPath(path)) {
    if (current == null) return undefined;
    if (Array.isArray(current) && /^\d+$/.test(part)) {
      current = current[Number(part)];
    } else if (typeof current === 'object') {
      if (Object.prototype.hasOwnProperty.call(current, part)) {
        current = current[part];
      } else {
        return undefined;
      }
    } else {
      return undefined;
    }
  }
  return current;
}

function setPath(record, path, value) {
  const parts = splitPath(path);
  if (parts.length === 0 || record == null || typeof record !== 'object') return;
  let current = record;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const part = parts[i];
    const next = parts[i + 1];
    if (current[part] == null || typeof current[part] !== 'object') {
      current[part] = /^\d+$/.test(next) ? [] : {};
    }
    current = current[part];
    if (current == null) return;
  }
  const last = parts[parts.length - 1];
  if (current != null && typeof current === 'object') {
    current[last] = value;
  }
}

function project(record, fields) {
  const output = {};
  for (const field of fields) {
    const value = getPath(record, field);
    if (value !== undefined) {
      setPath(output, field, value);
    }
  }
  return output;
}

function deepEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return a == b;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    return a.every((item, index) => deepEqual(item, b[index]));
  }
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every(
    (key) => Object.prototype.hasOwnProperty.call(b, key) && deepEqual(a[key], b[key])
  );
}

function toNumber(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (value == null) return 0;
  const number = Number(value);
  return Number.isNaN(number) ? 0 : number;
}

function compareLess(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return a < b;
  if (typeof a === 'string' && typeof b === 'string') return a < b;
  return false;
}

function compareGreater(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return a > b;
  if (typeof a === 'string' && typeof b === 'string') return a > b;
  return false;
}

function contains(collection, value) {
  if (Array.isArray(collection)) {
    return collection.some((item) => deepEqual(item, value));
  }
  if (typeof collection === 'string') {
    return collection.includes(String(value == null ? '' : value));
  }
  if (collection && typeof collection === 'object') {
    return Object.prototype.hasOwnProperty.call(collection, String(value));
  }
  return false;
}

function callFunction(name, args) {
  switch (name) {
    case 'length': {
      const value = args[0];
      if (Array.isArray(value) || typeof value === 'string') return value.length;
      if (value && typeof value === 'object') return Object.keys(value).length;
      return 0;
    }
    case 'lower':
      return typeof args[0] === 'string' ? args[0].toLowerCase() : args[0];
    case 'upper':
      return typeof args[0] === 'string' ? args[0].toUpperCase() : args[0];
    case 'trim':
      return typeof args[0] === 'string' ? args[0].trim() : args[0];
    case 'exists':
      return args[0] !== undefined && args[0] !== null;
    case 'type': {
      const value = args[0];
      if (value === null) return 'null';
      if (Array.isArray(value)) return 'array';
      return typeof value;
    }
    case 'number':
      return toNumber(args[0]);
    case 'string':
      return args[0] == null ? '' : String(args[0]);
    case 'abs':
      return Math.abs(toNumber(args[0]));
    case 'min':
      return Math.min(...args.map(toNumber));
    case 'max':
      return Math.max(...args.map(toNumber));
    case 'keys':
      return args[0] && typeof args[0] === 'object' ? Object.keys(args[0]) : [];
    case 'includes':
    case 'contains':
      return contains(args[0], args[1]);
    default:
      throw new Error(`Unknown function: ${name}`);
  }
}

function evaluateNode(node, record) {
  switch (node.type) {
    case 'literal':
      return node.value;
    case 'path':
      return getPath(record, node.value);
    case 'array':
      return node.items.map((item) => evaluateNode(item, record));
    case 'index': {
      const target = evaluateNode(node.target, record);
      const index = evaluateNode(node.index, record);
      if (target == null) return undefined;
      return target[index];
    }
    case 'member': {
      const target = evaluateNode(node.target, record);
      if (target == null) return undefined;
      return Object.prototype.hasOwnProperty.call(target, node.property)
        ? target[node.property]
        : undefined;
    }
    case 'neg':
      return -toNumber(evaluateNode(node.operand, record));
    case 'pos':
      return toNumber(evaluateNode(node.operand, record));
    case 'not':
      return !truthy(evaluateNode(node.operand, record));
    case 'bin': {
      const left = evaluateNode(node.left, record);
      const right = evaluateNode(node.right, record);
      switch (node.op) {
        case '+':
          if (typeof left === 'string' || typeof right === 'string') {
            return String(left == null ? '' : left) + String(right == null ? '' : right);
          }
          return toNumber(left) + toNumber(right);
        case '-':
          return toNumber(left) - toNumber(right);
        case '*':
          return toNumber(left) * toNumber(right);
        case '/':
          return toNumber(left) / toNumber(right);
        case '%':
          return toNumber(left) % toNumber(right);
        default:
          throw new Error(`Unknown operator: ${node.op}`);
      }
    }
    case 'cmp': {
      const left = evaluateNode(node.left, record);
      const right = evaluateNode(node.right, record);
      switch (node.op) {
        case '==':
          return deepEqual(left, right);
        case '!=':
          return !deepEqual(left, right);
        case 'in':
          return contains(right, left);
        case '<':
          return compareLess(left, right);
        case '<=':
          return compareLess(left, right) || deepEqual(left, right);
        case '>':
          return compareGreater(left, right);
        case '>=':
          return compareGreater(left, right) || deepEqual(left, right);
        default:
          throw new Error(`Unknown comparison: ${node.op}`);
      }
    }
    case 'and': {
      const left = evaluateNode(node.left, record);
      return truthy(left) ? evaluateNode(node.right, record) : left;
    }
    case 'or': {
      const left = evaluateNode(node.left, record);
      return truthy(left) ? left : evaluateNode(node.right, record);
    }
    case 'call': {
      const args = node.args.map((arg) => evaluateNode(arg, record));
      return callFunction(node.name, args);
    }
    default:
      throw new Error(`Unknown node type: ${node.type}`);
  }
}

function evaluate(node, record) {
  return evaluateNode(node, record);
}

module.exports = {
  evaluate,
  truthy,
  getPath,
  setPath,
  project,
  deepEqual,
  splitPath
};
