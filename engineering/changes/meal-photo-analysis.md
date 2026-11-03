# Meal photo and notes analysis

Date: 3 November 2026

## Goal and acceptance criteria

Extend FemFit's text-only meal analysis to accept a photo plus optional portion notes. Identify foods, estimate quantities and nutrition, and let the user review the estimate before saving.

- Offer distinct camera and gallery inputs with a preview and remove/replace action.
- Support photo-only, photo-plus-notes and existing text-only requests.
- Shrink photos locally and validate the server input before reserving quota.
- Send image and text together through the existing Claude or OpenAI provider.
- Validate the model result and calculate total calories on the server as before.
- Changing a photo, notes or meal type invalidates the previous estimate.
- Preserve inputs on analysis failure and persist food entries only after explicit confirmation.
- Do not save photos or image bytes in the database or diagnostic logs.

## Implementation and boundaries

The browser accepts JPEG, PNG and WebP files up to 20 MiB. It redraws them onto a canvas with a longest edge of 1536 pixels, without upscaling, and encodes JPEG at quality 0.82. This creates new pixels for upload without copying the original file's EXIF metadata. The encoded image must be no larger than 2 MiB. HEIC and other unsupported inputs produce a localized message. No codec dependency or lockfile change is needed.

The request contains a single base64 image and up to 500 characters of optional notes. Actual streamed JSON request bytes are capped at 3 MiB, including requests without Content-Length or with a misleading header. Server checks enforce canonical base64, byte size and a matching JPEG/PNG/WebP signature. They do not fully decode raster images or validate pixel dimensions. Malformed inputs fail before quota reservation. A request that passes these checks but later fails at the provider still consumes its authorized attempt.

The existing Claude Haiku 4.5 and GPT-4o mini configurations are retained. Claude receives a base64 image block before the text block. OpenAI receives an image_url data URI before the text block. Text-only messages remain strings. Provider output allowance increases to 2048 tokens for multi-food estimates. Authentication, daily quota rules and database structure are unchanged.

Prompts ask the model to consider actual consumed portions, plate-size notes, oil and sauces without counting a food twice. The old fixed 100 kcal minimum is removed. Both the UI and prompts describe nutrition as an estimate. A photo cannot establish exact weights or hidden ingredients, so the user is encouraged to add portion notes and review before saving. Foods can be removed from the result, or the user can adjust notes and re-analyze.

The preview and image payload live only in component memory. Closing the sheet aborts the client request, and late responses are ignored. Request input controls are disabled during analysis and saving. Client analysis has a 90-second deadline, including backend wake-up and upload time. The existing provider deadline remains 30 seconds.

Reports retain only the validated nutrition result, notes, meal/date metadata and a has_photo boolean. No image, image URL or original filename is inserted into reports or food entries. Analysis responses use Cache-Control: no-store. Photos are sent to the selected AI provider for processing, whose own retention policy is separate from FemFit's storage behavior.

## Verification

- Frontend tests: 98 passed, including API image/error mapping and image-dimension/source-limit checks.
- Backend tests: 59 passed, including both provider payload formats, photo-only/text compatibility, pre-quota rejection, base64/signature limits and streamed-body cancellation.
- Production browser smoke: 12 cases passed, including 5 new photo cases. The browser actually decodes and resizes synthetic images, then submits to intercepted APIs and saves to a synthetic database fixture.
- `npm run verify`: passed, 162 frontend/backend/hook tests in total, plus frontend and browser-test typechecks and backend compilation.
- `npm run build`: passed for frontend and backend. Existing bundle-size and stale Browserslist-data warnings remain.
- `git diff --check`: passed. Migration 003 matches HEAD with no diff.

No live provider requests or production health data were used. Browser fixtures block external services except the intercepted synthetic API. Physical camera capture, real-phone HEIC behavior, live photo accuracy and provider acceptance remain release checks. EXIF removal relies on browser canvas re-encoding and was not independently tested with a real EXIF-bearing camera photo. Client cancellation/timeout and failed photo-result saves were reviewed but are not covered by the new browser cases.

## Independent review

A fresh, read-only reviewer checked the implementation, privacy boundary, resource limits, provider payloads, stale-result handling and tests. It reported no actionable findings. It identified the verification limits above. The reviewer did not run tests, browsers or external services.

## Release and owner handoff

No database migration, new environment variable or dependency is required. Deploy the backend before the frontend so the image-aware endpoint is available when the new UI is published. Use the existing provider keys. Photo and text requests share the existing three free attempts per UTC day.

On a dedicated test account, verify a real meal photo with notes such as plate diameter, cooking method and the amount consumed. Check native camera and gallery selection on the target phone, verify that the estimate is plausible, and confirm saved portions after reload. Test unsupported files and unavailable provider behavior separately. Do not use synthetic browser results as evidence of nutrition accuracy.

Branch: feat/meal-photo-analysis. No commit, push or deployment was performed. The owner-requested restoration of migration 003 matches the committed file exactly and introduces no migration diff. Existing LinkedIn files remain untouched.

## Provider references

- [Claude vision inputs](https://platform.claude.com/docs/en/build-with-claude/vision)
- [OpenAI image inputs](https://developers.openai.com/api/docs/guides/images-vision)
- [GPT-4o mini modalities](https://developers.openai.com/api/docs/models/gpt-4o-mini)
