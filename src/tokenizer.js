'use strict';

function tokenize(input) {
  if (typeof input !== 'string') {
    throw new Error('Expression must be a string');
  }

  const tokens = [];
  let i = 0;
  const length = input.length;

  while (i < length) {
    const char = input[i];

    if (/\s/.test(char)) {
      i += 1;
      continue;
    }

    if (char === '"' || char === "'") {
      const quote = char;
      let value = '';
      i += 1;
      while (i < length && input[i] !== quote) {
        if (input[i] === '\\') {
          if (i + 1 >= length) {
            throw new Error('Unterminated string escape');
          }
          const escaped = input[i + 1];
          if (escaped === 'u') {
            const hex = input.slice(i + 2, i + 6);
            if (/^[0-9a-fA-F]{4}$/.test(hex)) {
              value += String.fromCharCode(parseInt(hex, 16));
              i += 6;
              continue;
            }
          }
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
          value += Object.prototype.hasOwnProperty.call(escapes, escaped)
            ? escapes[escaped]
            : escaped;
          i += 2;
          continue;
        }
        value += input[i];
        i += 1;
      }
      if (i >= length) {
        throw new Error('Unterminated string literal');
      }
      i += 1;
      tokens.push({ type: 'string', value });
      continue;
    }

    if (
      /[0-9]/.test(char) ||
      (char === '.' && i + 1 < length && /[0-9]/.test(input[i + 1]))
    ) {
      const start = i;
      while (i < length && /[0-9.]/.test(input[i])) {
        i += 1;
      }
      if (i < length && (input[i] === 'e' || input[i] === 'E')) {
        i += 1;
        if (i < length && (input[i] === '+' || input[i] === '-')) {
          i += 1;
        }
        while (i < length && /[0-9]/.test(input[i])) {
          i += 1;
        }
      }
      const text = input.slice(start, i);
      const number = Number(text);
      if (Number.isNaN(number)) {
        throw new Error(`Invalid number: ${text}`);
      }
      tokens.push({ type: 'number', value: number });
      continue;
    }

    if (/[A-Za-z_]/.test(char)) {
      const start = i;
      while (i < length && /[A-Za-z0-9_]/.test(input[i])) {
        i += 1;
      }
      const first = input.slice(start, i);
      let full = first;
      while (
        i < length &&
        input[i] === '.' &&
        i + 1 < length &&
        /[A-Za-z_]/.test(input[i + 1])
      ) {
        i += 1;
        const segmentStart = i;
        while (i < length && /[A-Za-z0-9_]/.test(input[i])) {
          i += 1;
        }
        full += `.${input.slice(segmentStart, i)}`;
      }

      if (
        (first === 'true' || first === 'false' || first === 'null') &&
        full === first
      ) {
        tokens.push({
          type: 'keyword',
          value:
            first === 'true' ? true : first === 'false' ? false : null
        });
      } else {
        tokens.push({ type: 'path', value: full });
      }
      continue;
    }

    const two = input.slice(i, i + 2);
    if (['==', '!=', '<=', '>=', '&&', '||'].includes(two)) {
      tokens.push({ type: 'op', value: two });
      i += 2;
      continue;
    }

    if ('<>=!+-*/%'.includes(char)) {
      tokens.push({ type: 'op', value: char });
      i += 1;
      continue;
    }

    if (char === '.') {
      tokens.push({ type: 'sym', value: '.' });
      i += 1;
      continue;
    }

    if ('()[]{}'.includes(char) || char === ',') {
      tokens.push({ type: 'sym', value: char });
      i += 1;
      continue;
    }

    throw new Error(`Unexpected character '${char}' at position ${i}`);
  }

  tokens.push({ type: 'eof', value: null });
  return tokens;
}

module.exports = { tokenize };
