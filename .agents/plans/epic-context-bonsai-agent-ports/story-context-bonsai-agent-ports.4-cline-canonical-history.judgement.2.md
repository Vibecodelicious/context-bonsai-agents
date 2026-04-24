## Judge's Assessment

**Story**: CB-cline.1 — Cline canonical-history implementation plan
**Iteration**: 2 of 5 maximum
**Date**: 2026-04-23

---

### Summary

| Verdict | Count |
|---------|-------|
| APPROVED (must fix) | 2 |
| APPROVED (should fix) | 0 |
| REJECTED (over-engineering) | 1 |
| REJECTED (out of scope) | 2 |
| REJECTED (not valid) | 0 |
| DEFERRED (already tracked for iter 3) | 2 |

---

### Verified Validation Results

- **Starting commit:** `fcd05e76b` (cline repo, last commit before iter-2 fixes)
- **HEAD commit under judgment:** `d62419c6a` (cline repo)
- **Pre-existing failures (reviewer-reproduced):** none reported
- **HEAD results (reviewer):** 42 side / 1435 unit / 150 webview all passing; typecheck, protos, compile green
- **Regressions:** none
- **Regression gate:** clear

---

### Overall Verdict

**NEEDS REVISION**

Two approved-must-fix items: the M3 "idempotent-splice guard" is genuinely dead code and must be repaired or removed (C1), and bonsai tools remain unregistered in 11/12 production variants, violating spec §1 "System Guidance" for every production model except those routed to the generic fallback (H1). Everything else the reviewer raised is either test-coverage tech debt acceptable at this scope, an unrelated cosmetic nit, or already deferred. Iter 3 remains the planning lever for H3 gauge + M1-(iter1) guidance; adding C1 and H1 keeps iter 3 focused but feasible within the 5-iteration budget.

---

### Finding-by-Finding Evaluation

#### [C1] M3 idempotent-splice guard is UNREACHABLE (dead code)
- **Reviewer's Issue**: In `ContextBonsaiApplier.retrieve`, `findIndex` requires the message text to include the PRUNED marker, then the `alreadyRetrieved` check requires `!placeholderMsgText.includes(...)` — conditions are mutually exclusive, so `alreadyRetrieved` is always false. The partial-failure scenario the guard was supposed to handle (history already re-spliced but store not cleaned) would hit the `findIndex === -1` branch and return `anchor_unknown` instead of idempotent success.
- **Verdict**: APPROVED (must fix)
- **Verification**: Confirmed by reading `cline/src/core/task/ContextBonsaiApplier.ts:345-396`. Line 345-348 `findIndex(m => extractMessageText(m).includes("[PRUNED: ${anchorId} to ${rangeEndId}]"))` and line 368 `!placeholderMsgText.includes("[PRUNED: ${anchorId} to ${rangeEndId}]")` are logical negations of the same predicate applied to the same message. `alreadyRetrieved` is unreachable. The partial-failure scenario the comment claims to protect against (lines 356-362) falls through to `findIndex === -1` → `anchor_unknown` at 349-353. The dev report's iter-2 claim that M3 was fixed is therefore false — this regressed from "unfixed" to "fixed-looking-but-dead-code", which is worse than either endpoint alone.
- **Reasoning**: This is a correctness hole the spec cares about. The shared spec's §6 "Context Transform Requirement" states "retrieval removes the placeholder effect and restores the original visible range". An idempotent guard is defensive — but one that silently fails to trigger is a trap for future maintainers. Either make it work or remove the dead branch plus its comments.
- **Guidance for fix**: Pick one of two narrow options:
  1. **Remove the guard** (smallest): delete lines 356-396 and their comment block. Document in the retrieve doc-comment that partial-failure recovery is not in v1 scope.
  2. **Make it actually work**: when `findIndex === -1`, before returning `anchor_unknown`, scan the current history for the full archived sequence (first + last message text fingerprints from `record.anchor.textHint` / `record.rangeEnd.textHint`, or a substring match on the first archived message). If a match is found at index `i` and `history.slice(i, i + archivedMessages.length)` aligns with `record.archivedMessages` by role + text, treat as already-retrieved: clean the store entry, return success. Add a test in `ContextBonsaiApplier.test.ts` that simulates partial failure (archive pre-written with a record whose `archivedMessages` already appear in canonical history in place of the placeholder, call `retrieve(anchorId)`, assert success + store cleaned).
- **Recommendation**: Option 1 (remove) is strictly smaller and aligns with "minimal impact" per core principles. The partial-failure recovery path is not in the AC list for v1. If the dev prefers to keep the intent but not pay the test cost, option 1 is the right call. Either is acceptable; pick one and ensure no dead code remains.

