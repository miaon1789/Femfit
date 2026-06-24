"""
cycle_analysis.py — Does menstrual-cycle phase move scale weight?

FemFit's core message is that luteal/pre-menstrual "weight gain" is largely water,
not fat — so users shouldn't panic. This module tests that claim statistically.

Method:
  1. Detrend: remove the fat-loss trend (OLS weight ~ day) and keep residuals, so
     we isolate cyclic/short-term variation from the long-run downward trend.
  2. One-way ANOVA of residuals across the four phases.
  3. Targeted luteal-vs-follicular t-test (the actionable comparison) + Cohen's d.

On synthetic data with an injected luteal water effect, the test should recover a
significant luteal elevation — confirming the method detects what we put in.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
import statsmodels.api as sm
from scipy import stats

PHASE_ORDER = ["menstrual", "follicular", "ovulation", "luteal"]


def detrend_weight(df: pd.DataFrame, weight_col: str = "weight_kg", day_col: str = "day") -> pd.Series:
    """Return weight residuals after removing the linear time trend."""
    X = sm.add_constant(df[day_col].to_numpy(dtype=float))
    model = sm.OLS(df[weight_col].to_numpy(dtype=float), X).fit()
    return pd.Series(model.resid, index=df.index, name="weight_resid")


def _cohens_d(a: np.ndarray, b: np.ndarray) -> float:
    na, nb = len(a), len(b)
    pooled = np.sqrt(((na - 1) * a.var(ddof=1) + (nb - 1) * b.var(ddof=1)) / (na + nb - 2))
    return float((a.mean() - b.mean()) / pooled) if pooled > 0 else 0.0


def analyze(df: pd.DataFrame, weight_col: str = "weight_kg") -> dict:
    """Run the full cycle-vs-weight analysis. Returns a results dict."""
    d = df.copy()
    d["weight_resid"] = detrend_weight(d, weight_col=weight_col)

    by_phase = (
        d.groupby("phase")["weight_resid"]
        .agg(["mean", "std", "count"])
        .reindex(PHASE_ORDER)
        .round(3)
    )

    groups = [d.loc[d.phase == p, "weight_resid"].to_numpy() for p in PHASE_ORDER if (d.phase == p).any()]
    f_stat, anova_p = stats.f_oneway(*groups)

    luteal = d.loc[d.phase == "luteal", "weight_resid"].to_numpy()
    follicular = d.loc[d.phase == "follicular", "weight_resid"].to_numpy()
    t_stat, t_p = stats.ttest_ind(luteal, follicular, equal_var=False)

    return {
        "by_phase": by_phase,
        "anova_F": round(float(f_stat), 3),
        "anova_p": float(anova_p),
        "luteal_vs_follicular_kg": round(float(luteal.mean() - follicular.mean()), 3),
        "luteal_vs_follicular_p": float(t_p),
        "cohens_d": round(_cohens_d(luteal, follicular), 3),
    }


if __name__ == "__main__":
    from synth_data import generate

    df, gt = generate()
    res = analyze(df)
    print("=== Mean detrended weight by cycle phase (kg) ===")
    print(res["by_phase"].to_string())
    print(f"\nANOVA across phases:        F={res['anova_F']}, p={res['anova_p']:.2e}")
    print(f"Luteal - follicular:        {res['luteal_vs_follicular_kg']:+.3f} kg "
          f"(p={res['luteal_vs_follicular_p']:.2e}, Cohen's d={res['cohens_d']})")
    print(f"\nInjected luteal water peak: {gt.luteal_peak_kg} kg  (method should detect a luteal elevation)")
