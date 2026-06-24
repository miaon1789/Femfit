"""
data.py — One loader, any source.

The analysis code shouldn't care whether the data is synthetic, the developer's
own export, or a public dataset. `load_data` returns a DataFrame with a canonical
schema so every downstream module (adaptive_tdee, cycle_analysis, the notebook)
works unchanged regardless of where the numbers came from.

Canonical columns: date, day, weight_kg, intake_kcal, steps, phase
(synthetic data additionally carries latent_weight_kg and a GroundTruth object).
"""
from __future__ import annotations

import pandas as pd

from synth_data import generate, GroundTruth, phase_for

CANONICAL = ["date", "day", "weight_kg", "intake_kcal", "steps", "phase"]


def load_data(source: str = "synthetic", **kwargs) -> tuple[pd.DataFrame, GroundTruth | None]:
    """
    Load a daily health-log DataFrame.

    source="synthetic"  -> generate ground-truth data (kwargs forwarded to generate()).
    source=<path.csv>    -> read a real export from the FemFit app (or any public CSV
                            with date/weight_kg/intake_kcal/steps[/cycle_phase]).

    Returns (df, ground_truth). ground_truth is None for real data (unknowable).
    """
    if source == "synthetic":
        return generate(**kwargs)

    df = pd.read_csv(source)
    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values("date").reset_index(drop=True)
    df["day"] = range(len(df))

    # Accept either `phase` or the app's `cycle_phase` column name.
    if "phase" not in df.columns and "cycle_phase" in df.columns:
        df = df.rename(columns={"cycle_phase": "phase"})
    # If a cycle_day is present but phase isn't, derive phase from it.
    if "phase" not in df.columns and "cycle_day" in df.columns:
        df["phase"] = df["cycle_day"].astype(int).map(phase_for)

    missing = [c for c in ["date", "weight_kg", "intake_kcal"] if c not in df.columns]
    if missing:
        raise ValueError(f"CSV is missing required columns: {missing}")
    if "steps" not in df.columns:
        df["steps"] = pd.NA

    return df, None
