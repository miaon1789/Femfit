"""
synth_data.py — Synthetic health-tracking data with a KNOWN ground truth.

Why synthetic data: FemFit's adaptive-TDEE estimator and cycle-correlation test
are validated by recovering parameters we deliberately injected (true maintenance
calories, true cycle water-retention effect). Recovering known ground truth is a
stronger correctness argument than eyeballing a single real series.

The generative model mirrors the real domain:
  * Body weight follows an energy-balance ODE: dW = (intake - TDEE) / 7700.
  * Observed scale weight = latent (fat-mass) weight + cycle water retention
    + day-to-day hydration/glycogen/gut noise.
  * TDEE varies slightly day to day via NEAT (step count), so the estimator must
    recover the *average* maintenance level, not a constant.
"""
from __future__ import annotations

from dataclasses import dataclass, asdict

import numpy as np
import pandas as pd

KCAL_PER_KG = 7700.0  # energy density of body-mass change (kcal per kg)
CYCLE_LEN = 28


def phase_for(cycle_day: int) -> str:
    """Map a 1-based cycle day to a menstrual-cycle phase."""
    if cycle_day <= 5:
        return "menstrual"
    if cycle_day <= 13:
        return "follicular"
    if cycle_day <= 16:
        return "ovulation"
    return "luteal"


def _water_retention_kg(cycle_day: int, luteal_peak_kg: float) -> float:
    """
    Transient water weight (kg) as a function of cycle day.

    Rises through the luteal phase, peaks just before menstruation, then clears in
    the first few days of bleeding. Follicular/ovulation are near baseline.
    """
    if cycle_day >= 17:  # luteal: ramp 0 -> peak across days 17..28
        frac = (cycle_day - 16) / (CYCLE_LEN - 16)
        return luteal_peak_kg * frac
    if cycle_day <= 5:  # menstrual: clear from ~peak*0.7 down to ~0
        return luteal_peak_kg * 0.7 * (1 - (cycle_day - 1) / 5)
    if 14 <= cycle_day <= 16:  # ovulation: small bump
        return luteal_peak_kg * 0.12
    return 0.0  # follicular baseline


@dataclass
class GroundTruth:
    true_tdee: float          # average true maintenance calories
    deficit: float            # average intake deficit vs TDEE
    luteal_peak_kg: float     # injected luteal water-retention peak
    start_weight_kg: float
    expected_kg_per_week: float


def generate(
    n_days: int = 120,
    true_tdee: float = 2000.0,
    deficit: float = 350.0,
    start_weight: float = 68.0,
    luteal_peak_kg: float = 0.8,
    cycle_start_day: int = 8,
    seed: int = 42,
) -> tuple[pd.DataFrame, GroundTruth]:
    """
    Generate `n_days` of daily logs.

    Returns (df, ground_truth). df columns:
      date, day, cycle_day, phase, steps, intake_kcal,
      latent_weight_kg (unobservable true mass), weight_kg (observed scale value)
    """
    rng = np.random.default_rng(seed)
    dates = pd.date_range("2026-01-01", periods=n_days, freq="D")

    # Steps drive NEAT, so true TDEE wobbles day to day around `true_tdee`.
    steps = rng.normal(8000, 2500, n_days).clip(1500, 20000)
    tdee_t = true_tdee + (steps - 8000) * 0.04  # ~0.04 kcal per extra step

    # Intake: target = TDEE - deficit, with weekday/weekend pattern + noise.
    weekend = np.asarray(dates.dayofweek) >= 5
    intake = rng.normal(true_tdee - deficit, 220, n_days) + weekend * 180
    intake = intake.clip(1000, None)

    # Latent weight via energy balance (uses previous day's surplus/deficit).
    latent = np.empty(n_days)
    latent[0] = start_weight
    for t in range(1, n_days):
        latent[t] = latent[t - 1] + (intake[t - 1] - tdee_t[t - 1]) / KCAL_PER_KG

    cycle_day = ((np.arange(n_days) + (cycle_start_day - 1)) % CYCLE_LEN) + 1
    water = np.array([_water_retention_kg(int(d), luteal_peak_kg) for d in cycle_day])
    daily_noise = rng.normal(0, 0.25, n_days)  # hydration/glycogen/gut content

    observed = latent + water + daily_noise

    df = pd.DataFrame(
        {
            "date": dates,
            "day": np.arange(n_days),
            "cycle_day": cycle_day,
            "phase": [phase_for(int(d)) for d in cycle_day],
            "steps": steps.round().astype(int),
            "intake_kcal": intake.round().astype(int),
            "latent_weight_kg": latent.round(3),
            "weight_kg": observed.round(2),
        }
    )

    gt = GroundTruth(
        true_tdee=true_tdee,
        deficit=deficit,
        luteal_peak_kg=luteal_peak_kg,
        start_weight_kg=start_weight,
        expected_kg_per_week=-deficit / KCAL_PER_KG * 7,
    )
    return df, gt


if __name__ == "__main__":
    df, gt = generate()
    print("Ground truth:", asdict(gt))
    print(df.head(10).to_string(index=False))
    print(f"\n{len(df)} days | observed weight {df.weight_kg.iloc[0]} -> {df.weight_kg.iloc[-1]} kg")
