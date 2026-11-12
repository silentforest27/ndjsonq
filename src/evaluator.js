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
      if (escaped === 'u') {
        const hex = inner.slice(i + 2, i + 6);
        if (/^[0-9a-fA-F]{4}$/.test(hex)) {
          result += String.fromCharCode(parseInt(hex, 16));
          i += 5;
          continue;
        }
      }
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
      const wasQuoted =
        value.length >= 2 &&
        ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'")));
      if (wasQuoted) {
        value = unescapeBracketValue(value);
      }
      if (value !== '' || wasQuoted) {
        segments.push(value);
      }
      continue;
    }

    const start = i;
    while (i < length && input[i] !== '.' && input[i] !== '[') {
      i += 1;
    }
    const segment = input.slice(start, i).trim();
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
    } else if (typeof current === 'string' && /^\d+$/.test(part)) {
      const index = Number(part);
      current = index >= 0 && index < current.length ? current[index] : undefined;
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
  if (
    parts.some(
      (part) =>
        part === '__proto__' ||
        part === 'constructor' ||
        part === 'prototype'
    )
  ) {
    return;
  }
  let current = record;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const part = parts[i];
    const next = parts[i + 1];
    const hasOwn = Object.prototype.hasOwnProperty.call(current, part);
    if (!hasOwn || current[part] == null || typeof current[part] !== 'object') {
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

function collectValues(args) {
  const values = [];
  function visit(value) {
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
    } else {
      values.push(value);
    }
  }
  for (const arg of args) visit(arg);
  return values;
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

function compareSort(a, b) {
  if (a === b) return 0;
  if (a == null) return b == null ? 0 : -1;
  if (b == null) return 1;
  if (typeof a === 'number' && typeof b === 'number') {
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
  }
  if (typeof a === 'boolean' && typeof b === 'boolean') {
    if (a === b) return 0;
    return a ? 1 : -1;
  }
  const left = String(a);
  const right = String(b);
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function flattenArray(value, depth) {
  if (!Array.isArray(value)) {
    return value == null ? [] : [value];
  }
  if (depth <= 0) return [...value];
  const result = [];
  for (const item of value) {
    if (Array.isArray(item)) {
      result.push(...flattenArray(item, depth - 1));
    } else {
      result.push(item);
    }
  }
  return result;
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
    case 'trimStart':
    case 'trimLeft':
      return typeof args[0] === 'string' ? args[0].trimStart() : args[0];
    case 'trimEnd':
    case 'trimRight':
      return typeof args[0] === 'string' ? args[0].trimEnd() : args[0];
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
    case 'floor':
      return Math.floor(toNumber(args[0]));
    case 'ceil':
      return Math.ceil(toNumber(args[0]));
    case 'round': {
      const value = toNumber(args[0]);
      const decimals = args.length > 1 ? Math.trunc(toNumber(args[1])) : 0;
      if (decimals <= 0) return Math.round(value);
      const factor = 10 ** decimals;
      return Math.round(value * factor) / factor;
    }
    case 'pow':
      return Math.pow(toNumber(args[0]), toNumber(args[1]));
    case 'sqrt':
      return Math.sqrt(toNumber(args[0]));
    case 'sign':
      return Math.sign(toNumber(args[0]));
    case 'trunc':
      return Math.trunc(toNumber(args[0]));
    case 'clamp': {
      const value = toNumber(args[0]);
      const min = args.length > 1 ? toNumber(args[1]) : value;
      const max = args.length > 2 ? toNumber(args[2]) : value;
      return Math.min(Math.max(value, min), max);
    }
    case 'min': {
      const values = collectValues(args);
      if (values.length === 0) return Math.min();
      return Math.min(...values.map(toNumber));
    }
    case 'max': {
      const values = collectValues(args);
      if (values.length === 0) return Math.max();
      return Math.max(...values.map(toNumber));
    }
    case 'keys':
      return args[0] && typeof args[0] === 'object' ? Object.keys(args[0]) : [];
    case 'values': {
      const value = args[0];
      if (Array.isArray(value)) return [...value];
      if (value && typeof value === 'object') return Object.values(value);
      return [];
    }
    case 'entries': {
      const value = args[0];
      if (Array.isArray(value)) return value.map((item, index) => [index, item]);
      if (value && typeof value === 'object') return Object.entries(value);
      return [];
    }
    case 'get': {
      const target = args[0];
      const key = args.length > 1 ? args[1] : undefined;
      if (Array.isArray(target)) {
        const index = Math.trunc(toNumber(key));
        if (index >= 0 && index < target.length) return target[index];
      } else if (target && typeof target === 'object') {
        const property = String(key == null ? '' : key);
        if (Object.prototype.hasOwnProperty.call(target, property)) {
          return target[property];
        }
      }
      return args.length > 2 ? args[2] : undefined;
    }
    case 'has': {
      const target = args[0];
      const key = args.length > 1 ? args[1] : undefined;
      if (Array.isArray(target)) {
        const index = Math.trunc(toNumber(key));
        return index >= 0 && index < target.length;
      }
      if (target && typeof target === 'object') {
        return Object.prototype.hasOwnProperty.call(
          target,
          String(key == null ? '' : key)
        );
      }
      if (typeof target === 'string') {
        return target.includes(String(key == null ? '' : key));
      }
      return false;
    }
    case 'merge': {
      const result = {};
      for (const arg of args) {
        if (arg && typeof arg === 'object' && !Array.isArray(arg)) {
          Object.assign(result, arg);
        }
      }
      return result;
    }
    case 'coalesce': {
      for (const value of args) {
        if (value !== null && value !== undefined) return value;
      }
      return args.length ? args[args.length - 1] : null;
    }
    case 'includes':
    case 'contains':
      return contains(args[0], args[1]);
    case 'indexOf': {
      const collection = args[0];
      const value = args[1];
      if (Array.isArray(collection)) {
        return collection.findIndex((item) => deepEqual(item, value));
      }
      if (typeof collection === 'string') {
        return collection.indexOf(String(value == null ? '' : value));
      }
      if (collection && typeof collection === 'object') {
        return Object.keys(collection).indexOf(String(value == null ? '' : value));
      }
      return -1;
    }
    case 'startsWith': {
      const text = args[0] == null ? '' : String(args[0]);
      const value = args[1] == null ? '' : String(args[1]);
      return text.startsWith(value);
    }
    case 'endsWith': {
      const text = args[0] == null ? '' : String(args[0]);
      const value = args[1] == null ? '' : String(args[1]);
      return text.endsWith(value);
    }
    case 'replace': {
      const text = args[0] == null ? '' : String(args[0]);
      const search = args.length > 1 && args[1] != null ? String(args[1]) : '';
      const replacement =
        args.length > 2 && args[2] != null ? String(args[2]) : '';
      if (search === '') return text;
      return text.replace(search, replacement);
    }
    case 'replaceAll': {
      const text = args[0] == null ? '' : String(args[0]);
      const search = args.length > 1 && args[1] != null ? String(args[1]) : '';
      const replacement =
        args.length > 2 && args[2] != null ? String(args[2]) : '';
      if (search === '') return text;
      return text.split(search).join(replacement);
    }
    case 'repeat': {
      const text = args[0] == null ? '' : String(args[0]);
      const count = args.length > 1 ? Math.trunc(toNumber(args[1])) : 0;
      if (count <= 0) return '';
      return text.repeat(count);
    }
    case 'padStart': {
      const text = args[0] == null ? '' : String(args[0]);
      const length = args.length > 1 ? Math.trunc(toNumber(args[1])) : 0;
      const pad = args.length > 2 && args[2] != null ? String(args[2]) : ' ';
      return text.padStart(length, pad || ' ');
    }
    case 'padEnd': {
      const text = args[0] == null ? '' : String(args[0]);
      const length = args.length > 1 ? Math.trunc(toNumber(args[1])) : 0;
      const pad = args.length > 2 && args[2] != null ? String(args[2]) : ' ';
      return text.padEnd(length, pad || ' ');
    }
    case 'join': {
      const value = args[0];
      if (!Array.isArray(value)) return value == null ? '' : String(value);
      const separator =
        args.length > 1 && args[1] != null ? String(args[1]) : '';
      return value
        .map((item) => (item == null ? '' : String(item)))
        .join(separator);
    }
    case 'split': {
      const text = args[0] == null ? '' : String(args[0]);
      if (args.length < 2 || args[1] == null) return [text];
      return text.split(String(args[1]));
    }
    case 'slice': {
      const value = args[0];
      const start = args.length > 1 ? toNumber(args[1]) : 0;
      const end = args.length > 2 ? toNumber(args[2]) : undefined;
      if (typeof value === 'string') return value.slice(start, end);
      if (Array.isArray(value)) return value.slice(start, end);
      return value == null ? '' : String(value).slice(start, end);
    }
    case 'reverse': {
      const value = args[0];
      if (Array.isArray(value)) return [...value].reverse();
      if (typeof value === 'string') return [...value].reverse().join('');
      return value;
    }
    case 'sort': {
      if (!Array.isArray(args[0])) return [];
      const result = [...args[0]];
      const order = args.length > 1 ? args[1] : 'asc';
      const descending =
        order === 'desc' || order === false || order === -1;
      result.sort((a, b) => {
        const comparison = compareSort(a, b);
        return descending ? -comparison : comparison;
      });
      return result;
    }
    case 'unique':
    case 'distinct': {
      if (!Array.isArray(args[0])) return [];
      const result = [];
      for (const item of args[0]) {
        if (!result.some((existing) => deepEqual(existing, item))) {
          result.push(item);
        }
      }
      return result;
    }
    case 'flatten': {
      const depth = args.length > 1 ? Math.trunc(toNumber(args[1])) : 1;
      return flattenArray(args[0], depth);
    }
    case 'first':
    case 'head': {
      const value = args[0];
      if (Array.isArray(value)) return value.length ? value[0] : undefined;
      if (typeof value === 'string') {
        return value.length ? value[0] : undefined;
      }
      return undefined;
    }
    case 'last': {
      const value = args[0];
      if (Array.isArray(value)) {
        return value.length ? value[value.length - 1] : undefined;
      }
      if (typeof value === 'string') {
        return value.length ? value[value.length - 1] : undefined;
      }
      return undefined;
    }
    case 'tail': {
      const value = args[0];
      if (Array.isArray(value)) return value.slice(1);
      if (typeof value === 'string') return value.slice(1);
      return [];
    }
    case 'concat': {
      const result = [];
      for (const arg of args) {
        if (Array.isArray(arg)) {
          result.push(...arg);
        } else {
          result.push(arg);
        }
      }
      return result;
    }
    case 'range': {
      let start;
      let end;
      let step = 1;
      if (args.length === 1) {
        start = 0;
        end = toNumber(args[0]);
      } else {
        start = toNumber(args[0]);
        end = toNumber(args[1]);
        if (args.length > 2) step = toNumber(args[2]);
      }
      if (step === 0) step = 1;
      const result = [];
      if (step > 0) {
        for (let value = start; value < end; value += step) {
          result.push(value);
        }
      } else {
        for (let value = start; value > end; value += step) {
          result.push(value);
        }
      }
      return result;
    }
    case 'sum': {
      const values = collectValues(args);
      let total = 0;
      for (const item of values) total += toNumber(item);
      return total;
    }
    case 'avg': {
      const values = collectValues(args);
      if (values.length === 0) return 0;
      let total = 0;
      for (const item of values) total += toNumber(item);
      return total / values.length;
    }
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
    case 'ternary': {
      const condition = evaluateNode(node.condition, record);
      return truthy(condition)
        ? evaluateNode(node.consequent, record)
        : evaluateNode(node.alternate, record);
    }
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
