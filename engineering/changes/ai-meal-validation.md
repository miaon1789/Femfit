# Worked change: validate AI meal estimates

Date: 3 November 2026

This record describes the initial AI validation change. Later quota, account, recovery and cache fixes are documented in the [reliability follow-up](reliability-hardening.md), which supersedes the initial limits around quota behavior and OpenAI-branch coverage.

## Goal and acceptance criteria

Make the AI meal-analysis boundary reliable and use the change to exercise FemFit's agent development workflow.

- Accept plain JSON, Markdown fences and surrounding explanatory text.
- Reject malformed JSON, missing fields, numeric strings, negative nutrients, invalid quantities and non-finite numbers before any report insert.
- Recalculate total calories from validated foods on the server.
- Return stable error codes and display errors through the current UI language.
- Cover parsing, route persistence and localized errors with synthetic fixtures and mocked I/O.
- Run the shared verification command, obtain independent review and leave an owner-ready diff and commit message.

Database schemas, authentication behavior, migrations, environment files and lockfiles are outside this change. The existing successful-report quota is retained. Its concurrency and abuse limits are not redesigned here.

## Implementation decisions

`backend/src/lib/aiMeal.ts` separates tolerant text parsing from strict Zod validation. JSON parsing returns `unknown`, so a TypeScript assertion cannot skip validation. Food names and units must be nonempty, quantities must be positive, and nutrients must be finite nonnegative numbers. An empty food array is valid for a description with no recognizable food. Unknown properties are stripped.

The response contract still requires a numeric model total, but the server replaces it with the sum of food calories, rounded to two decimal places. Overflowing totals are rejected. Only the validated result reaches the report insert. A failed insert returns an error rather than a success response without a saved report.

The meal UI translates known failures, including quota, authentication and invalid-output errors. Unexpected server text and network error messages fall back to the generic localized message. Diagnostics log validation paths and issue codes without raw provider output, meal descriptions or cycle data. The existing stored report metadata is unchanged.

The shared `ship-change` skill describes the workflow. Claude's PreToolUse hook blocks protected edit targets and common shell operations. Its Stop hook runs the same verification command used by CI, with a three-failure budget before an explicit human handoff. Hook regression tests cover blocking, symlink resolution, retry isolation and success after correction.

## Verification evidence

Local checks run during this change:

- Frontend typecheck and unit tests: passed, 12 files and 76 tests.
- Backend compilation and unit tests: passed, 37 tests.
- Hook regression tests: passed, 5 tests.
- Skill structure validator: passed.
- Full `npm run verify`: passed, 118 tests across frontend, backend and hooks, plus frontend and browser-test typechecks and backend compilation.
- `npm run build`: passed for both packages. Vite reported bundle-size and stale Browserslist-data warnings.
- Stop-hook CLI with a synthetic session payload: passed using the real verification runner.
- `git diff --check`: passed.

All provider and database calls in the new tests are mocked. These results do not establish live AI accuracy, deployed behavior or Playwright E2E success. Claude hook scripts were exercised locally, while activation inside a running Claude Code session still needs confirmation through `/hooks`. Remote CI runs after the owner pushes.

## Independent review

A fresh reviewer subagent performed a static, read-only review against `engineering/review-checklist.md`. It reported no actionable implementation findings. It checked the tracked diff and relevant new files, including parsing, persistence, error translations, tests and workflow scripts. There were no findings requiring code changes or unresolved disagreements.

The reviewer did not run tests or services. It explicitly identified the remaining limits: mocked Claude and Supabase calls, no OpenAI-branch route test, no live database isolation or browser interaction check, and no running-client hook activation check. Those limits remain documented rather than being treated as passes. The main implementation session ran the verification and build commands above.

The reviewer also requested replacing the provisional verification and review notes with observed results. This record now includes those results. The owner still needs to review and accept the diff and commit. A [draft commit message](ai-meal-validation.commit.txt) is included for that handoff.

## Demonstration preparation

Use a dedicated demo account with synthetic health entries. No real account or personal health data is needed to explain this change. Before recording, open the deployed app and run a meal analysis once to check service readiness. Live behavior has not been verified by the local unit tests.

Suggested walkthrough:

1. Explain the product as a weight and body-composition app with cycle-aware calorie targets.
2. Show a meal estimate in the demo account and explain that it remains an estimate the user reviews.
3. Open the parser and schema. Show how valid JSON can still have an invalid structure.
4. Show a test with a model total of 999 kcal that becomes 200 kcal on the server.
5. Run `npm run verify`. Show the invalid-output test and explain that no report is inserted.
6. Show the review record and proposed commit message, then review the diff yourself before committing.

Only say that live analysis or browser E2E passed after personally observing those checks. The screenshot assets and demo-account data were not changed in this implementation.
