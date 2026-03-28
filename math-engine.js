'use strict';

/**
 * Lightweight deterministic math engine for core high-school/early-college queries.
 * Returns Wolfram-style "pods" to match the UI renderer contract.
 */

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function fmt(n) {
  if (!Number.isFinite(n)) return String(n);
  if (Math.abs(n - Math.round(n)) < 1e-12) return String(Math.round(n));
  return Number(n.toFixed(10)).toString();
}

function normalize(query) {
  return query
    .replace(/−/g, '-')
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/π/g, 'pi')
    .trim();
}

function safeEvalArithmetic(expr) {
  const cleaned = expr
    .replace(/\bpi\b/gi, String(Math.PI))
    .replace(/\be\b/g, String(Math.E))
    .replace(/\^/g, '**');

  if (!/^[0-9+\-*/().,%\s*]*$/.test(cleaned)) {
    throw new Error('Unsupported symbols in arithmetic expression.');
  }

  // eslint-disable-next-line no-new-func
  const result = Function(`"use strict"; return (${cleaned});`)();
  const n = toNumber(result);
  if (n === null) throw new Error('Could not evaluate expression.');
  return n;
}

function primeFactorization(n) {
  const factors = [];
  let x = Math.abs(Math.trunc(n));
  if (x < 2) return factors;
  while (x % 2 === 0) {
    factors.push(2);
    x /= 2;
  }
  for (let p = 3; p * p <= x; p += 2) {
    while (x % p === 0) {
      factors.push(p);
      x /= p;
    }
  }
  if (x > 1) factors.push(x);
  return factors;
}

function groupFactors(factors) {
  const counts = new Map();
  factors.forEach((f) => counts.set(f, (counts.get(f) || 0) + 1));
  return [...counts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([prime, exp]) => (exp === 1 ? `${prime}` : `${prime}^${exp}`))
    .join(' × ');
}

function gcd(a, b) {
  let x = Math.abs(Math.trunc(a));
  let y = Math.abs(Math.trunc(b));
  while (y !== 0) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x;
}

function lcm(a, b) {
  if (a === 0 || b === 0) return 0;
  return Math.abs(Math.trunc(a * b)) / gcd(a, b);
}

function parsePolynomial(poly) {
  const cleaned = poly.replace(/\s+/g, '').replace(/\*+/g, '');
  const terms = cleaned.match(/[+-]?[^+-]+/g) || [];
  const coeffs = new Map();

  for (const t of terms) {
    if (!t) continue;
    const m = t.match(/^([+-]?\d*\.?\d*)?x(?:\^(\d+))?$/i);
    if (m) {
      let c = m[1];
      if (c === '' || c === '+' || c === undefined) c = 1;
      else if (c === '-') c = -1;
      else c = Number(c);
      const p = m[2] ? Number(m[2]) : 1;
      coeffs.set(p, (coeffs.get(p) || 0) + c);
      continue;
    }

    const constant = Number(t);
    if (Number.isFinite(constant)) {
      coeffs.set(0, (coeffs.get(0) || 0) + constant);
      continue;
    }
    throw new Error(`Unsupported polynomial term: ${t}`);
  }

  return coeffs;
}

function polyToString(coeffs) {
  const ordered = [...coeffs.entries()].sort((a, b) => b[0] - a[0]);
  const parts = [];

  for (const [pow, coeff] of ordered) {
    if (Math.abs(coeff) < 1e-12) continue;
    const abs = Math.abs(coeff);
    const sign = coeff < 0 ? '-' : '+';

    let term;
    if (pow === 0) {
      term = fmt(abs);
    } else if (pow === 1) {
      term = abs === 1 ? 'x' : `${fmt(abs)}x`;
    } else {
      term = abs === 1 ? `x^${pow}` : `${fmt(abs)}x^${pow}`;
    }

    parts.push({ sign, term });
  }

  if (parts.length === 0) return '0';
  const [first, ...rest] = parts;
  const head = first.sign === '-' ? `-${first.term}` : first.term;
  return head + rest.map((p) => ` ${p.sign} ${p.term}`).join('');
}

function differentiate(polyExpr) {
  const coeffs = parsePolynomial(polyExpr);
  const out = new Map();
  for (const [p, c] of coeffs.entries()) {
    if (p === 0) continue;
    out.set(p - 1, (out.get(p - 1) || 0) + p * c);
  }
  return polyToString(out);
}

