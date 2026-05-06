// tests/jest-uuid-shim.cjs
// Jest-only CJS shim for the `uuid` package (v14 ships pure ESM, which
// breaks ts-jest's default CJS transform pipeline). Production code is
// unaffected — this file is only wired in via moduleNameMapper in
// jest.config.js. When uuid is upgraded to a release that re-publishes a
// CJS build, or when this repo migrates Jest to ESM, delete this shim.

const crypto = require('crypto');

function v4() {
  return crypto.randomUUID();
}

function validate(value) {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  );
}

function stringify(arr) {
  return Buffer.from(arr).toString('hex');
}

function parse(s) {
  return Buffer.from(String(s).replace(/-/g, ''), 'hex');
}

const NIL = '00000000-0000-0000-0000-000000000000';
const MAX = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

// Cover every named export used across uuid v1..v7 so any transitive caller
// can resolve. Variants all delegate to crypto.randomUUID() — fine for tests.
module.exports = {
  v1: v4,
  v3: v4,
  v4,
  v5: v4,
  v6: v4,
  v7: v4,
  validate,
  version: () => 4,
  stringify,
  parse,
  NIL,
  MAX,
  default: v4,
};
