## Judge's Assessment

**Story**: P.5 — End-to-end test→fix→test validation loop
**Iteration**: 2 of 5 maximum
**Date**: 2026-05-07

---

### Summary

| Verdict | Count |
|---------|-------|
| APPROVED (must fix) | 0 |
| APPROVED (should fix) | 1 (M2 — accepted as a follow-up bookmark, not a blocker) |
| REJECTED (over-engineering) | 0 |
| REJECTED (out of scope) | 4 (L1, L2, L3, L4) |
| REJECTED (not valid) | 0 |
| ACCEPTED-AS-FOLLOWUP | 2 (M1, M2) |

### Verified Validation Results

- **Starting commit:** `781dc78b` (reviewer-verified at HEAD; pi gitlink in parent worktree advanced to this on disk)
- **Pre-existing failures (reviewer-reproduced):** none
- **HEAD results:** 88 / 0 (`pi/packages/context-bonsai` unit + integration suite); `pi npm run check` green; live `run-e2e.sh --all` 7/7 PASS at provider=openai-codex, model=gpt-5.3-codex (recorded in protocol Test Runs row)
- **Regressions:** none
- **Regression gate:** clear

The judge did not re-run the live e2e suite (cost, credentials). Trust the dev's record.

---

### Overall Verdict

**APPROVED AS-IS**

Iteration 2 lands the credential-discovery shim mandated by the spec amendment, fixes the iter-1 fail-fast bug, completes a green `run-e2e.sh --all` run with all seven scenarios passing, and backfills a Pi-specific regression test (`session_start hydrates turnCount`) for the multi-process gauge cadence path. All seven amended ACs are met. `npm run check` and the 88/88 vitest suite are green. The reviewer's two MEDIUM findings (M1, M2) are documentation/clarity concerns that do not break the contract; they are recorded as follow-up bookmarks against Story P.4 (where gauge cadence semantics originated). The four LOW findings are nice-to-haves outside the story's amended scope.

The source patch in `a25b3c4f` (extension `src/index.ts`) is in scope under the plan's "Test → Fix → Test Loop" rules: it was correctly classified as an extension bug (the in-memory turnCount counter could never reach cadence under Pi's `-p` print mode because each turn is a fresh process), the fix is minimal (15 lines + comment), and it lands with a deterministic regression test in `prompt.test.ts` per the plan's non-negotiable backfill rule. Although `src/index.ts` is not enumerated in the Worktree Artifact Check, the WAC explicitly authorizes "regression-test files discovered during the fix loop" and the plan body's Test → Fix → Test Loop rules authorize source patches when the bug classification is "extension bug" with regression backfill (story plan lines 121–126). Classification is justified.

---

### Finding-by-Finding Evaluation

#### [M1] Mixed cadence semantics across hydration boundary
- **Reviewer's Issue**: `gauge.ts:68` increments `state.turnCount` once per `context` event (per LLM call; tool-call turns can fire it multiple times in one user-prompt turn), while the new `session_start` hydrator at `index.ts:39-45` counts user-message session entries (one increment per user-prompt turn). For trivial sessions (Scenario E: 10 prompts with no tool calls) the two coincide. For sessions with tool-call turns in their history, hydration undercounts the prior in-process counter behaviour. The cross-agent spec uses SHOULD for cadence; the per-agent spec inherits that. Not a literal contract break.
- **Verdict**: ACCEPTED as a follow-up bookmark; **not a blocker for P.5**.
- **Reasoning**: The reviewer's reading of the two `turnCount` semantics is correct. The divergence is real but is contained within a SHOULD clause in both the cross-agent spec ("Gauge cadence SHOULD be every 5 turns by default") and the per-agent spec, which inherits SHOULD. No AC is violated; Scenario E is verified green; the iteration achieved a green live run; and the regression test (`session_start hydrates turnCount...` in `prompt.test.ts`) pins the actual contract that matters for Pi's `-p` print-mode use case (one user message ≈ one LLM-call turn at the boundary case the dev was solving). The reviewer's three suggested options ((a) document, (b) hydrate from assistant-role count, (c) accept and pin "turn") are all defensible; (b) would change cadence semantics enough to potentially fail some Pi multi-LLM-call-per-turn corner cases, and (c) is the smallest, most honest change. Either (a) or (c) is sufficient and both are sub-1-line edits. Choosing to defer rather than block: the iteration loop's purpose is to converge on a green live run, not to relitigate Story P.4's gauge architecture.
- **If Approved**: Bookmark for P.4 follow-up — prefer option (a)+(c): land a 1-paragraph note in `state.ts`'s comment header acknowledging the hydration path and clarifying that "turn" in the per-agent spec means "user-message-bounded turn" (the unit that hydrates from session JSONL), and that within a single process, the in-memory counter advances per `context` event for cadence prediction. Author-judgement on whether to also land a `gauge.ts` comment cross-reference. Do not change runtime behaviour.

