"""Computational Knowledge Engine.

Parses natural-language math prompts, executes symbolic/numeric work,
and returns structured results with optional visualizations.
"""

from __future__ import annotations

from dataclasses import dataclass, asdict
from pathlib import Path
import re
from typing import Any, Literal

import numpy as np
import pandas as pd
import sympy as sp

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt


QueryType = Literal["calculation", "visualization", "fact", "unknown"]


@dataclass
class EngineResult:
    query: str
    query_type: QueryType
    interpretation: str
    did_you_mean: str | None
    steps: list[str]
    exact_result: str | None
    numeric_result: str | None
    metadata: dict[str, Any]
    table_preview: list[dict[str, float]] | None
    plot_path: str | None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class ComputationalKnowledgeEngine:
    """NLU + symbolic compute + optional plotting."""

    def __init__(self, output_dir: str = "artifacts") -> None:
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.x = sp.symbols("x", real=True)

    def solve(self, query: str) -> EngineResult:
        cleaned = query.strip()
        query_type = self._classify(cleaned)

        if query_type == "calculation":
            return self._handle_calculation(cleaned)
        if query_type == "visualization":
            return self._handle_visualization(cleaned)
        if query_type == "fact":
            return self._handle_fact(cleaned)

        return EngineResult(
            query=cleaned,
            query_type="unknown",
            interpretation="Could not confidently classify the request.",
            did_you_mean="Try 'Integrate x^2', 'Solve x^2-4=0', or 'Plot sin(x)'.",
            steps=["NLU could not map the query to supported intents."],
            exact_result=None,
            numeric_result=None,
            metadata={},
            table_preview=None,
            plot_path=None,
        )

    def _classify(self, query: str) -> QueryType:
        q = query.lower()
        if re.search(r"\b(plot|graph|visualize|draw|chart)\b", q):
            return "visualization"
        if re.search(r"\b(integrate|differentiate|derivative|solve|factor|expand|simplify|limit)\b", q):
            return "calculation"
        if re.search(r"\b(distance|constant|speed of light|gravity|fact)\b", q):
            return "fact"
        return "unknown"

    def _extract_expr(self, query: str) -> str | None:
        q = query.strip()
        patterns = [
            r"(?:integrate|differentiate|derivative of|plot|graph|visualize|solve|simplify|factor|expand|limit)\s+(.+)",
            r"(.+)",
        ]
        for p in patterns:
            m = re.search(p, q, re.IGNORECASE)
            if m:
                candidate = m.group(1).strip().rstrip("?")
                candidate = candidate.replace("^", "**")
                candidate = re.sub(r"\bwith respect to\b.*$", "", candidate, flags=re.IGNORECASE).strip()
                return candidate
        return None

    def _handle_calculation(self, query: str) -> EngineResult:
        q = query.lower()
        expr_text = self._extract_expr(query)
        if not expr_text:
            return self._ambiguous(query)

        try:
            expr = sp.sympify(expr_text)
        except Exception:
            return self._ambiguous(query)

        steps = [f"Parsed expression with SymPy: {sp.srepr(expr)}"]
        exact: sp.Expr
        interpretation: str

        if "integrate" in q:
            interpretation = "Compute the indefinite integral with respect to x."
            exact = sp.integrate(expr, self.x)
            steps.append(f"Computed integral: ∫({sp.sstr(expr)}) dx = {sp.sstr(exact)}")
        elif any(k in q for k in ["differentiate", "derivative"]):
            interpretation = "Compute the derivative with respect to x."
            exact = sp.diff(expr, self.x)
            steps.append(f"Computed derivative: d/dx({sp.sstr(expr)}) = {sp.sstr(exact)}")
        elif "solve" in q:
            interpretation = "Solve equation equal to zero for x."
            exact = sp.FiniteSet(*sp.solve(sp.Eq(expr, 0), self.x))
            steps.append(f"Solved {sp.sstr(expr)} = 0 for x.")
        elif "limit" in q:
            interpretation = "Compute a symbolic limit as x → 0."
            exact = sp.limit(expr, self.x, 0)
            steps.append(f"Computed limit lim_(x→0) {sp.sstr(expr)} = {sp.sstr(exact)}")
        elif "simplify" in q:
            interpretation = "Simplify symbolic expression."
            exact = sp.simplify(expr)
            steps.append(f"Simplified expression to {sp.sstr(exact)}")
        elif "factor" in q:
            interpretation = "Factor symbolic expression."
            exact = sp.factor(expr)
            steps.append(f"Factored expression to {sp.sstr(exact)}")
        elif "expand" in q:
            interpretation = "Expand symbolic expression."
            exact = sp.expand(expr)
            steps.append(f"Expanded expression to {sp.sstr(exact)}")
        else:
            return self._ambiguous(query)

        numeric = sp.N(exact, 12)
        metadata = {
            "free_symbols": sorted(str(s) for s in exact.free_symbols),
            "domain_assumption": "x is real",
        }

        if exact.free_symbols == {self.x}:
            metadata["first_derivative"] = str(sp.diff(exact, self.x))
        elif len(exact.free_symbols) == 0:
            metadata["is_real"] = bool(exact.is_real)

        return EngineResult(
            query=query,
            query_type="calculation",
            interpretation=interpretation,
            did_you_mean=None,
            steps=steps,
            exact_result=sp.sstr(exact),
            numeric_result=sp.sstr(numeric),
            metadata=metadata,
            table_preview=None,
            plot_path=None,
        )

    def _handle_visualization(self, query: str) -> EngineResult:
        expr_text = self._extract_expr(query)
        if not expr_text:
            return self._ambiguous(query)

        try:
            expr = sp.sympify(expr_text)
        except Exception:
            return self._ambiguous(query)

        f = sp.lambdify(self.x, expr, modules=["numpy"])
        xs = np.linspace(-10, 10, 400)
        ys = f(xs)

        fig, ax = plt.subplots(figsize=(7, 4))
        ax.plot(xs, ys, label=sp.sstr(expr))
        ax.set_title(f"Plot of {sp.sstr(expr)}")
        ax.set_xlabel("x")
        ax.set_ylabel("f(x)")
        ax.grid(True, alpha=0.3)
        ax.legend()

        plot_path = self.output_dir / "plot.png"
        fig.tight_layout()
        fig.savefig(plot_path, dpi=140)
        plt.close(fig)

        series = pd.DataFrame({"x": xs, "y": ys}).replace([np.inf, -np.inf], np.nan).dropna()
        preview = series.head(8).round(6).to_dict(orient="records")

        derivative = sp.diff(expr, self.x)
        try:
            domain = str(sp.calculus.util.continuous_domain(expr, self.x, sp.S.Reals))
        except Exception:
            domain = "Unable to determine symbolically"

        metadata = {
            "domain": domain,
            "derivative": sp.sstr(derivative),
            "critical_points": [sp.sstr(v) for v in sp.solve(sp.Eq(derivative, 0), self.x)],
            "sample_size": int(series.shape[0]),
        }

        return EngineResult(
            query=query,
            query_type="visualization",
            interpretation="Plot the function over x ∈ [-10, 10].",
            did_you_mean=None,
            steps=[
                f"Parsed function: f(x) = {sp.sstr(expr)}",
                "Generated 400 evenly spaced x-values.",
                "Evaluated f(x) numerically and rendered a labeled matplotlib chart.",
            ],
            exact_result=sp.sstr(expr),
            numeric_result=f"Data points: {series.shape[0]}",
            metadata=metadata,
            table_preview=preview,
            plot_path=str(plot_path),
        )

    def _handle_fact(self, query: str) -> EngineResult:
        q = query.lower()
        constants = {
            "pi": sp.pi,
            "e": sp.E,
            "golden ratio": sp.GoldenRatio,
            "speed of light": 299_792_458,
            "gravity": 9.80665,
        }
        hit = next((k for k in constants if k in q), None)

        if hit is None:
            return EngineResult(
                query=query,
                query_type="fact",
                interpretation="No supported verified fact matched.",
                did_you_mean="Try asking for pi, e, golden ratio, speed of light, or standard gravity.",
                steps=["Matched 'fact' intent but no supported constant was identified."],
                exact_result=None,
                numeric_result=None,
                metadata={"note": "Live astronomical distances require an ephemeris data source."},
                table_preview=None,
                plot_path=None,
            )

        value = constants[hit]
        if isinstance(value, sp.Basic):
            exact = sp.sstr(value)
            numeric = sp.sstr(sp.N(value, 16))
        else:
            exact = str(value)
            numeric = str(float(value))

        return EngineResult(
            query=query,
            query_type="fact",
            interpretation=f"Return verified constant: {hit}.",
            did_you_mean=None,
            steps=[f"Identified constant '{hit}' and returned reference value."],
            exact_result=exact,
            numeric_result=numeric,
            metadata={"constant": hit},
            table_preview=None,
            plot_path=None,
        )

    def _ambiguous(self, query: str) -> EngineResult:
        return EngineResult(
            query=query,
            query_type="unknown",
            interpretation="Ambiguous query; selected no execution path.",
            did_you_mean="Did you mean: 'Integrate x^2', 'Solve x^2-4', or 'Plot sin(x)'?",
            steps=["Could not safely parse a symbolic expression from the prompt."],
            exact_result=None,
            numeric_result=None,
            metadata={},
            table_preview=None,
            plot_path=None,
        )


if __name__ == "__main__":
    engine = ComputationalKnowledgeEngine()
    prompt = "Integrate x^2"
    result = engine.solve(prompt)
    print(result.to_dict())