#### [H1] Bonsai tools only in Generic variant; 11 other production variants omit them
- **Reviewer's Issue**: `CONTEXT_BONSAI_PRUNE` / `CONTEXT_BONSAI_RETRIEVE` are registered in `variants/generic/config.ts:77-78` only. `next-gen`, `native-next-gen`, `gpt-5`, `native-gpt-5`, `native-gpt-5-1`, `gemini-3`, `glm`, `hermes`, `xs`, `trinity`, `devstral` do not list them. `ClineToolSet.getEnabledTools` (line 87-106) iterates `variant.tools` as source of truth — the GENERIC fallback at `getToolByNameWithFallback` only helps when the variant listed the enum. Snapshot scan confirms: only 4 `openai_gpt_3-*.snap` files contain `context-bonsai`; 54+ other snapshots (including every production model) show zero matches.
- **Verdict**: APPROVED (must fix)
- **Verification**:
  - Variant listings confirmed by `grep -rn "CONTEXT_BONSAI" cline/src/core/prompts/system-prompt/variants/` → only generic hits.
  - Fallback semantics confirmed by reading `cline/src/core/prompts/system-prompt/registry/ClineToolSet.ts:87-106`. Line 89 `const requestedIds = variant.tools ? [...variant.tools] : []`. If the enum isn't in `variant.tools`, `getToolByNameWithFallback` is never called for it. The GENERIC fallback is per-tool-resolution, not per-variant inheritance.
  - Confirmed against Cline's own CLAUDE.md "Adding Tools to System Prompt" step 4: "Each model family has its own config … Add your tool's enum to the `.tools()` list".
  - Generic variant matcher (`variants/generic/config.ts:26-42`) explicitly excludes next-gen, GLM, Trinity, and compact local — so a user on Claude 4.5 / GPT-5 / Gemini 3 / GLM 4.6 / etc. never routes through the generic variant and therefore never sees the bonsai tool descriptions in their system prompt.
- **Reasoning**: Shared spec §1 "System Guidance" — "Each implementation MUST provide system-level guidance telling the model that `context-bonsai-prune` and `context-bonsai-retrieve` exist". The MUST is per-model, not per-agent. An implementation where only the openai_gpt_3 snapshot shows the tools is a spec violation for every non-legacy production target. Iter-1 judge's direction ("add to generic's `.tools()`") was too narrow — the iter-1 reviewer's C1 correctly identified tool-registration absence, and narrowing the fix to generic alone meant only the fallback codepath got coverage. This isn't a contradictory new direction; it's completing what iter 1 started.
- **Important context**: iter-1 judgment explicitly framed C1 as "add to generic's .tools() only". Dev complied exactly as instructed. The iter-1 judge's direction was incomplete — not an error the dev should have second-guessed. Iter 3 is the right place to fix this fully.
- **Guidance for fix**: Add `ClineDefaultTool.CONTEXT_BONSAI_PRUNE` and `ClineDefaultTool.CONTEXT_BONSAI_RETRIEVE` to the `.tools(...)` list of every production variant: `next-gen`, `native-next-gen`, `gpt-5`, `native-gpt-5`, `native-gpt-5-1`, `gemini-3`, `glm`, `hermes`, `xs`, `trinity`, `devstral`. No new tool-spec files are required — the existing `context-bonsai-prune.ts` / `context-bonsai-retrieve.ts` tool definitions already rely on GENERIC fallback (per CLAUDE.md step 2 "Fallback behavior"). Regenerate snapshots with `UPDATE_SNAPSHOTS=true npm run test:unit`. Verify by grepping the refreshed snapshots for `context-bonsai` and confirming all production variants show matches. This is purely additive and scope-bounded; estimated <20 lines of config changes plus snapshot regeneration.

#### [M1] `resetContextHistoryUpdates` has no unit test
- **Reviewer's Issue**: New `ContextManager.resetContextHistoryUpdates` API is called by prod code but not covered by a direct unit test. Two guarantees (map cleared + `context_history.json` rewritten to `[]`) not asserted.
- **Verdict**: REJECTED (out of scope for iter 3)
- **Verification**: Confirmed — `grep -rn "resetContextHistoryUpdates" cline/src/` shows prod callers in `ContextBonsaiApplier.ts` and a stub in the applier test; no direct ContextManager-level test.
- **Reasoning**: The function is 7 lines (set `new Map()`, `fs.writeFile` with `[]`, catch-and-log on error). The behavior is trivial and directly observable through the applier integration tests that exercise the prune path. Adding a dedicated unit test adds minimal signal per LoC. The reviewer's concern ("future change to … could silently invert behavior") is a general test-coverage argument, not a specific risk. Given iter 3's capacity is already spent on C1 + H1 + deferred H3 gauge + M1-(iter1) guidance, adding this test is not worth squeezing into iter 3. Acceptable tech debt.

