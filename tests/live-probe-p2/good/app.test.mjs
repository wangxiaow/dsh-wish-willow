import assert from 'node:assert/strict';
import { sum } from './app.mjs';
for (const [a, b, expected] of [[2, 3, 5], [-3, 5, 2], [-2, -3, -5], [0, 0, 0], [0.5, 0.25, 0.75]]) {
  assert.equal(sum(a, b), expected);
}
console.log('Arithmetic assertions completed');
