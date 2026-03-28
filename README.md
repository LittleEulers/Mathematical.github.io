# Mathematical

A lightweight **Computational Knowledge Engine** that converts natural-language math prompts into executable symbolic/numeric workflows.

## Features
- **Natural Language Understanding (NLU)**
  - Classifies prompt as `calculation`, `visualization`, `fact`, or `unknown`.
- **Symbolic Engine (SymPy)**
  - Supports integration, differentiation, equation solving, factoring, expansion, simplification, and limits.
- **Computational Execution (NumPy + Pandas)**
  - Generates numeric samples and tabular previews for plotted expressions.
- **Visualization (Matplotlib)**
  - Produces labeled function plots saved to `artifacts/plot.png`.
- **Structured Output**
  - Returns step-by-step reasoning, exact and numeric forms, and metadata.
  - For ambiguous prompts, provides a likely interpretation plus a “did you mean” hint.

## Usage

```bash
python computational_engine.py
```

Or use it programmatically:

```python
from computational_engine import ComputationalKnowledgeEngine

engine = ComputationalKnowledgeEngine()
result = engine.solve("Plot sin(x)")
print(result.to_dict())
```

## Input format
Pass a natural-language query string such as:
- `Integrate x^2`
- `Solve x^2 - 4`
- `Plot sin(x)`
- `What is the value of pi?`

If query text is too vague, the engine returns an ambiguity response with alternatives.