#### [M2] Handler-level step-counter wiring untested
- **Reviewer's Issue**: No handler test verifies `getCurrentStep()` returns `apiRequestCount`. The applier test passes `() => 1`.
- **Verdict**: REJECTED (out of scope for iter 3)
- **Reasoning**: The wiring is a one-liner in each handler (`getCurrentStep: () => config.taskState.apiRequestCount`). Writing a handler test to verify a closure returns the right property is low-signal coverage. The end-to-end contract (same-step guard rejects retrieve after prune in the same turn) would be more valuable, but that crosses tool-execution seams and belongs to an e2e test — not iter 3 scope. Acceptable tech debt.

#### [M3] Checkpoint-restore gate untested
- **Reviewer's Issue**: Zero test coverage for the new H1 gate in `checkpoints/index.ts:245-271`.
- **Verdict**: REJECTED (out of scope for iter 3)
- **Verification**: Confirmed — `cline/src/integrations/checkpoints/__tests__/` contains only `factory.test.ts`, with no bonsai references.
- **Reasoning**: Gate is ~25 lines including the non-empty archive-store branch + the read-failure catch. Behavior is: read the store, count archives, emit error message if >0, log-and-continue on read failure. The read-failure branch is defensive — there's no clear trigger for it in real runs. Adding a test here is higher-cost than M1/M2 because it needs to mock both `readArchiveStore` and the `HostProvider.window.showMessage` surface. Given that the story AC explicitly says "avoid coupling bonsai v1 to checkpoint semantics unless needed", extensive coverage of the coupling we did add is inverted priorities. Acceptable tech debt. If iter 3 has budget after C1 + H1 + deferred work, a single happy-path "archives present → error" test would be cheap to add — but not required.

#### [M4] Same-step guard false-positive after task resume
- **Reviewer's Issue**: `taskState.apiRequestCount` initializes to 0 per Task instance (confirmed `TaskState.ts:67`). If an archive has `createdAtStep=5` in session A, resuming in session B and hitting request #5 will make `checkSameStepGuard` reject a legitimate retrieve.
- **Verdict**: REJECTED (over-engineering for current scope)
- **Verification**: Confirmed — `apiRequestCount = 0` in `TaskState.ts:67`, no persistence hook, no restore-time rehydration.
- **Reasoning**: This IS a real edge case. However:
  1. The same-step guard is a soft safety check; its purpose is to prevent a model from pruning-then-immediately-unpruning inside a single reasoning step. The failure mode on resume (a legitimate retrieve is rejected on exactly one matching request number) is recoverable by the model — it retries the retrieve on the next turn, and the counter has moved past `createdAtStep`.
  2. The spec §3 "Retrieve tool" says the same-step guard is a SHOULD, not a MUST.
  3. Persisting `apiRequestCount` across resume is a cross-cutting state change (affects focus chain, checkpoint naming, etc.) — not a narrow bonsai fix. Opening that can is out of scope for CB-cline.1.
  4. Alternative (use wall-clock timestamps) would change the guard semantics and need its own spec alignment.
- **Acceptable resolution**: Document this limitation in a comment near `createdAtStep: this.deps.getCurrentStep?.()` in `ContextBonsaiApplier.ts:256` — something like "// Resume caveat: apiRequestCount resets to 0 per Task instance, so an archive's createdAtStep may collide with a legit retrieve request number after resume. The guard is a SHOULD per shared spec §3; false positives are retryable." Not required for iter 3; flag for future enhancement.

#### [L1] Non-atomic `context_history.json` write
- **Reviewer's Issue**: `ContextManager.resetContextHistoryUpdates` uses direct `fs.writeFile` without tmp+rename, diverging from `writeArchiveStore` which uses the safer pattern.
- **Verdict**: REJECTED (not valid as a regression)
- **Verification**: Confirmed — `ContextManager.saveContextHistory` at line 158 uses the same direct-write pattern. The new reset method mirrors pre-existing house style.
- **Reasoning**: Matching the existing pattern for a file that's rewritten at many points in `ContextManager` is correct. Introducing tmp+rename here alone would be an unrelated refactor. If atomicity matters for `context_history.json`, it's a refactor for all of ContextManager's disk writes, not a bonsai story concern.

#### [L2] Unrelated cosmetic TS inference cleanup in H1 commit
- **Reviewer's Issue**: `saveCheckpoint(isAttemptCompletionMessage: boolean = false, …)` → `saveCheckpoint(isAttemptCompletionMessage = false, …)` in the H1 commit. Violates minimal-impact rule.
- **Verdict**: REJECTED (not worth reverting)
- **Verification**: Confirmed via `git show d62419c6a`.
- **Reasoning**: This is almost certainly a Biome autofix on save (`biome` prefers inferred types when a default is provided). The alternative — reverting the hunk — either requires disabling the linter for that line or reintroduces the lint warning. The change is semantically identical, touches one line in a function the commit is not otherwise modifying, and is the kind of cosmetic noise that saving any TS file in this repo would produce. Not worth the cleanup cost. Noted for calibration; don't act on it.

