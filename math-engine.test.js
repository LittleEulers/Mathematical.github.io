'use strict';

const assert = require('node:assert/strict');
const { solveQuery } = require('./math-engine');

function primaryMain(q) {
  const res = solveQuery(q);
  const primary = res.pods.find((p) => p.primary);
  return primary?.content?.main;
}

assert.equal(primaryMain('2+2*5'), '12');
assert.equal(primaryMain('prime factorization of 360'), '2^3 × 3^2 × 5');
assert.match(primaryMain('solve x^2-5x+6=0'), /x₁ = 3, x₂ = 2|x₁ = 2, x₂ = 3/);
assert.equal(primaryMain('derivative of 3x^3+2x'), '9x^2 + 2');
assert.equal(primaryMain('integrate 6x^2+2'), '2x^3 + 2x + C');

console.log('math-engine tests passed');