function integrate(polyExpr) {
  const coeffs = parsePolynomial(polyExpr);
  const out = new Map();
  for (const [p, c] of coeffs.entries()) {
    out.set(p + 1, (out.get(p + 1) || 0) + c / (p + 1));
  }
  return `${polyToString(out)} + C`;
}

function solveLinearOrQuadratic(equation) {
  const eq = equation.replace(/\s+/g, '').replace(/\*+/g, '');
  const [lhs, rhs = '0'] = eq.split('=');
  if (!lhs) throw new Error('Could not parse equation.');

  const leftMap = parsePolynomial(lhs);
  const rightMap = parsePolynomial(rhs);
  const coeffs = new Map(leftMap);
  for (const [p, c] of rightMap.entries()) coeffs.set(p, (coeffs.get(p) || 0) - c);

  const a = coeffs.get(2) || 0;
  const b = coeffs.get(1) || 0;
  const c = coeffs.get(0) || 0;

  if (Math.abs(a) < 1e-12 && Math.abs(b) < 1e-12) throw new Error('No variable term found.');

  if (Math.abs(a) < 1e-12) {
    return { kind: 'linear', roots: [-c / b], reduced: `${fmt(b)}x + ${fmt(c)} = 0` };
  }

  const d = b * b - 4 * a * c;
  if (d < 0) {
    const re = -b / (2 * a);
    const im = Math.sqrt(-d) / (2 * a);
    return {
      kind: 'quadratic-complex',
      roots: [`${fmt(re)} + ${fmt(im)}i`, `${fmt(re)} - ${fmt(im)}i`],
      discriminant: d,
      reduced: `${fmt(a)}x^2 + ${fmt(b)}x + ${fmt(c)} = 0`,
    };
  }

  const rootD = Math.sqrt(d);
  const x1 = (-b + rootD) / (2 * a);
  const x2 = (-b - rootD) / (2 * a);
  return {
    kind: 'quadratic-real',
    roots: [x1, x2],
    discriminant: d,
    reduced: `${fmt(a)}x^2 + ${fmt(b)}x + ${fmt(c)} = 0`,
  };
}

function podsForArithmetic(q, value) {
  return {
    pods: [
      { id: 'result', title: 'Result', icon: '✅', primary: true, type: 'value', content: { main: fmt(value), sub: `Computed from: ${q}` } },
      { id: 'numeric', title: 'Numeric form', icon: '🔢', primary: false, type: 'table', content: { rows: [['Decimal', fmt(value)], ['Scientific', value.toExponential(6)]] } },
      { id: 'notes', title: 'Interpretation', icon: '🧠', primary: false, type: 'text', content: { paragraphs: ['Parsed as an arithmetic expression with operator precedence and parentheses.', 'Supported constants: π (pi), e.'] } },
    ],
  };
}

