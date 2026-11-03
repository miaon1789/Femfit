# FemFit agent workflow

Use the repository `ship-change` skill in `.agents/skills/ship-change/SKILL.md` for implementation work. Claude Code reads these instructions through `CLAUDE.md` and uses the same skill through `.claude/skills/`.

- State the goal, acceptance criteria and a short plan before editing.
- Ask before changing database schemas, migrations or authentication and authorization behavior. Existing explicit approval covers the agreed scope.
- Environment files, migrations and dependency lockfiles are owner-managed. Explain necessary changes rather than bypassing a hook. Do not expose secrets or personal health data in logs, tests or documentation.
- Keep unrelated working tree changes intact. Do not commit, push or deploy unless the owner explicitly requests it. By default the owner reviews the diff and commits.
- Run `npm run verify` before claiming implementation is complete. Run `npm run build` for release readiness. Report failures and checks you could not run accurately.
- Request an independent read-only reviewer before handoff. Use `engineering/review-checklist.md`, give the reviewer the goal and diff, and resolve or report each finding. The reviewer reports problems and does not edit files. The owner decides unresolved disagreements.
- Draft a commit message with the change, verification results, review findings and remaining limits. Do not claim live-provider or browser E2E success from mocked tests or typechecking.

## Writing

Write clear, concise English in repository documentation and code comments. Prefer plain words, short and medium sentences, and a logical flow. Avoid em dashes, en dashes as punctuation, and semicolons in prose. Preserve punctuation required by code, technical syntax, identifiers and exact quotations. User-facing text uses the existing English and Chinese translation resources.
