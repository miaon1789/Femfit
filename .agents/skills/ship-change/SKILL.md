---
name: ship-change
description: Implement and verify a scoped FemFit product change, including acceptance criteria, protected-change checks, independent review and an owner-ready diff. Use for FemFit implementation work, not general discussion.
---

# Ship a FemFit change

1. Read `AGENTS.md` and inspect the working tree. State the requested outcome, observable acceptance criteria and a short plan. Preserve unrelated edits.
2. Identify protected work before editing. Database schemas, migrations and auth behavior need owner approval unless already explicitly authorized. Environment files, migration files and lockfiles are owner-managed. Explain necessary changes and do independent work while awaiting a required decision. Never disable a guard to make a change pass.
3. Implement the smallest complete change. Treat AI output as untrusted at the server boundary. Validate before persistence, calculate deterministic values in code, and keep error codes separate from translated UI text. Use synthetic fixtures and mocked services for tests. Do not log raw meal or cycle data.
4. Add regression tests for the observed failure and relevant error paths. Run `npm run verify` from the root. For release readiness also run `npm run build`. Fix failures before handoff. A Stop-hook retry limit is a human handoff, not a passing result.
5. Request a fresh, read-only reviewer using `engineering/review-checklist.md`. In Claude Code use `femfit-reviewer`. In Codex use an independent reviewer subagent when available, or explicitly report that independent review remains pending. Give the reviewer the goal and current diff. Ask for findings with file locations, impact and reproduction evidence. Do not tell them what conclusion to reach.
6. Assess each finding. Fix supported issues and rerun affected checks. Record any disagreement for the owner. Never silently mark a finding resolved or invent reviewer approval.
7. Present the diff summary and a draft commit message containing what changed, actual checks and results, review findings and their disposition, and remaining limits. Leave commit, push and deployment to the owner unless explicitly requested.

Read `engineering/agent-workflow.md` when configuring or diagnosing hooks. Claude hooks do not enforce Codex tool calls. Both clients use the verification command and CI, while Codex also relies on its configured sandbox and approvals.
