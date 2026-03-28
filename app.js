class ComputationalKnowledgeEngine {
  solve(query) {
    const cleaned = (query || '').trim();
    const queryType = this.classify(cleaned);

    if (queryType === 'calculation') return this.handleCalculation(cleaned);
    if (queryType === 'visualization') return this.handleVisualization(cleaned);
    if (queryType === 'fact') return this.handleFact(cleaned);

    return this.ambiguous(cleaned);
  }

  classify(query) {
    const q = query.toLowerCase();
    if (/(plot|graph|visualize|draw|chart)/.test(q)) return 'visualization';
    if (/(integrate|differentiate|derivative|solve|factor|expand|simplify|limit)/.test(q)) return 'calculation';
    if (/(constant|speed of light|gravity|pi|golden ratio)/.test(q)) return 'fact';
    return 'unknown';
  }

  normalizeExpression(text) {
    return text
      .replace(/\^/g, '**')
      .replace(/\s+/g, '')
      .replace(/=/g, '-(') + (text.includes('=') ? ')' : '');
  }

  extractExpression(query) {
    const match = query.match(/(?:integrate|differentiate|derivative of|plot|graph|visualize|solve|simplify|factor|expand|limit)\s+(.+)/i);
    if (match) return match[1].replace(/\?$/, '').trim();
    return null;
  }

  handleCalculation(query) {
    const q = query.toLowerCase();
    const expr = this.extractExpression(query);
    if (!expr) return this.ambiguous(query);

    if (/integrate/.test(q)) return this.integratePolynomial(expr, query);
    if (/(differentiate|derivative)/.test(q)) return this.differentiatePolynomial(expr, query);
    if (/solve/.test(q)) return this.solveQuadratic(expr, query);

    return {
      query,
      queryType: 'calculation',
      interpretation: 'Most likely a symbolic calculation request.',
      didYouMean: 'Did you mean: Integrate x^2, Differentiate x^3, or Solve x^2 - 4 = 0?',
      steps: ['Operation recognized but only polynomial integrate/differentiate/solve are supported in-browser.'],
      exactResult: null,
      numericResult: null,
      metadata: {}
    };
  }

  parsePolynomial(expr) {
    const cleaned = expr.replace(/\s+/g, '').replace(/-/g, '+-');
    const terms = cleaned.split('+').filter(Boolean);
    const coeffs = new Map();

    for (const term of terms) {
      if (term.includes('x')) {
        const [cPart, pPart] = term.split('x');
        const coeff = cPart === '' ? 1 : cPart === '-' ? -1 : Number(cPart);
        if (Number.isNaN(coeff)) return null;
        const power = pPart.startsWith('**') ? Number(pPart.slice(2)) : 1;
        if (Number.isNaN(power)) return null;
        coeffs.set(power, (coeffs.get(power) || 0) + coeff);
      } else {
        const c = Number(term);
        if (Number.isNaN(c)) return null;
        coeffs.set(0, (coeffs.get(0) || 0) + c);
      }
    }

    return coeffs;
  }

  polyToString(coeffs) {
    const ordered = [...coeffs.entries()].sort((a, b) => b[0] - a[0]);
    const parts = [];
    for (const [power, coeff] of ordered) {
      if (!coeff) continue;
      const sign = coeff < 0 ? '-' : (parts.length ? '+' : '');
      const abs = Math.abs(coeff);
      let chunk;
      if (power === 0) chunk = `${abs}`;
      else if (power === 1) chunk = `${abs === 1 ? '' : abs}x`;
      else chunk = `${abs === 1 ? '' : abs}x^${power}`;
      parts.push(`${sign}${chunk}`);
    }
    return parts.join('') || '0';
  }

  integratePolynomial(expr, query) {
    const poly = this.parsePolynomial(expr);
    if (!poly) return this.ambiguous(query);
    const integrated = new Map();
    for (const [power, coeff] of poly.entries()) {
      integrated.set(power + 1, coeff / (power + 1));
    }
    const exact = `${this.polyToString(integrated)} + C`;
    return {
      query,
      queryType: 'calculation',
      interpretation: 'Compute the indefinite integral with respect to x.',
      didYouMean: null,
      steps: [
        `Parsed polynomial: ${this.polyToString(poly)}`,
        'Applied power rule term-by-term: ∫ax^n dx = a·x^(n+1)/(n+1).',
        'Added integration constant C.'
      ],
      exactResult: exact,
      numericResult: exact,
      metadata: { domain: 'All real x', derivativeOfResult: this.polyToString(poly) }
    };
  }

  differentiatePolynomial(expr, query) {
    const poly = this.parsePolynomial(expr);
    if (!poly) return this.ambiguous(query);
    const derivative = new Map();
    for (const [power, coeff] of poly.entries()) {
      if (power === 0) continue;
      derivative.set(power - 1, coeff * power);
    }
    const exact = this.polyToString(derivative);
    return {
      query,
      queryType: 'calculation',
      interpretation: 'Compute the derivative with respect to x.',
      didYouMean: null,
      steps: [
        `Parsed polynomial: ${this.polyToString(poly)}`,
        'Applied power rule term-by-term: d/dx(ax^n) = a·n·x^(n-1).'
      ],
      exactResult: exact,
      numericResult: exact,
      metadata: { domain: 'All real x' }
    };
  }

  solveQuadratic(expr, query) {
    const normalized = this.normalizeExpression(expr);
    const poly = this.parsePolynomial(normalized);
    if (!poly) return this.ambiguous(query);

    const a = poly.get(2) || 0;
    const b = poly.get(1) || 0;
    const c = poly.get(0) || 0;
    if (a === 0) return this.ambiguous(query);

    const disc = b * b - 4 * a * c;
    const sqrtDisc = Math.sqrt(Math.abs(disc));

    let exact;
    let numeric;
    if (disc < 0) {
      exact = `x = (${-b} ± i√${Math.abs(disc)})/${2 * a}`;
      numeric = `x ≈ ${(-b / (2 * a)).toFixed(6)} ± ${(sqrtDisc / (2 * a)).toFixed(6)}i`;
    } else {
      exact = `x = (${-b} ± √${disc})/${2 * a}`;
      numeric = `x₁ ≈ ${((-b + sqrtDisc) / (2 * a)).toFixed(8)}, x₂ ≈ ${((-b - sqrtDisc) / (2 * a)).toFixed(8)}`;
    }

    return {
      query,
      queryType: 'calculation',
      interpretation: 'Solve a quadratic equation for x.',
      didYouMean: null,
      steps: [
        `Normalized to polynomial: ${this.polyToString(poly)} = 0`,
        `Identified coefficients a=${a}, b=${b}, c=${c}`,
        `Computed discriminant Δ = b² - 4ac = ${disc}`,
        'Applied quadratic formula x = (-b ± √Δ) / (2a).'
      ],
      exactResult: exact,
      numericResult: numeric,
      metadata: { discriminant: disc, domain: 'All real x (complex roots possible)' }
    };
  }

  handleVisualization(query) {
    const expr = this.extractExpression(query);
    if (!expr) return this.ambiguous(query);

    const fn = this.buildFunction(expr);
    if (!fn) return this.ambiguous(query);

    return {
      query,
      queryType: 'visualization',
      interpretation: 'Plot function over x ∈ [-10, 10].',
      didYouMean: null,
      steps: [
        `Parsed expression: f(x) = ${expr}`,
        'Sampled x-values across [-10, 10].',
        'Computed y-values and rendered line plot on canvas.'
      ],
      exactResult: expr,
      numericResult: 'Rendered from sampled points',
      metadata: {
        domain: 'Approx. real values where expression is finite',
        derivative: 'Not symbolically computed in browser mode'
      },
      plotExpression: expr,
      plotFn: fn
    };
  }

  buildFunction(expr) {
    let jsExpr = expr
      .replace(/\^/g, '**')
      .replace(/\bpi\b/gi, 'Math.PI')
      .replace(/\be\b/g, 'Math.E')
      .replace(/sin\(/gi, 'Math.sin(')
      .replace(/cos\(/gi, 'Math.cos(')
      .replace(/tan\(/gi, 'Math.tan(')
      .replace(/log\(/gi, 'Math.log(')
      .replace(/exp\(/gi, 'Math.exp(')
      .replace(/sqrt\(/gi, 'Math.sqrt(');

    try {
      const fn = new Function('x', `return ${jsExpr};`);
      fn(0.1);
      return fn;
    } catch {
      return null;
    }
  }

  handleFact(query) {
    const q = query.toLowerCase();
    const constants = {
      pi: { exact: 'π', numeric: String(Math.PI), unit: 'dimensionless' },
      e: { exact: 'e', numeric: String(Math.E), unit: 'dimensionless' },
      'golden ratio': { exact: 'φ = (1+√5)/2', numeric: '1.618033988749895', unit: 'dimensionless' },
      'speed of light': { exact: '299792458', numeric: '299792458', unit: 'm/s' },
      gravity: { exact: '9.80665', numeric: '9.80665', unit: 'm/s²' }
    };

    const key = Object.keys(constants).find((k) => q.includes(k));
    if (!key) {
      return {
        query,
        queryType: 'fact',
        interpretation: 'No supported verified constant matched.',
        didYouMean: 'Try: pi, e, golden ratio, speed of light, gravity.',
        steps: ['Fact intent detected but no supported constant found.'],
        exactResult: null,
        numericResult: null,
        metadata: { note: 'Live astronomy facts require an external ephemeris API.' }
      };
    }

    return {
      query,
      queryType: 'fact',
      interpretation: `Return verified constant: ${key}.`,
      didYouMean: null,
      steps: [`Located predefined verified constant '${key}'.`],
      exactResult: constants[key].exact,
      numericResult: constants[key].numeric,
      metadata: { unit: constants[key].unit }
    };
  }

  ambiguous(query) {
    return {
      query,
      queryType: 'unknown',
      interpretation: 'Ambiguous query. No safe execution path chosen.',
      didYouMean: 'Did you mean: Integrate x^2, Differentiate x^3, Solve x^2 - 4 = 0, or Plot sin(x)?',
      steps: ['Could not confidently parse query.'],
      exactResult: null,
      numericResult: null,
      metadata: {}
    };
  }
}

function renderResult(result) {
  document.getElementById('interpretation').textContent = result.interpretation || '—';
  document.getElementById('didYouMean').textContent = result.didYouMean || '';
  document.getElementById('exact').textContent = `Exact: ${result.exactResult ?? '—'}`;
  document.getElementById('numeric').textContent = `Numeric: ${result.numericResult ?? '—'}`;
  document.getElementById('metadata').textContent = JSON.stringify(result.metadata || {}, null, 2);

  const stepsEl = document.getElementById('steps');
  stepsEl.innerHTML = '';
  (result.steps || []).forEach((step) => {
    const li = document.createElement('li');
    li.textContent = step;
    stepsEl.appendChild(li);
  });

  drawPlot(result.plotFn);
}

function drawPlot(fn) {
  const canvas = document.getElementById('plotCanvas');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const pad = 30;
  const w = canvas.width - pad * 2;
  const h = canvas.height - pad * 2;

  ctx.strokeStyle = '#c2ccdd';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, pad + h / 2);
  ctx.lineTo(pad + w, pad + h / 2);
  ctx.moveTo(pad + w / 2, pad);
  ctx.lineTo(pad + w / 2, pad + h);
  ctx.stroke();

  if (!fn) return;

  const points = [];
  for (let px = 0; px <= w; px += 1) {
    const x = -10 + (20 * px) / w;
    let y = fn(x);
    if (!Number.isFinite(y)) {
      points.push(null);
      continue;
    }
    y = Math.max(-10, Math.min(10, y));
    const py = pad + h - ((y + 10) / 20) * h;
    points.push({ x: pad + px, y: py });
  }

  ctx.strokeStyle = '#2f6fed';
  ctx.lineWidth = 2;
  ctx.beginPath();
  let started = false;
  for (const p of points) {
    if (!p) {
      started = false;
      continue;
    }
    if (!started) {
      ctx.moveTo(p.x, p.y);
      started = true;
    } else {
      ctx.lineTo(p.x, p.y);
    }
  }
  ctx.stroke();
}

const engine = new ComputationalKnowledgeEngine();
const runBtn = document.getElementById('runBtn');
const exampleBtn = document.getElementById('exampleBtn');
const queryInput = document.getElementById('query');

runBtn.addEventListener('click', () => {
  renderResult(engine.solve(queryInput.value));
});

exampleBtn.addEventListener('click', () => {
  queryInput.value = 'Plot sin(x)';
  renderResult(engine.solve(queryInput.value));
});

renderResult(engine.solve('Integrate x^2'));
