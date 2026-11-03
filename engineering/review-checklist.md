# FemFit review checklist

Review the goal and actual diff independently. Report observable problems rather than style preferences.

- AI output: malformed JSON and invalid structures fail before persistence. Numeric strings, negative or non-finite nutrition values cannot pass. Server calculations replace model arithmetic.
- Persistence: only validated values are saved for the authenticated user. A storage failure cannot produce a success response. Existing data isolation and auth remain intact.
- UI: error codes map to English and Chinese resources. Raw provider or server text cannot reach the meal error display. Failed analysis or saving leaves a recoverable state.
- Tests: include the original failure, realistic formatting variants, structurally invalid JSON and relevant route failures. Mocked I/O must not contact real providers or databases.
- Workflow: protected edits are blocked through the documented tool paths. Verify scripts fail on failed checks. Stop retries terminate with an explicit human handoff and never imply a passing result.
- Scope and evidence: unrelated edits remain intact. No secrets or personal health data enter the diff or logs. README and handoff claims match checks actually run. Live E2E, hook activation in a client, and deployment are reported separately.

For each finding give priority, file and line, trigger, consequence and a suggested verification. State when no actionable findings remain and what was not exercised.