#### [M2] Stale comment in `state.ts` after hydration patch
- **Reviewer's Issue**: `state.ts:19-20` says "no per-session keying needed for `turnCount` because the factory closure rebuilds on session reload"; this is now misleading given the new hydration. A future maintainer could remove the hydration as redundant.
- **Verdict**: ACCEPTED as a follow-up bookmark; **not a blocker for P.5**.
- **Reasoning**: The comment is genuinely stale and could mislead a future maintainer. The fix is a 1–2 line edit. However, requiring a fresh iteration just to land a comment-only edit is disproportionate to the project's "working implementation beats perfect design" stance. Bundle this with the M1 follow-up so they can be addressed together against P.4's gauge module in a single small commit.
- **If Approved**: Bookmark with M1; a single follow-up commit can address both.

#### [L1] Scenario A asserts via tool-call invocation rather than turn_start tool inventory
- **Reviewer's Issue**: Tightly couples to model compliance. Suggested: extend `eventStreamContainsTool` to scan `turn_start.tools`.
- **Verdict**: REJECTED (out of scope).
- **Reasoning**: AC 1 (Scenario A) requires `eventStreamContainsTool(log, "context-bonsai-prune") === true`, which the implementation satisfies. The reviewer's suggestion is a hardening enhancement, not a correctness fix. The dev's harness fix #2 in `717d81de` already addresses model-compliance fragility by issuing a deterministic-error tool-call payload (instructing the model to invoke both tools, which produces `tool_execution_end` events regardless of error). Switching to `turn_start.tools` inventory inspection would be more deterministic but is a future enhancement.

#### [L2] Breadcrumb files `.last_B_*` not in `.gitignore`
- **Reviewer's Issue**: If suite is interrupted between scenarios B and C, breadcrumb files leak.
- **Verdict**: REJECTED (out of scope).
- **Reasoning**: Cosmetic. The breadcrumbs are auto-cleaned at the end of every `--all` run (`run-e2e.sh:597-598`); only an interrupted run leaves them. Adding to `.gitignore` is trivial but is not in the amended ACs and does not block correctness. Easy to add as a separate one-liner if it becomes a real annoyance.

#### [L3] `e2e-credentials.test.ts` env cleanup list omits AWS / GCP Vertex env vars
- **Reviewer's Issue**: Comment implies completeness; only Anthropic/OpenAI vars are cleaned.
- **Verdict**: REJECTED (out of scope).
- **Reasoning**: The list at `e2e-credentials.test.ts:29-51` actually covers 21 env vars (all the keys listed in `env-api-keys.ts` for the providers Pi currently supports as bonsai e2e targets). AWS Bedrock and GCP Vertex use multi-variable credential chains (region + role + key id + secret) that would require fixture-shape changes to test correctly. The current fixtures cover the five mandated cases (i–v) plus three additional smoke checks. Adding bedrock/vertex coverage is appropriate when the harness adds those as opt-in providers; it's not a current-scope gap.

#### [L4] "Two consecutive green runs" claim isn't pinned in `docs/e2e-testing.md` Test Runs (only one row)
- **Reviewer's Issue**: Cosmetic; AC requires only one green run.
- **Verdict**: REJECTED (out of scope).
- **Reasoning**: The reviewer themselves note that the AC requires only one green run, which is met. The second consecutive run is corroborating evidence for the dev's commit body, not an AC.

---

### Loop/Conflict Detection

