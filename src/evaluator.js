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
    } else if (typeof current === 'string') {
      if (/^\d+$/.test(part)) {
        const index = Number(part);
        current = index >= 0 && index < current.length ? current[index] : undefined;
      } else if (part === 'length') {
        current = current.length;
      } else {
        return undefined;
      }
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

function deepEqual(a, b, sameValue = false) {
  if (a === b) return true;
  if (sameValue && Number.isNaN(a) && Number.isNaN(b)) return true;
  const stack = [[a, b]];
  while (stack.length > 0) {
    const [left, right] = stack.pop();
    if (left === right) continue;
    if (sameValue && Number.isNaN(left) && Number.isNaN(right)) continue;
    if (left == null || right == null) {
      if (left == right) continue;
      return false;
    }
    if (typeof left !== typeof right || typeof left !== 'object') {
      return false;
    }
    if (Array.isArray(left) !== Array.isArray(right)) {
      return false;
    }
    if (Array.isArray(left)) {
      if (left.length !== right.length) return false;
      for (let i = 0; i < left.length; i += 1) {
        stack.push([left[i], right[i]]);
      }
    } else {
      const keysLeft = Object.keys(left);
      const keysRight = Object.keys(right);
      if (keysLeft.length !== keysRight.length) return false;
      for (const key of keysLeft) {
        if (!Object.prototype.hasOwnProperty.call(right, key)) return false;
        stack.push([left[key], right[key]]);
      }
    }
  }
  return true;
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
  const stack = [];
  for (let i = args.length - 1; i >= 0; i -= 1) {
    stack.push(args[i]);
  }
  while (stack.length > 0) {
    const value = stack.pop();
    if (Array.isArray(value)) {
      for (let i = value.length - 1; i >= 0; i -= 1) {
        stack.push(value[i]);
      }
    } else {
      values.push(value);
    }
  }
  return values;
}

function keyValueFor(item, key) {
  if (key == null) return item;
  if (typeof key === 'string') return getPath(item, key);
  if (typeof key === 'number' || typeof key === 'boolean') {
    return getPath(item, String(key));
  }
  return key;
}

function toInteger(value, fallback = 0) {
  if (value === undefined) return fallback;
  const number = Math.trunc(toNumber(value));
  return Number.isFinite(number) ? number : fallback;
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
    return collection.some((item) => deepEqual(item, value, true));
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
  if (depth <= 0) return value.slice();
  const result = [];
  const frames = [{ array: value, index: 0, depth }];
  while (frames.length > 0) {
    const frame = frames[frames.length - 1];
    if (frame.index >= frame.array.length) {
      frames.pop();
      continue;
    }
    const item = frame.array[frame.index];
    frame.index += 1;
    if (Array.isArray(item) && frame.depth > 0) {
      const nextDepth = frame.depth - 1;
      if (nextDepth <= 0) {
        for (let i = 0; i < item.length; i += 1) {
          result.push(item[i]);
        }
      } else {
        frames.push({ array: item, index: 0, depth: nextDepth });
      }
    } else {
      result.push(item);
    }
  }
  return result;
}

function callFunction(name, args) {
  switch (name) {
    case 'length':
    case 'size': {
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
      const min = args.length > 1 ? toNumber(args[1]) : -Infinity;
      const max = args.length > 2 ? toNumber(args[2]) : Infinity;
      return Math.min(Math.max(value, min), max);
    }
    case 'min': {
      const values = collectValues(args);
      if (values.length === 0) return Math.min();
      let min = toNumber(values[0]);
      for (let i = 1; i < values.length; i += 1) {
        const number = toNumber(values[i]);
        if (Number.isNaN(number)) {
          min = NaN;
        } else if (number < min) {
          min = number;
        }
      }
      return min;
    }
    case 'max': {
      const values = collectValues(args);
      if (values.length === 0) return Math.max();
      let max = toNumber(values[0]);
      for (let i = 1; i < values.length; i += 1) {
        const number = toNumber(values[i]);
        if (Number.isNaN(number)) {
          max = NaN;
        } else if (number > max) {
          max = number;
        }
      }
      return max;
    }
    case 'keys':
      return args[0] && typeof args[0] === 'object' ? Object.keys(args[0]) : [];
    case 'values': {
      const value = args[0];
      if (Array.isArray(value)) return value.slice();
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
        const property = String(key == null ? '' : key);
        if (/^\d+$/.test(property)) {
          const index = Number(property);
          if (index >= 0 && index < target.length) return target[index];
        } else if (Object.prototype.hasOwnProperty.call(target, property)) {
          return target[property];
        }
        return args.length > 2 ? args[2] : undefined;
      } else if (typeof target === 'string') {
        const property = String(key == null ? '' : key);
        if (/^\d+$/.test(property)) {
          const index = Number(property);
          if (index >= 0 && index < target.length) return target[index];
        } else if (property === 'length') {
          return target.length;
        }
        return args.length > 2 ? args[2] : undefined;
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
        const property = String(key == null ? '' : key);
        if (/^\d+$/.test(property)) {
          const index = Number(property);
          return index >= 0 && index < target.length;
        }
        return Object.prototype.hasOwnProperty.call(target, property);
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
          for (const key of Object.keys(arg)) {
            if (
              key === '__proto__' ||
              key === 'constructor' ||
              key === 'prototype'
            ) {
              continue;
            }
            result[key] = arg[key];
          }
        }
      }
      return result;
    }
    case 'pick': {
      const result = {};
      const target = args[0];
      if (target && typeof target === 'object' && !Array.isArray(target)) {
        for (const key of collectValues(args.slice(1))) {
          const property = String(key == null ? '' : key);
          if (
            property === '__proto__' ||
            property === 'constructor' ||
            property === 'prototype'
          ) {
            continue;
          }
          if (Object.prototype.hasOwnProperty.call(target, property)) {
            result[property] = target[property];
          }
        }
      }
      return result;
    }
    case 'omit': {
      const result = {};
      const target = args[0];
      if (target && typeof target === 'object' && !Array.isArray(target)) {
        const omitted = new Set(
          collectValues(args.slice(1)).map((key) =>
            String(key == null ? '' : key)
          )
        );
        for (const key of Object.keys(target)) {
          if (
            key === '__proto__' ||
            key === 'constructor' ||
            key === 'prototype' ||
            omitted.has(key)
          ) {
            continue;
          }
          result[key] = target[key];
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
    case 'groupBy': {
      const collection = Array.isArray(args[0]) ? args[0] : [];
      const key = args.length > 1 ? args[1] : null;
      const result = {};
      for (const item of collection) {
        const value = keyValueFor(item, key);
        const groupKey = value == null ? '' : String(value);
        if (!Object.prototype.hasOwnProperty.call(result, groupKey)) {
          result[groupKey] = [];
        }
        result[groupKey].push(item);
      }
      return result;
    }
    case 'countBy': {
      const collection = Array.isArray(args[0]) ? args[0] : [];
      const key = args.length > 1 ? args[1] : null;
      const result = {};
      for (const item of collection) {
        const value = keyValueFor(item, key);
        const groupKey = value == null ? '' : String(value);
        result[groupKey] = Object.prototype.hasOwnProperty.call(result, groupKey)
          ? result[groupKey] + 1
          : 1;
      }
      return result;
    }
    case 'keyBy': {
      const collection = Array.isArray(args[0]) ? args[0] : [];
      const key = args.length > 1 ? args[1] : null;
      const result = {};
      for (const item of collection) {
        const value = keyValueFor(item, key);
        const groupKey = value == null ? '' : String(value);
        result[groupKey] = item;
      }
      return result;
    }
    case 'uniq':
    case 'uniqBy':
    case 'unique':
    case 'distinct': {
      if (name === 'uniqBy') {
        if (!Array.isArray(args[0])) return [];
        const key = args.length > 1 ? args[1] : null;
        const result = [];
        const seen = [];
        for (const item of args[0]) {
          const value = keyValueFor(item, key);
          if (!seen.some((existing) => deepEqual(existing, value, true))) {
            seen.push(value);
            result.push(item);
          }
        }
        return result;
      }
      if (!Array.isArray(args[0])) return [];
      const result = [];
      const seen = new Set();
      const objects = [];
      for (const item of args[0]) {
        if (item !== null && typeof item === 'object') {
          if (!objects.some((existing) => deepEqual(existing, item, true))) {
            objects.push(item);
            result.push(item);
          }
        } else {
          const key = item === undefined ? null : item;
          if (seen.has(key)) continue;
          seen.add(key);
          result.push(item);
        }
      }
      return result;
    }
    case 'chunk': {
      if (!Array.isArray(args[0])) return [];
      const size = toInteger(args.length > 1 ? args[1] : 1, 1);
      if (size <= 0) return [];
      const result = [];
      for (let i = 0; i < args[0].length; i += size) {
        result.push(args[0].slice(i, i + size));
      }
      return result;
    }
    case 'zip': {
      const arrays = args.map((arg) =>
        Array.isArray(arg) ? arg : arg == null ? [] : [arg]
      );
      const length = arrays.reduce(
        (max, array) => Math.max(max, array.length),
        0
      );
      const result = [];
      for (let i = 0; i < length; i += 1) {
        result.push(
          arrays.map((array) => (i < array.length ? array[i] : undefined))
        );
      }
      return result;
    }
    case 'compact': {
      if (!Array.isArray(args[0])) return [];
      return args[0].filter((item) => truthy(item));
    }
    case 'difference': {
      if (!Array.isArray(args[0])) return [];
      const excluded = collectValues(args.slice(1));
      return args[0].filter(
        (item) =>
          !excluded.some((value) => deepEqual(value, item, true))
      );
    }
    case 'intersection': {
      const arrays = args.map((arg) => (Array.isArray(arg) ? arg : []));
      if (arrays.length === 0) return [];
      const result = [];
      const seen = [];
      for (const item of arrays[0]) {
        if (seen.some((existing) => deepEqual(existing, item, true))) continue;
        if (
          arrays
            .slice(1)
            .every((array) =>
              array.some((value) => deepEqual(value, item, true))
            )
        ) {
          seen.push(item);
          result.push(item);
        }
      }
      return result;
    }
    case 'union': {
      const result = [];
      const seen = [];
      for (const arg of args) {
        const values = Array.isArray(arg)
          ? arg
          : arg == null
          ? []
          : [arg];
        for (const item of values) {
          if (!seen.some((existing) => deepEqual(existing, item, true))) {
            seen.push(item);
            result.push(item);
          }
        }
      }
      return result;
    }
    case 'take': {
      if (!Array.isArray(args[0])) return [];
      const count = Math.max(
        0,
        toInteger(args.length > 1 ? args[1] : 1, 1)
      );
      return args[0].slice(0, count);
    }
    case 'drop': {
      if (!Array.isArray(args[0])) return [];
      const count = Math.max(
        0,
        toInteger(args.length > 1 ? args[1] : 1, 1)
      );
      return args[0].slice(count);
    }
    case 'takeRight': {
      if (!Array.isArray(args[0])) return [];
      const count = Math.max(
        0,
        toInteger(args.length > 1 ? args[1] : 1, 1)
      );
      if (count === 0) return [];
      return args[0].slice(-count);
    }
    case 'dropRight': {
      if (!Array.isArray(args[0])) return [];
      const count = Math.max(
        0,
        toInteger(args.length > 1 ? args[1] : 1, 1)
      );
      if (count === 0) return args[0].slice();
      return args[0].slice(0, args[0].length - count);
    }
    case 'initial': {
      if (!Array.isArray(args[0])) return [];
      return args[0].slice(0, -1);
    }
    case 'nth': {
      const collection = args[0];
      const index = toInteger(args.length > 1 ? args[1] : 0, 0);
      if (Array.isArray(collection)) {
        const position = index < 0 ? collection.length + index : index;
        return position >= 0 && position < collection.length
          ? collection[position]
          : undefined;
      }
      if (typeof collection === 'string') {
        const position = index < 0 ? collection.length + index : index;
        return position >= 0 && position < collection.length
          ? collection[position]
          : undefined;
      }
      return undefined;
    }
    case 'pluck': {
      const collection = Array.isArray(args[0]) ? args[0] : [];
      const key = args.length > 1 ? args[1] : null;
      return collection.map((item) => keyValueFor(item, key));
    }
    case 'filter': {
      const collection = Array.isArray(args[0]) ? args[0] : [];
      const key = args.length > 1 ? args[1] : null;
      return collection.filter((item) => {
        const value = key == null ? item : keyValueFor(item, key);
        return truthy(value);
      });
    }
    case 'reject': {
      const collection = Array.isArray(args[0]) ? args[0] : [];
      const key = args.length > 1 ? args[1] : null;
      return collection.filter((item) => {
        const value = key == null ? item : keyValueFor(item, key);
        return !truthy(value);
      });
    }
    case 'find': {
      const collection = Array.isArray(args[0]) ? args[0] : [];
      const key = args.length > 1 ? args[1] : null;
      return collection.find((item) => {
        const value = key == null ? item : keyValueFor(item, key);
        return truthy(value);
      });
    }
    case 'findLast': {
      const collection = Array.isArray(args[0]) ? args[0] : [];
      const key = args.length > 1 ? args[1] : null;
      for (let i = collection.length - 1; i >= 0; i -= 1) {
        const value =
          key == null ? collection[i] : keyValueFor(collection[i], key);
        if (truthy(value)) return collection[i];
      }
      return undefined;
    }
    case 'some': {
      const collection = Array.isArray(args[0]) ? args[0] : [];
      const key = args.length > 1 ? args[1] : null;
      return collection.some((item) => {
        const value = key == null ? item : keyValueFor(item, key);
        return truthy(value);
      });
    }
    case 'every': {
      const collection = Array.isArray(args[0]) ? args[0] : [];
      const key = args.length > 1 ? args[1] : null;
      return collection.every((item) => {
        const value = key == null ? item : keyValueFor(item, key);
        return truthy(value);
      });
    }
    case 'sumBy': {
      const collection = Array.isArray(args[0]) ? args[0] : [];
      const key = args.length > 1 ? args[1] : null;
      let total = 0;
      for (const item of collection) {
        total += toNumber(keyValueFor(item, key));
      }
      return total;
    }
    case 'avgBy':
    case 'meanBy': {
      const collection = Array.isArray(args[0]) ? args[0] : [];
      const key = args.length > 1 ? args[1] : null;
      if (collection.length === 0) return 0;
      let total = 0;
      for (const item of collection) {
        total += toNumber(keyValueFor(item, key));
      }
      return total / collection.length;
    }
    case 'minBy': {
      const collection = Array.isArray(args[0]) ? args[0] : [];
      const key = args.length > 1 ? args[1] : null;
      if (collection.length === 0) return undefined;
      let result = toNumber(keyValueFor(collection[0], key));
      for (let i = 1; i < collection.length; i += 1) {
        const value = toNumber(keyValueFor(collection[i], key));
        if (Number.isNaN(value)) {
          result = NaN;
        } else if (value < result) {
          result = value;
        }
      }
      return result;
    }
    case 'maxBy': {
      const collection = Array.isArray(args[0]) ? args[0] : [];
      const key = args.length > 1 ? args[1] : null;
      if (collection.length === 0) return undefined;
      let result = toNumber(keyValueFor(collection[0], key));
      for (let i = 1; i < collection.length; i += 1) {
        const value = toNumber(keyValueFor(collection[i], key));
        if (Number.isNaN(value)) {
          result = NaN;
        } else if (value > result) {
          result = value;
        }
      }
      return result;
    }
    case 'flattenDeep':
      return flattenArray(args[0], Infinity);
    case 'sortBy':
    case 'orderBy': {
      if (!Array.isArray(args[0])) return [];
      const key = args.length > 1 ? args[1] : null;
      const order = args.length > 2 ? args[2] : 'asc';
      const descending =
        order === 'desc' || order === false || order === -1;
      const result = args[0].slice();
      const valueFor = (item) => {
        if (key == null) return item;
        if (typeof key === 'string') return getPath(item, key);
        return key;
      };
      result.sort((a, b) => {
        const comparison = compareSort(valueFor(a), valueFor(b));
        return descending ? -comparison : comparison;
      });
      return result;
    }
    case 'includes':
    case 'contains':
      return contains(args[0], args[1]);
    case 'indexOf': {
      const collection = args[0];
      const value = args[1];
      if (Array.isArray(collection)) {
        return collection.findIndex((item) => deepEqual(item, value, true));
      }
      if (typeof collection === 'string') {
        return collection.indexOf(String(value == null ? '' : value));
      }
      if (collection && typeof collection === 'object') {
        return Object.keys(collection).indexOf(
          String(value == null ? '' : value)
        );
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
      const index = text.indexOf(search);
      if (index === -1) return text;
      return text.slice(0, index) + replacement + text.slice(index + search.length);
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
      if (!Number.isFinite(count) || count <= 0) return '';
      return text.repeat(count);
    }
    case 'padStart': {
      const text = args[0] == null ? '' : String(args[0]);
      const length = args.length > 1 ? Math.trunc(toNumber(args[1])) : 0;
      const pad = args.length > 2 && args[2] != null ? String(args[2]) : ' ';
      return text.padStart(length, pad);
    }
    case 'padEnd': {
      const text = args[0] == null ? '' : String(args[0]);
      const length = args.length > 1 ? Math.trunc(toNumber(args[1])) : 0;
      const pad = args.length > 2 && args[2] != null ? String(args[2]) : ' ';
      return text.padEnd(length, pad);
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
      if (Array.isArray(value)) return value.slice().reverse();
      if (typeof value === 'string') return [...value].reverse().join('');
      return value;
    }
    case 'sort': {
      if (!Array.isArray(args[0])) return [];
      const result = args[0].slice();
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
      const seen = new Set();
      const objects = [];
      for (const item of args[0]) {
        if (item !== null && typeof item === 'object') {
          if (!objects.some((existing) => deepEqual(existing, item, true))) {
            objects.push(item);
            result.push(item);
          }
        } else {
          const key = item === undefined ? null : item;
          if (seen.has(key)) continue;
          seen.add(key);
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
          for (const item of arg) {
            result.push(item);
          }
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
    case 'avg':
    case 'mean': {
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
      if (typeof target === 'string') {
        const key = String(index == null ? '' : index);
        if (/^\d+$/.test(key)) {
          const position = Number(key);
          return position >= 0 && position < target.length
            ? target[position]
            : undefined;
        }
        if (key === 'length') return target.length;
        return undefined;
      }
      if (Array.isArray(target)) {
        const key = String(index == null ? '' : index);
        if (/^\d+$/.test(key)) {
          return target[Number(key)];
        }
        return Object.prototype.hasOwnProperty.call(target, key)
          ? target[key]
          : undefined;
      }
      if (typeof target === 'object') {
        const key = String(index == null ? '' : index);
        return Object.prototype.hasOwnProperty.call(target, key)
          ? target[key]
          : undefined;
      }
      return undefined;
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
        case 'not in':
          return !contains(right, left);
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
