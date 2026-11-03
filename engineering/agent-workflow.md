# Developing FemFit with agents

The owner sets the goal and accepts the final diff. Claude Code or Codex implements a scoped change. Deterministic scripts check the result and an independent reviewer looks for missed failures.

```text
Goal and acceptance criteria -> plan -> implementation -> verify
  -> read-only review -> owner reviews diff and commits -> CI
```

## Start a change

In Claude Code invoke `/ship-change <goal>`. In Codex invoke `$ship-change <goal>`. The canonical skill lives in `.agents/skills/ship-change/`. The Claude skill directory is a symlink to that source. `CLAUDE.md` imports `AGENTS.md` so both clients share project instructions.

Ask the agent for observable acceptance criteria, then let it implement ordinary code and test changes. Schema or auth behavior changes require approval. Environment files, migration files and lockfiles are owner-managed. The default handoff includes a proposed commit message, while the owner runs `git diff`, stages selected files and commits.

## Deterministic checks

Install the frontend and backend dependencies before starting an agent session. Run:

```bash
npm run verify
npm run build
```

`verify` runs hook regression tests, frontend typechecking, browser-test typechecking, frontend unit tests and backend compilation and unit tests. It exits on the first failure. Browser-test typechecking does not run Playwright. Actual browser E2E needs a separate Supabase test project and test credentials.

GitHub Actions runs the same `npm run verify` command and production builds for pull requests and pushes to `main`. Configure required status checks in GitHub if merges must be blocked. A workflow file alone does not enable branch protection.

Separate CI jobs run production browser smoke tests with synthetic APIs and database permission/quota checks on disposable PostgreSQL. Use `npm run test:smoke --prefix frontend` for the browser checks. Use `npm run test:db` only with an empty local `femfit_test` database. See the [reliability change record](changes/reliability-hardening.md) for setup and the distinction between synthetic checks and hosted E2E.

## Claude hooks

`.claude/settings.json` registers `scripts/agent-hooks.mjs` for `PreToolUse` and `Stop`. Restart or reload Claude Code after adding project hooks, then inspect `/hooks` to confirm that they are active.

- The edit guard rejects `Write`, `Edit`, `MultiEdit` and `NotebookEdit` targets matching `.env*`, dependency lockfiles or `supabase/migrations/`. It resolves relative paths and existing symlinks.
- The shell guard conservatively blocks explicit protected-path references, common dependency installation commands and Git rewrites. This can block a read command naming a protected file. Ask the owner to handle that operation rather than obfuscating the command.
- A blocked operation exits with code 2 and explains the restriction. There is no agent-controlled bypass flag.
- The Stop gate runs `verify` on each attempt. Failures block stopping with code 2 and return bounded output. It allows three failed attempts per stop sequence. On the next attempt it permits a human handoff with an explicit failure message. A new user turn resets the retry budget. Counters are session-specific and ignored by Git.

Local hooks prevent common mistakes. They are editable repository code and do not form a complete security boundary against arbitrary shell scripts, generated commands, unhandled tools or changes made by another client. Stronger protection needs a sandbox or filesystem policy controlled outside the agent. CI validates results independently but does not block a local file write.

These hooks apply to Claude Code. This repository does not claim that Codex runs Claude hook events. Codex follows the shared skill and uses the same verification command, its configured sandbox and approval policy, and CI.

## Independent review and handoff

Claude's `femfit-reviewer` has only Read, Grep and Glob tools. Supply a diff file and the goal. Codex can use a fresh reviewer subagent with read-only instructions. This is an instruction boundary unless the reviewer session also has write access disabled. Both use `engineering/review-checklist.md`.

Resolve supported findings, rerun checks after fixes, and leave unresolved disagreements to the owner. The final handoff should distinguish tests from assumptions. Include what changed, validation results, reviewer findings and their disposition, and any untested behavior in the proposed commit message.

## Documentation references

- [Codex skills](https://learn.chatgpt.com/docs/build-skills)
- [Claude Code hooks](https://code.claude.com/docs/en/hooks)
- [Claude Code subagents](https://code.claude.com/docs/en/sub-agents)
- [Claude Code skills](https://code.claude.com/docs/en/skills)
