'use strict';

const { tokenize } = require('./tokenizer');

class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.position = 0;
  }

  get current() {
    return this.tokens[this.position] || { type: 'eof', value: null };
  }

  advance() {
    const token = this.current;
    this.position += 1;
    return token;
  }

  match(type, value) {
    if (
      this.current.type === type &&
      (value === undefined || this.current.value === value)
    ) {
      this.advance();
      return true;
    }
    return false;
  }

  expect(type, value) {
    if (!this.match(type, value)) {
      throw new Error(
        `Expected ${value === undefined ? type : value} but found ${this.current.type} ${this.current.value}`
      );
    }
  }

  parse() {
    const node = this.expression();
    if (this.current.type !== 'eof') {
      throw new Error(`Unexpected token: ${this.current.value}`);
    }
    return node;
  }

  expression() {
    return this.or();
  }

  or() {
    let node = this.and();
    while (this.current.type === 'op' && this.current.value === '||') {
      this.advance();
      const right = this.and();
      node = { type: 'or', left: node, right };
    }
    return node;
  }

  and() {
    let node = this.not();
    while (this.current.type === 'op' && this.current.value === '&&') {
      this.advance();
      const right = this.not();
      node = { type: 'and', left: node, right };
    }
    return node;
  }

  not() {
    if (this.current.type === 'op' && this.current.value === '!') {
      this.advance();
      return { type: 'not', operand: this.not() };
    }
    return this.comparison();
  }

  comparison() {
    let node = this.additive();
    const isComparison =
      (this.current.type === 'op' &&
        ['==', '!=', '<', '<=', '>', '>='].includes(this.current.value)) ||
      (this.current.type === 'path' && this.current.value === 'in');
    if (isComparison) {
      const operator = this.current.value;
      this.advance();
      const right = this.additive();
      node = { type: 'cmp', op: operator, left: node, right };
    }
    return node;
  }

  additive() {
    let node = this.multiplicative();
    while (
      this.current.type === 'op' &&
      (this.current.value === '+' || this.current.value === '-')
    ) {
      const operator = this.current.value;
      this.advance();
      const right = this.multiplicative();
      node = { type: 'bin', op: operator, left: node, right };
    }
    return node;
  }

  multiplicative() {
    let node = this.unary();
    while (
      this.current.type === 'op' &&
      (this.current.value === '*' ||
        this.current.value === '/' ||
        this.current.value === '%')
    ) {
      const operator = this.current.value;
      this.advance();
      const right = this.unary();
      node = { type: 'bin', op: operator, left: node, right };
    }
    return node;
  }

  unary() {
    if (this.current.type === 'op' && this.current.value === '-') {
      this.advance();
      return { type: 'neg', operand: this.unary() };
    }
    if (this.current.type === 'op' && this.current.value === '+') {
      this.advance();
      return { type: 'pos', operand: this.unary() };
    }
    return this.primary();
  }

  primary() {
    const base = this.primaryBase();
    return this.access(base);
  }

  primaryBase() {
    const token = this.current;

    if (
      token.type === 'number' ||
      token.type === 'string' ||
      token.type === 'keyword'
    ) {
      this.advance();
      return { type: 'literal', value: token.value };
    }

    if (token.type === 'sym' && token.value === '(') {
      this.advance();
      const node = this.expression();
      this.expect('sym', ')');
      return node;
    }

    if (token.type === 'sym' && token.value === '[') {
      this.advance();
      const items = [];
      if (!(this.current.type === 'sym' && this.current.value === ']')) {
        do {
          items.push(this.expression());
        } while (this.match('sym', ','));
      }
      this.expect('sym', ']');
      return { type: 'array', items };
    }

    if (token.type === 'path') {
      if (
        this.position + 1 < this.tokens.length &&
        this.tokens[this.position + 1].type === 'sym' &&
        this.tokens[this.position + 1].value === '('
      ) {
        const name = token.value;
        this.advance();
        this.expect('sym', '(');
        const args = [];
        if (!(this.current.type === 'sym' && this.current.value === ')')) {
          do {
            args.push(this.expression());
          } while (this.match('sym', ','));
        }
        this.expect('sym', ')');
        return { type: 'call', name, args };
      }

      this.advance();
      return { type: 'path', value: token.value };
    }

    throw new Error(`Unexpected token: ${token.type} ${token.value}`);
  }

  access(node) {
    while (
      this.current.type === 'sym' &&
      (this.current.value === '[' || this.current.value === '.')
    ) {
      if (this.current.value === '[') {
        this.advance();
        const index = this.expression();
        this.expect('sym', ']');
        node = { type: 'index', target: node, index };
      } else {
        this.advance();
        if (this.current.type !== 'path') {
          throw new Error(`Expected property name but found ${this.current.type}`);
        }
        const property = this.current.value;
        this.advance();
        node = { type: 'member', target: node, property };
      }
    }
    return node;
  }
}

function parseExpression(input) {
  const tokens = tokenize(input);
  return new Parser(tokens).parse();
}

module.exports = { parseExpression, Parser };
