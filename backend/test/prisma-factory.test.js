'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { isSqliteUrl } = require('../lib/prisma-factory');

test('isSqliteUrl erkennt file:- und sqlite:-URLs', () => {
  assert.strictEqual(isSqliteUrl('file:./x.sqlite'), true);
  assert.strictEqual(isSqliteUrl(' sqlite:memory: '), true);
});

test('isSqliteUrl lehnt Postgres und Leerwerte ab', () => {
  assert.strictEqual(isSqliteUrl('postgresql://localhost/db'), false);
  assert.strictEqual(isSqliteUrl(''), false);
  assert.strictEqual(isSqliteUrl(null), false);
});