**Previous Iterations**: 1 (BLOCKED iteration without entering review; no judgment file produced)
**Recurring Issues**: None. Iter 1 was BLOCKED on a credential-discovery design defect (env-var-only gate). Iter 2 lands the spec-mandated `AuthStorage.hasAuth()` shim, which is a different issue class entirely.
**Conflicts Detected**: None.
**Assessment**: Healthy progress. The iteration lands the spec amendment correctly, completes the live green run, fixes 5 harness bugs uncovered by the live run, pivots 2 scenarios away from infeasible stdout assertions to deterministic side-effect assertions (with documented rationale), and backfills a regression test for the multi-process cadence path.

---

### Recommendations

**APPROVED AS-IS:** the implementation meets the amended ACs.

The dev should NOT make additional changes to this story. Follow-up bookmarks for P.4 are listed below; they can be picked up in a future iteration or rolled into a P.4 amendment, at the orchestrator's discretion. They are not blockers for closing P.5.

#### Follow-up bookmarks (filed against Story P.4, not P.5)

1. **Bookmark — gauge cadence semantics clarification.** In `pi/packages/context-bonsai/src/state.ts` (comment header) and the per-agent spec's "Gauge path" section, clarify that "turn" in the cadence rule means "user-message-bounded turn" — the unit that hydrates from session JSONL on `session_start`. Within a single process, the in-memory counter advances per `context` event so cadence is predictable across multi-LLM-call turns. Document the divergence so a future maintainer doesn't try to "simplify" the hydration away. Combine with bookmark #2.

2. **Bookmark — stale `state.ts` header comment.** Update the lines 19–20 comment to reflect the rebuild-via-hydration semantics; the current "no per-session keying needed because the factory closure rebuilds on session reload" is misleading post-iter-2.

Both bookmarks are 1–5 line edits with no runtime behaviour change. They can be addressed in a single follow-up commit.

---

### Complexity Guard Notes

- Rejected L1 (turn_start.tools inspection): adding a more deterministic Scenario A assertion is a hardening enhancement, not a correctness fix; the current assertion satisfies the AC and the harness already mitigates model-compliance fragility via deterministic-error tool-call payloads.
- Rejected L2 (`.gitignore` breadcrumbs): cosmetic; auto-cleanup on success path covers the common case.
- Rejected L3 (bedrock/vertex env-var cleanup): out of scope until those providers become bonsai e2e targets.
- Rejected L4 ("two green runs" doc pin): not an AC; corroborating evidence is sufficient in the commit body.
- Deferred M1 + M2 to follow-up bookmarks rather than blocking: both are documentation/clarity issues, not correctness or AC violations; deferring matches the "working implementation beats perfect design" stance and avoids relitigating Story P.4's architecture inside P.5's iteration cap.

---

### Source-patch scrutiny (story-specific judge note)

The plan's Worktree Artifact Check enumerates `check-credentials.ts`, `e2e-credentials.test.ts`, `run-e2e.sh`, `docs/e2e-testing.md`, and "regression-test files discovered during the fix loop" — but does **not** enumerate `src/index.ts` as a planned modification. The plan's "Test → Fix → Test Loop" rules (lines 119–126) explicitly authorize source patches when the fault classification is "extension bug" with regression backfill in the right Story's suite.

The dev classified the bug as "extension bug" because Pi's `-p` print mode runs each turn as a separate process, and the in-memory factory closure (per `state.ts` header) is rebuilt on session reload. The pre-patch code reset `state.turnCount = 0` on every invocation, so cadence could never fire. The patch hydrates `state.turnCount` from the persisted user-message count in `session_start`. This is the correct classification — the bug is in extension code, the fix lands in extension code, and the regression test (`prompt.test.ts:75-166`, "session_start hydrates turnCount...") would have caught it. The dev followed the plan's loop rules.

The classification is justified, the fix is minimal, and the regression backfill is non-negotiable per the plan and is in place.

---

### Live-run trust

Per the orchestrator's instruction, the judge did not re-run the live e2e suite. The dev's record at `pi/packages/context-bonsai/docs/e2e-testing.md` Test Runs row pins commit `717d81de` with provider=openai-codex / model=gpt-5.3-codex, all 7 scenarios PASS. Trusted.
