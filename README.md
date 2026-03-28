# Mathematical Web App

This project includes a browser UI plus a deterministic local math engine.

## Files
- `wolfram-alpha-replica (1).html`: front-end interface (left unchanged).
- `math-engine.js`: local solver that handles arithmetic, polynomial derivative/integral, linear/quadratic solving, GCD/LCM, and prime factorization.
- `math-engine.test.js`: Node-based smoke tests for the solver.

## What the engine can solve
- Arithmetic expressions: `2+2*5`, `(3^2+1)/2`
- Derivatives of polynomials: `derivative of 3x^3+2x`
- Integrals of polynomials: `integrate 6x^2+2`
- Equation solving: `solve x^2 - 5x + 6 = 0`
- Number theory: `prime factorization of 360`, `gcd(84,126)`, `lcm(12,18)`

## Run tests
```bash
node math-engine.test.js
```

## Run quick manual checks
```bash
node -e "const {solveQuery}=require('./math-engine'); console.log(JSON.stringify(solveQuery('solve x^2-5x+6=0'),null,2));"
```
