# FemFit — Data Science Layer

Turning FemFit's longitudinal health logs (weight, calorie intake, steps, menstrual
cycle) into two evidence-based features that go beyond textbook formulas.

> 📓 **Start here:** [`femfit_analysis.ipynb`](femfit_analysis.ipynb) — the executed
> notebook with charts (weight + cycle phases, TDEE convergence, cycle-weight boxplots).
> It renders directly on GitHub.

The methods are **validated against known ground truth**: we generate synthetic data
with deliberately injected parameters (a true maintenance-calorie level and a true
luteal water-retention effect), then check the estimators recover them. Recovering
what we injected is a far stronger correctness argument than eyeballing one real
series — and it cleanly separates "the method works" from "this particular user".

## 1. Adaptive TDEE estimation (`adaptive_tdee.py`)

Textbook TDEE (Mifflin-St Jeor × activity factor) is a population prior that can be
hundreds of kcal off for an individual. We estimate the *personal* maintenance level
directly from energy balance:

```
d(weight)/dt = (intake − TDEE) / 7700        (7700 kcal ≈ 1 kg body mass)
⇒  TDEE = mean_intake − weight_slope_kg_per_day × 7700
```

`weight_slope` is the OLS trend of scale weight over time, which averages out the
zero-mean hydration noise and the near-periodic cycle water term. We report a 95% CI
that propagates uncertainty from both the intake mean and the slope, plus an
expanding-window estimate that adapts as data accumulates.

**Validation (120 synthetic days, true TDEE = 2000 kcal):**

| | value |
|---|---|
| Estimated TDEE | **1985 kcal** (error −15) |
| 95% CI | [1940, 2030] — contains truth ✅ |
| Recovered weight trend | −0.27 kg/week |

## 2. Cycle-phase weight effect (`cycle_analysis.py`)

FemFit's core message: luteal/pre-menstrual "weight gain" is mostly water, not fat —
so don't panic. We test it: detrend weight (remove the fat-loss slope), then compare
residuals across cycle phases with one-way ANOVA and a targeted luteal-vs-follicular
t-test + Cohen's d.

**Validation (injected luteal water peak = 0.8 kg):**

| | value |
|---|---|
| Luteal − follicular | **+0.43 kg** |
| t-test p | 2.6 × 10⁻⁸ |
| Cohen's d | 1.29 (large) |
| ANOVA across 4 phases | F = 12.4, p = 4.5 × 10⁻⁷ |

The method recovers the injected luteal elevation — confirming FemFit can flag
cycle-driven fluctuation to a real user from their own data.

## 3. Closing the loop — back into the product

A model that stays in a notebook doesn't help a user. The adaptive-TDEE estimator is
**wired back into the live app**, so the analysis *is* the feature:

```
weight_logs + meal_logs (Supabase)
        │   60-day pull
        ▼
useMaintenanceTDEE  ──►  estimateMaintenanceTDEE()      # same energy-balance method
        │                (TS port of adaptive_tdee.py)
        ▼
dataTDEE  ──►  computeDailyCalorieTarget()              # tdee = dataTDEE ?? formulaTDEE
        │
        ▼
   in-app calorie target shown on the dashboard
```

Until a user has ~3 weeks of history the app falls back to the Mifflin-St Jeor
population prior; once enough data exists, the daily target switches to the user's
**measured** maintenance level. The app can also export its real history as a CSV in the
exact schema this notebook consumes (`date, weight_kg, intake_kcal, steps, phase`), so
the offline analysis and the production estimator run on identical data.

| layer | file |
|---|---|
| Python reference + validation | `analysis/adaptive_tdee.py` |
| TS production estimator | `frontend/src/lib/calorieEngine.ts` → `estimateMaintenanceTDEE` |
| data hook | `frontend/src/hooks/useMaintenanceTDEE.ts` |
| CSV export (notebook-ready) | `frontend/src/lib/exportData.ts` |

## Limitations & honesty

- **Synthetic-for-validation, by design.** The headline tables use synthetic data so the
  estimators can be checked against *known* ground truth — the correct way to prove a
  method works. The same `load_data` loader accepts real CSV exports; the production TS
  estimator already runs on live user data.
- **Energy balance is a model, not physics.** The 7700 kcal/kg constant and the
  steady-state assumption ignore glycogen/water swings and adaptive thermogenesis; the
  OLS slope deliberately averages these out over weeks, which is why we require ≥21 days.
- **Cycle phases are derived**, not hormonally measured — they come from user-logged
  period dates, so phase labels inherit any logging noise.

## Files

| file | role |
|---|---|
| `synth_data.py` | energy-balance generative model with known ground truth |
| `adaptive_tdee.py` | personal-maintenance-calorie estimator (OLS + CI + expanding window) |
| `cycle_analysis.py` | detrend + ANOVA / t-test / effect size for cycle-vs-weight |
| `requirements.txt` | numpy, pandas, scipy, scikit-learn, statsmodels, matplotlib, jupyter |

## Run

```bash
cd analysis
pip install -r requirements.txt
python adaptive_tdee.py     # prints estimate vs ground truth
python cycle_analysis.py    # prints phase effect + significance
```

## Roadmap

- [x] Executed Jupyter notebook with plots tying both analyses together.
- [x] Pluggable `load_data` loader so synthetic and real CSV exports are interchangeable.
- [x] Surface the estimated TDEE back into the app's calorie engine (closed loop).
- [ ] State-space / Kalman variant that jointly de-noises latent weight and TDEE.
- [ ] Plateau (change-point) detection on the weight trend.
