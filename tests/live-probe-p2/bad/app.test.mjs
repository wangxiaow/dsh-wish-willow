// Arithmetic regression check for zero inputs.
import assert from 'node:assert/strict';
import { sum } from './app.mjs';
assert.equal(sum(0, 0), 0);
console.log('Arithmetic assertions completed');
