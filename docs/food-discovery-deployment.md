# Food discovery rollout

This release updates the frontend, backend and Supabase schema. The cycle fixes from the preceding change remain included. No production deployment or database migration has been run by this task.

## Deploy in this order

1. In Supabase SQL Editor, execute `supabase/migrations/002_food_discovery.sql`. It adds nullable metadata columns and the authenticated `search_foods` RPC. It does not delete food or meal records.
2. Execute `supabase/seed/recipe_estimates.sql` to add 12 reference recipes. This script is additive and rerunnable. Do **not** use the original `seed-foods.mjs` or `food_database.sql` for this upgrade: those scripts clear the global food table.
3. Deploy the updated `backend` on Render. Existing Supabase credentials and `FRONTEND_URL` remain required. Optionally set `USDA_API_KEY` to a FoodData Central API key obtained at https://fdc.nal.usda.gov/api-guide/. Keep this key on the server, never in a `VITE_` variable. Without it, barcode lookup and the local library still work; the ingredient tab explains that it is not enabled.
4. Deploy `frontend` on Vercel (Root Directory `frontend`, build `npm run build`, output `dist`). Keep `VITE_API_BASE_URL` pointing to the Render backend. If Git auto-deployment is enabled, merge/push only after the schema is ready. Existing environment variables are unchanged.
5. Check the production flows below with a test account. Refresh/reopen the installed PWA after deployment.

## Acceptance checks

- Search `番茄`, `tomato`, and an alias such as `西红柿鸡蛋面`; the last query requires the recipe seed. Exact names should precede weaker matches. Punctuation is passed as an RPC value, not interpolated into a filter.
- Quickly change/clear the query: old responses must not replace the new results. Simulate an unavailable source and confirm that an error is shown instead of an empty result.
- Select rice at 100 g / 116 kcal. Enter 150 g: 174 kcal. Change to 1 bowl: saving is blocked until a conversion is entered. Enter 150 g per bowl: 174 kcal.
- Save a custom food, reopen the sheet and reuse it under My foods. Remove it and verify it disappears. Sign in with a second test account and verify saved foods are isolated by RLS.
- Record a meal on an earlier date, then use Copy previous matching meal on a later date. All items should be appended together. No history should produce an explicit empty message. AI multi-food saves use the same batch path.
- Enter a real package barcode under Barcode. Compare the result and its nutrition basis with the packaging. Missing/failed results must not silently create a zero-calorie food.
- After configuring USDA, search an English ingredient such as `chicken breast`. Confirm source attribution, the 100 g basis and the raw/cooked description before saving.

## Source and portion choices

- Local names and aliases use case-insensitive token matching and exact/prefix ranking. No typo correction or automatic Chinese translation of USDA queries is claimed.
- Barcode lookup uses Open Food Facts API v2. The user enters the barcode; camera scanning is not included. Source attribution and an ODbL link are displayed. Responses are cached in memory for one hour, capped at 200 entries. Reference: https://openfoodfacts.github.io/openfoodfacts-server/api/ref-cheatsheet/
- USDA ingredient search is server-side and uses Foundation, SR Legacy and Survey (FNDDS), excluding branded results. Reference: https://fdc.nal.usda.gov/api-guide/
- External queries require a valid Supabase session, have a 10-second upstream timeout and a shared per-process budget of 20 uncached requests per minute. Multi-instance deployment would need a shared limiter/cache.
- Missing energy excludes an external result. Missing individual nutrients are not included in totals; the UI asks users to check the label. Open Food Facts uses the product's declared ml package unit when provided, otherwise g; users should verify the nutrition basis against the label.
- `recipe_estimates.json` documents explicit ingredient quantities and units. `node supabase/seed/gen-recipe-sql.mjs` calculates nutrition from the existing seed and regenerates the additive SQL. Values are reference recipes, not restaurant nutrition declarations. Water, cooking losses and unlisted seasonings are not modelled.
- Household portions require an explicit conversion to the selected food's base unit. Grams and millilitres are never automatically treated as equivalent.

## Validation performed locally

Frontend unit tests, backend normalization/route tests with mocked upstream responses, TypeScript and production builds. The food sheet was exercised in a browser using temporary synthetic fixtures, including mobile layout and the 150 g rice conversion. Real Supabase migration/RLS checks and live USDA requests require the deployment environment and remain release checks.
