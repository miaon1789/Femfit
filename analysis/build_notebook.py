"""
build_notebook.py — Programmatically assemble femfit_analysis.ipynb.

Keeping the notebook in a generator (rather than hand-edited JSON) makes it
diff-friendly and reproducible. Run this, then execute with:

    python build_notebook.py
    jupyter nbconvert --to notebook --execute --inplace femfit_analysis.ipynb
"""
import nbformat as nbf

md = nbf.v4.new_markdown_cell
code = nbf.v4.new_code_cell

cells = [
    md(
        "# FemFit — Adaptive TDEE & Cycle-Weight Analysis\n"
        "\n"
        "The data-science layer behind [FemFit](../README.md): turning a user's daily "
        "logs (weight, calorie intake, steps, menstrual cycle) into two evidence-based "
        "features that go beyond textbook formulas.\n"
        "\n"
        "**Why synthetic data here is a feature, not a cop-out:** you *cannot* validate a "
        "maintenance-calorie (TDEE) estimator on real data, because a person's true TDEE is "
        "unobservable — there is no ground truth. So we generate data with a *known* injected "
        "TDEE and a *known* cycle water-retention effect, and check the estimators recover "
        "them. The exact same code then runs on real data — see the last section."
    ),
    code(
        "import sys; sys.path.insert(0, '.')\n"
        "import numpy as np, pandas as pd\n"
        "import matplotlib.pyplot as plt\n"
        "from data import load_data\n"
        "from adaptive_tdee import estimate_tdee, expanding_tdee\n"
        "from cycle_analysis import analyze, detrend_weight\n"
        "\n"
        "plt.rcParams.update({'figure.figsize': (9, 4), 'axes.grid': True,\n"
        "                     'grid.alpha': 0.3, 'figure.dpi': 110})\n"
        "PHASE_COLORS = {'menstrual': '#fca5a5', 'follicular': '#86efac',\n"
        "                'ovulation': '#fde047', 'luteal': '#c4b5fd'}\n"
        "PHASE_ORDER = ['menstrual', 'follicular', 'ovulation', 'luteal']"
    ),
    md(
        "## 1. Load data\n"
        "\n"
        "`load_data` returns a canonical daily table regardless of source. Here we load "
        "120 synthetic days with a true TDEE of 2000 kcal and an injected luteal "
        "water-retention peak of 0.8 kg."
    ),
    code(
        "df, gt = load_data('synthetic', n_days=120, true_tdee=2000, deficit=350,\n"
        "                   luteal_peak_kg=0.8, seed=42)\n"
        "print('Ground truth:', gt)\n"
        "df.head()"
    ),
    md(
        "## 2. The problem: scale weight is noisy and cycle-confounded\n"
        "\n"
        "Observed weight = slow fat-mass trend + **cyclic water retention** + daily hydration "
        "noise. The luteal/pre-menstrual rise is water, not fat — the shaded phases below make "
        "the confound visible. A naive day-to-day reading would panic the user."
    ),
    code(
        "fig, ax = plt.subplots()\n"
        "prev, start = None, 0\n"
        "for i, ph in enumerate(df.phase):\n"
        "    if ph != prev:\n"
        "        if prev is not None:\n"
        "            ax.axvspan(start, df.day.iloc[i - 1], color=PHASE_COLORS[prev], alpha=0.35, lw=0)\n"
        "        prev, start = ph, df.day.iloc[i]\n"
        "ax.axvspan(start, df.day.iloc[-1], color=PHASE_COLORS[prev], alpha=0.35, lw=0)\n"
        "ax.plot(df.day, df.weight_kg, color='#ec4899', lw=1, marker='o', ms=3, label='Observed weight')\n"
        "ax.plot(df.day, df.weight_kg.rolling(7, min_periods=1).mean(), color='#7c3aed', lw=2, ls='--', label='7-day average')\n"
        "if 'latent_weight_kg' in df.columns:\n"
        "    ax.plot(df.day, df.latent_weight_kg, color='black', lw=1.2, alpha=0.6, label='True (latent) weight')\n"
        "handles = [plt.Rectangle((0, 0), 1, 1, color=PHASE_COLORS[p], alpha=0.5) for p in PHASE_ORDER]\n"
        "leg1 = ax.legend(handles, PHASE_ORDER, title='Cycle phase', loc='upper right', fontsize=8)\n"
        "ax.add_artist(leg1); ax.legend(loc='lower left', fontsize=8)\n"
        "ax.set_xlabel('Day'); ax.set_ylabel('Weight (kg)')\n"
        "ax.set_title('Daily weight with menstrual-cycle phases shaded')\n"
        "plt.tight_layout(); plt.show()"
    ),
    md(
        "## 3. Adaptive TDEE estimation (energy balance)\n"
        "\n"
        "Textbook TDEE (Mifflin-St Jeor × activity factor) is a population prior. We estimate "
        "the *personal* maintenance level directly from energy balance:\n"
        "\n"
        "$$\\frac{d(\\text{weight})}{dt} = \\frac{\\text{intake} - \\text{TDEE}}{7700}\n"
        "\\;\\Rightarrow\\; \\text{TDEE} = \\overline{\\text{intake}} - "
        "\\text{slope}_{kg/day}\\times 7700$$\n"
        "\n"
        "The OLS weight slope averages out the zero-mean hydration noise and the near-periodic "
        "cycle water term. The expanding-window plot shows the estimate converging onto the "
        "true value as data accumulates, with its 95% CI."
    ),
    code(
        "est = estimate_tdee(df)\n"
        "print('Estimated TDEE :', est['tdee'], 'kcal   95% CI', (est['ci_low'], est['ci_high']))\n"
        "print('True TDEE      :', gt.true_tdee, 'kcal')\n"
        "print('Error          : %+.1f kcal' % (est['tdee'] - gt.true_tdee))\n"
        "print('Truth in CI?   :', est['ci_low'] <= gt.true_tdee <= est['ci_high'])\n"
        "\n"
        "exp = expanding_tdee(df)\n"
        "fig, ax = plt.subplots()\n"
        "ax.plot(exp.through_day, exp.tdee, color='#2563eb', lw=2, label='Estimated TDEE')\n"
        "ax.fill_between(exp.through_day, exp.ci_low, exp.ci_high, color='#2563eb', alpha=0.15, label='95% CI')\n"
        "ax.axhline(gt.true_tdee, color='black', ls='--', lw=1.2, label=f'True TDEE = {gt.true_tdee:.0f}')\n"
        "ax.set_xlabel('Days of data used'); ax.set_ylabel('TDEE (kcal)')\n"
        "ax.set_title('Adaptive TDEE estimate converges as data accumulates')\n"
        "ax.legend(fontsize=8); plt.tight_layout(); plt.show()"
    ),
    md(
        "## 4. Does cycle phase move scale weight? (hypothesis test)\n"
        "\n"
        "We detrend weight (remove the fat-loss slope) to isolate short-term variation, then "
        "compare residuals across phases with one-way ANOVA and a targeted "
        "luteal-vs-follicular *t*-test with Cohen's *d*. The method should recover the luteal "
        "elevation we injected."
    ),
    code(
        "res = analyze(df)\n"
        "print(res['by_phase'].to_string())\n"
        "print()\n"
        "print('ANOVA across phases : F=%.2f, p=%.2e' % (res['anova_F'], res['anova_p']))\n"
        "print('Luteal - follicular : %+.3f kg (p=%.2e, Cohen d=%.2f)'\n"
        "      % (res['luteal_vs_follicular_kg'], res['luteal_vs_follicular_p'], res['cohens_d']))\n"
        "\n"
        "d2 = df.copy(); d2['resid'] = detrend_weight(d2)\n"
        "groups = [d2.loc[d2.phase == p, 'resid'].values for p in PHASE_ORDER]\n"
        "fig, ax = plt.subplots()\n"
        "bp = ax.boxplot(groups, tick_labels=PHASE_ORDER, patch_artist=True)\n"
        "for patch, p in zip(bp['boxes'], PHASE_ORDER):\n"
        "    patch.set_facecolor(PHASE_COLORS[p]); patch.set_alpha(0.7)\n"
        "ax.axhline(0, color='gray', lw=0.8)\n"
        "ax.set_ylabel('Detrended weight (kg)')\n"
        "ax.set_title('Water-weight elevation in luteal / menstrual phases')\n"
        "plt.tight_layout(); plt.show()"
    ),
    md(
        "## 5. Same code, real data\n"
        "\n"
        "Nothing above is tied to synthetic data. Export your own history from the FemFit app "
        "(**Profile → Download my data**) and point the loader at the CSV:\n"
        "\n"
        "```python\n"
        "df, gt = load_data('my_femfit_export.csv')   # gt is None for real data\n"
        "estimate_tdee(df)                            # same estimator\n"
        "analyze(df)                                  # same test\n"
        "```\n"
        "\n"
        "With real data there is no ground-truth line to compare against — instead you compare "
        "the learned TDEE to the textbook estimate and watch it personalize over time. That "
        "learned value is fed back into the app's calorie engine."
    ),
    md(
        "## Takeaways\n"
        "\n"
        "- **Adaptive TDEE** recovers the true maintenance level to within tens of kcal, with a "
        "calibrated CI — a data-driven replacement for a population formula.\n"
        "- **Cycle-weight test** detects the injected luteal water effect at large effect size, "
        "validating FemFit's core message that pre-menstrual 'gain' is water, not fat.\n"
        "- The pipeline is **source-agnostic** (synthetic ↔ real ↔ public) and wired back into "
        "the product, not a standalone notebook."
    ),
]

nb = nbf.v4.new_notebook(cells=cells)
nb.metadata = {
    "kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"},
    "language_info": {"name": "python"},
}
with open("femfit_analysis.ipynb", "w") as f:
    nbf.write(nb, f)
print("wrote femfit_analysis.ipynb with", len(cells), "cells")