---

### Previously-Deferred Items (carry forward, still valid)

These were deferred from iter 1; iter 3 still needs to land them:

- **H3 (gauge)**: in-band gauge injection on 5-turn cadence with 4 severity bands. Spec §7 MUST. Still unaddressed at HEAD.
- **M1-(iter1) (system prompt guidance)**: internal system-prompt path inserting the bonsai guidance block. Spec §1 MUST. Still unaddressed at HEAD.

Iter 3 scope proposal: C1 (dead-code fix) + H1 (variant tool registration) + H3 gauge + M1 guidance. C1 is small (remove or repair ~30 lines). H1 is mechanical (~20 lines + snapshot regen). H3 and M1 are the substantive work for iter 3. This fits within a single iteration with care.

---

### Loop/Conflict Detection

**Previous Iterations**: 1
**Recurring Issues**:
- C1 (dead-code guard) is a NEW finding from iter 2's reviewer. The iter-1 dev report claimed "M3 fixed" — the claim is false. Not a loop; a missed regression that the iter-2 reviewer correctly surfaced.
- H1 (variant registration) IS related to iter-1's C1 (tool registration). The iter-1 judge narrowed the fix to generic-only; iter-2 reviewer correctly expanded scope. This is an incomplete-iter-1-direction pattern, not a contradictory-feedback loop. Iter-1's judgment was materially under-scoped on this item.

**Conflicts Detected**: Minor tension between iter-1 judge's "generic only" framing and iter-2 reviewer's "all production variants" framing. Resolution: iter-2 reviewer is correct per spec §1 and per `cline/CLAUDE.md` tool-registration guidance. Iter-1 framing was too narrow; iter 3 completes it. No loop.

**Assessment**: Making progress. Two iter-1 items (H3, M1) remain deferred; iter 2 added one new must-fix (C1 dead-code) and surfaced one spec gap (H1 variants). Iter 3 has a concrete, bounded scope.

---

### Recommendations

**Iteration 3 must-fix bundle (ordered by risk-reduction per LoC):**

1. **C1** — remove the unreachable idempotent-splice guard (lines 356-396 of `ContextBonsaiApplier.ts`) OR repair it to do textual sequence detection. Prefer removal unless there's a concrete test case demonstrating the partial-failure recovery path working.
2. **H1** — add `CONTEXT_BONSAI_PRUNE` + `CONTEXT_BONSAI_RETRIEVE` to `.tools(...)` in all 11 missing production variants. Regenerate snapshots. Verify via grep that every production snapshot contains both tool names.
3. **H3 (deferred from iter 1)** — implement in-band gauge injection. Spec §7 MUST. This is the last iteration before iter 4/5 where further slip risks running out of budget.
4. **M1-(iter1) (deferred from iter 1)** — inject bonsai guidance through the internal system-prompt path. Spec §1 MUST.

**Rejected (do NOT address):** M1-(iter2), M2, M3, M4, L1, L2 from this iteration's report.

**If iter-3 scope proves too heavy**, priority ordering to cut from is: H3 and M1-(iter1) can slip to iter 4 if absolutely necessary, but C1 and H1 must land in iter 3 — they are correctness holes caught mid-sequence.

---

### Complexity Guard Notes

Items rejected specifically to prevent over-engineering or scope creep:

- **M1 / M2 / M3 (test-coverage adds)**: Each adds modest signal per LoC. The functions covered are either trivial (resetContextHistoryUpdates, handler closures) or defensive (checkpoint-gate read-failure branch). Iter 3's budget is better spent on the two correctness items (C1, H1) and the two deferred spec MUSTs (H3 gauge, M1 guidance). If iter 4/5 have slack, these are reasonable add-ons.
- **M4 (apiRequestCount resume persistence)**: The fix requires cross-cutting state persistence (affects focus chain, checkpoint naming). Out of scope for a bonsai-only story. The same-step guard is a SHOULD per spec §3; a false positive is model-recoverable. A one-line comment flagging the caveat is sufficient, and even that is optional.
- **L1 (tmp+rename for context_history.json)**: Touching one fs.writeFile call in a file where four other calls use the same direct-write pattern would be an inconsistent refactor. If atomicity matters here, it's its own story.
- **L2 (revert Biome autofix)**: One-line cosmetic change that Biome applies on save across this repo. Reverting requires either disabling the linter for the line or reintroducing the lint. Not worth it.