function solveQuery(rawQuery) {
  if (!rawQuery || !rawQuery.trim()) throw new Error('Query is empty.');
  const query = normalize(rawQuery);
  const lower = query.toLowerCase();

  if (lower.startsWith('prime factorization of ')) {
    const n = Number(lower.replace('prime factorization of ', '').trim());
    if (!Number.isFinite(n)) throw new Error('Expected an integer for prime factorization.');
    const factors = primeFactorization(n);
    return {
      pods: [
        { id: 'result', title: 'Prime factorization', icon: '🧩', primary: true, type: 'value', content: { main: factors.length ? groupFactors(factors) : fmt(n), sub: `${fmt(n)} as prime powers` } },
        { id: 'factor-list', title: 'Factors', icon: '📋', primary: false, type: 'list', content: { items: factors.map((f, i) => ({ label: `Factor ${i + 1}`, value: String(f) })) } },
        { id: 'verify', title: 'Verification', icon: '✔️', primary: false, type: 'text', content: { paragraphs: [factors.length ? `${factors.join(' × ')} = ${fmt(n)}` : `${fmt(n)} has no prime decomposition in ℕ (n < 2).`] } },
      ],
    };
  }

  if (lower.startsWith('gcd(') || lower.startsWith('lcm(')) {
    const m = query.match(/^(gcd|lcm)\(([^,]+),([^\)]+)\)$/i);
    if (!m) throw new Error('Use gcd(a,b) or lcm(a,b).');
    const a = Number(m[2].trim());
    const b = Number(m[3].trim());
    if (!Number.isFinite(a) || !Number.isFinite(b)) throw new Error('gcd/lcm inputs must be numbers.');
    const op = m[1].toLowerCase();
    const val = op === 'gcd' ? gcd(a, b) : lcm(a, b);
    return {
      pods: [
        { id: 'result', title: op.toUpperCase(), icon: '🔢', primary: true, type: 'value', content: { main: fmt(val), sub: `${op}(${fmt(a)}, ${fmt(b)})` } },
        { id: 'inputs', title: 'Inputs', icon: '📥', primary: false, type: 'table', content: { rows: [['a', fmt(a)], ['b', fmt(b)]] } },
        { id: 'definition', title: 'Definition', icon: '📘', primary: false, type: 'text', content: { paragraphs: [op === 'gcd' ? 'Greatest common divisor: largest integer dividing both inputs.' : 'Least common multiple: smallest positive integer divisible by both inputs.'] } },
      ],
    };
  }

  if (lower.startsWith('solve ')) {
    const eq = query.slice(6).trim();
    const solved = solveLinearOrQuadratic(eq);
    const rootsDisplay = solved.roots.map((r) => (typeof r === 'number' ? fmt(r) : r));
    return {
      pods: [
        { id: 'solution', title: 'Solution', icon: '🎯', primary: true, type: 'value', content: { main: rootsDisplay.length === 1 ? `x = ${rootsDisplay[0]}` : `x₁ = ${rootsDisplay[0]}, x₂ = ${rootsDisplay[1]}`, sub: solved.reduced } },
        { id: 'method', title: 'Method', icon: '🧮', primary: false, type: 'math', content: { expressions: solved.kind.startsWith('linear') ? ['For ax + b = 0 → x = −b/a'] : ['For ax² + bx + c = 0 → x = (−b ± √(b² − 4ac)) / 2a'] } },
        { id: 'properties', title: 'Properties', icon: '📌', primary: false, type: 'table', content: { rows: solved.discriminant === undefined ? [['Type', 'Linear equation']] : [['Discriminant (Δ)', fmt(solved.discriminant)], ['Root type', solved.discriminant < 0 ? 'Complex conjugate pair' : solved.discriminant === 0 ? 'Repeated real root' : 'Distinct real roots']] } },
      ],
    };
  }

  if (lower.startsWith('derivative of ') || lower.startsWith('differentiate ')) {
    const expr = lower.startsWith('derivative of ') ? query.slice(14).trim() : query.slice(12).trim();
    const deriv = differentiate(expr);
    return {
      pods: [
        { id: 'result', title: 'Derivative', icon: '📉', primary: true, type: 'value', content: { main: deriv, sub: `d/dx [${expr}]` } },
        { id: 'steps', title: 'Rule used', icon: '🪜', primary: false, type: 'math', content: { expressions: ['Power rule: d/dx (axⁿ) = a·n·xⁿ⁻¹', 'Linearity: derivative distributes over addition/subtraction'] } },
        { id: 'check', title: 'Domain note', icon: 'ℹ️', primary: false, type: 'text', content: { paragraphs: ['This engine currently differentiates polynomial expressions in x.'] } },
      ],
    };
  }

  if (lower.startsWith('integral of ') || lower.startsWith('integrate ')) {
    const expr = lower.startsWith('integral of ') ? query.slice(12).trim() : query.slice(10).trim();
    const integ = integrate(expr);
    return {
      pods: [
        { id: 'result', title: 'Indefinite integral', icon: '∫', primary: true, type: 'value', content: { main: integ, sub: `∫(${expr}) dx` } },
        { id: 'steps', title: 'Rule used', icon: '🪜', primary: false, type: 'math', content: { expressions: ['Power rule: ∫ axⁿ dx = a·xⁿ⁺¹/(n+1) + C (n ≠ −1)', 'Linearity: integration distributes over sums'] } },
        { id: 'check', title: 'Scope', icon: 'ℹ️', primary: false, type: 'text', content: { paragraphs: ['This engine currently integrates polynomial expressions in x.'] } },
      ],
    };
  }

  // Fallback to arithmetic eval.
  const value = safeEvalArithmetic(query);
  return podsForArithmetic(query, value);
}

module.exports = {
  solveQuery,
  _internal: {
    safeEvalArithmetic,
    parsePolynomial,
    differentiate,
    integrate,
    solveLinearOrQuadratic,
    primeFactorization,
    gcd,
    lcm,
  },
};
