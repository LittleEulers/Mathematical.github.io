# Mathematical Web App

This project is now a browser-based **Computational Knowledge Engine** implemented in pure **HTML, CSS, and JavaScript**.

## What it does
- Accepts natural-language math prompts.
- Classifies requests as calculation, visualization, fact lookup, or ambiguous.
- Returns structured output with:
  - interpretation,
  - step-by-step logic,
  - exact and numeric forms,
  - metadata,
  - visualization for plot requests.

## Supported examples
- `Integrate x^2`
- `Differentiate 3x^3+2x`
- `Solve x^2 - 4 = 0`
- `Plot sin(x)`
- `What is the speed of light?`

## Run locally
Because this is static frontend code, you can open `index.html` directly, or serve it with any static server.

Example:
```bash
python -m http.server 8000
```
Then open `http://localhost:8000`.
