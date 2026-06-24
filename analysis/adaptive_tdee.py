"""
adaptive_tdee.py — Estimate a user's true maintenance calories (TDEE) from data.

Textbook TDEE (Mifflin-St Jeor x activity factor) is a population prior; an
individual's real maintenance can be off by hundreds of kcal. Given a history of
daily intake and scale weight we can estimate it directly from energy balance:

    d(weight) / dt  =  (intake - TDEE) / KCAL_PER_KG

Average over a window: mean_intake - TDEE = (mean daily weight change) * KCAL_PER_KG

    =>  TDEE = mean_intake - slope_kg_per_day * KCAL_PER_KG

where slope_kg_per_day is the OLS trend of weight over time (which averages out the
zero-mean hydration noise and the near-periodic cycle water term). We also report a
confidence interval and an expanding-window estimate that "adapts" as data arrives.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
import statsmodels.api as sm

KCAL_PER_KG = 7700.0


def estimate_tdee(
    df: pd.DataFrame,
    intake_col: str = "intake_kcal",
    weight_col: str = "weight_kg",
    day_col: str = "day",
) -> dict:
    """
    Energy-balance TDEE estimate with a 95% confidence interval.

    Returns dict: tdee, ci_low, ci_high, slope_kg_per_week, mean_intake, n_days.
    """
    d = df.dropna(subset=[intake_col, weight_col, day_col])
    n = len(d)
    if n < 14:
        raise ValueError("need >= 14 days of data for a stable estimate")

    # OLS weight ~ day  -> slope (kg/day) and its standard error
    X = sm.add_constant(d[day_col].to_numpy(dtype=float))
    model = sm.OLS(d[weight_col].to_numpy(dtype=float), X).fit()
    slope = model.params[1]
    slope_se = model.bse[1]

    mean_intake = float(d[intake_col].mean())
    intake_se = float(d[intake_col].std(ddof=1) / np.sqrt(n))

    tdee = mean_intake - slope * KCAL_PER_KG
    # Var(TDEE) = Var(mean_intake) + KCAL_PER_KG^2 * Var(slope)  (independent terms)
    tdee_se = np.sqrt(intake_se**2 + (KCAL_PER_KG * slope_se) ** 2)

    return {
        "tdee": round(float(tdee), 1),
        "ci_low": round(float(tdee - 1.96 * tdee_se), 1),
        "ci_high": round(float(tdee + 1.96 * tdee_se), 1),
        "slope_kg_per_week": round(float(slope) * 7, 3),
        "mean_intake": round(float(mean_intake), 1),
        "n_days": int(n),
    }


def expanding_tdee(
    df: pd.DataFrame,
    min_days: int = 21,
    **cols: str,
) -> pd.DataFrame:
    """
    Re-estimate TDEE using all data up to each day (expanding window). Shows how the
    estimate converges/adapts as more days accumulate — the 'adaptive' in the name.
    """
    rows = []
    for t in range(min_days, len(df) + 1):
        try:
            est = estimate_tdee(df.iloc[:t], **cols)
            rows.append({"through_day": t, **est})
        except ValueError:
            continue
    return pd.DataFrame(rows)


if __name__ == "__main__":
    from synth_data import generate

    df, gt = generate()
    est = estimate_tdee(df)
    print("=== Adaptive TDEE estimate ===")
    for k, v in est.items():
        print(f"  {k:18}: {v}")
    err = est["tdee"] - gt.true_tdee
    hit = est["ci_low"] <= gt.true_tdee <= est["ci_high"]
    print(f"\n  ground-truth TDEE : {gt.true_tdee}")
    print(f"  estimate error    : {err:+.1f} kcal")
    print(f"  truth in 95% CI?  : {hit}")
