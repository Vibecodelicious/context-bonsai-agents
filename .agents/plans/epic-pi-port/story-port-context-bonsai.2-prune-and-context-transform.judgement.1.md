## Judge's Assessment

**Story**: P.2 — Pi context-bonsai prune tool + archive store + context transform
**Iteration**: 1 of 5 maximum
**Date**: 2026-04-29

---

### Summary

| Verdict | Count |
|---------|-------|
| APPROVED (must fix) | 2 |
| APPROVED (should fix) | 0 |
| REJECTED (over-engineering) | 0 |
| REJECTED (out of scope) | 1 |
| REJECTED (not valid) | 0 |
| Deferred to follow-up | 1 |

### Verified Validation Results

- **Starting commit:** `69dbdeb4` (HEAD of `feat/context-bonsai-port`)
- **Pre-existing failures (reviewer-reproduced):** none
- **HEAD results:** 39 unit (5 files) + 5 integration (4 files) all pass; `npm run check` clean
- **Regressions:** none
- **Regression gate:** clear

I re-ran validation independently:
- `npm run check` → biome + tsgo + browser-smoke + web-ui → clean.
- `packages/context-bonsai` vitest → 39/39 pass across `archive-store`, `context-transform`, `prune-pattern`, `prompt`, `prune-validation`.
- `packages/coding-agent/test/suite/context-bonsai/` vitest → 5/5 pass across `01-scaffold`, `02-prune` (2), `02b-prune-with-compaction`, `02c-prune-secret-oracle`.

---

### Overall Verdict

**NEEDS REVISION**

Two findings (H1, H2) are clear spec / AC violations and must be fixed before approval. M1 is a plausible reading of the spec but reaches beyond what the cross-agent spec and the pi plan AC strictly mandate; rejected to prevent scope creep. L1 is a cosmetic note that folds into the H2 fix.

The iteration is otherwise high quality: scope-disciplined, no out-of-scope edits, fail-closed deterministic errors, defensive overlap-drop in context-transform, and 39/5 green tests. The fixes for H1 and H2 are both small and proportionate.

---

### Finding-by-Finding Evaluation

#### [H1] tool-call completeness validator one-directional
- **Reviewer's Issue**: `validateRange` (`packages/context-bonsai/src/prune.ts:131-155`) only checks `callIdsInRange ⊆ resultsInRange`. A `toolResult` inside the range whose matching `toolCall` is in an assistant entry **before** the range will pass validation, leaving an orphan toolCall visible to the model with its toolResult hidden inside the placeholder.
- **Verdict**: APPROVED (must fix)
- **Reasoning**:
  - Cross-agent spec §"Execution rules" line 121 (verified): *"The selected range MUST NOT cut through incomplete or malformed tool-call history."* This MUST is directional-agnostic — a toolResult inside the range whose toolCall is outside is exactly such a cut.
  - AC #6 in the story plan: *"no incomplete tool calls in range."* Both directions of cut violate this.
  - Verified via Read of `prune.ts`: lines 132-150 build `callIdsInRange` (assistant toolCalls inside) and `resultsInRange` (toolResult.toolCallId inside), then loop only `for (const callId of callIdsInRange)`. The reverse direction is absent.
  - Real-world impact: orphan toolCalls in the model-visible transcript with no matching result are a known driver of hallucinated tool replays and confused state inference. This is exactly the failure the MUST is written to prevent.
  - Fix is small, proportionate, and matches the existing structure.
- **Fix Guidance**:
  - After the existing forward check, add a symmetric loop: `for (const resultCallId of resultsInRange) { if (!callIdsInRange.has(resultCallId)) return "range cuts through an incomplete tool call (toolResult callId=" + resultCallId + " has no matching toolCall in range)"; }`.
  - Add a unit test in `packages/context-bonsai/test/prune-validation.test.ts` covering the orphan-toolResult case (toolCall before range, toolResult inside range).

#### [H2] 02b regression-guard test omits required `BranchSummaryEntry` coverage
- **Reviewer's Issue**: AC #11 explicitly requires the regression-guard to seed BOTH a `CompactionEntry` AND a `BranchSummaryEntry`. The committed `02b-prune-with-compaction.test.ts` only seeds a `CompactionEntry`. The dev's deviation note (no public API to append a branch_summary) is incorrect; `SessionManager.branchWithSummary()` is public.
- **Verdict**: APPROVED (must fix)
- **Reasoning**:
  - Verified via `grep -n "branchWithSummary\|BranchSummaryEntry"` against `pi/packages/coding-agent/src/core/session-manager.ts`:
    - `BranchSummaryEntry` interface declared at line 78
    - `branchWithSummary(branchFromId, summary, details?, fromHook?)` declared **public** at line 1146 (no `private`/`protected` qualifier; on the `SessionManager` class)
    - Synthetic injection for `branch_summary` lives at line 385 — a distinct code path from compaction synthetic injection
  - Verified via Read of `02b-prune-with-compaction.test.ts`: only `appendCompaction(...)` is called (line 69); no branch-summary seed; assertions only cover compaction-summary text.
  - The AC explicitly calls this out (`packages/coding-agent/test/suite/context-bonsai/02b-prune-with-compaction.test.ts`: *"Seed a session that contains a `CompactionEntry` on the branch plus a `BranchSummaryEntry` (use `SessionManager` APIs directly in the test setup)."*).
  - The two synthetic-injection paths are independent. A regression on branch_summary correlation alone (e.g., role/timestamp lookup mishandling the synthetic injected by `buildSessionContext`) would slip past the current test. That is exactly what this regression-guard test exists to prevent.
  - Skipping a named, AC-mandated assertion fails AC #11 directly.
- **Fix Guidance**:
  - In the test setup, after seeding the compaction, also call `harness.sessionManager.branchWithSummary(branchFromId, "abandoned-path-summary")` to seed a branch_summary entry on the branch (or interleave it before the compaction — pick whichever exercises the synthetic path more cleanly).
  - Add an assertion that `"abandoned-path-summary"` survives the prune transform untouched in the post-transform transcript (analogous to the existing `compaction-summary-text` assertion at line 129).
  - Update the deviation log / commit-message claim that "SessionManager exposes no public method to append one" — folds in L1.

#### [M1] single-match resolution doesn't exclude prior prune-wrappers
- **Reviewer's Issue**: `resolvePatternBoundary` (`packages/context-bonsai/src/prune-pattern.ts:245-257`) only invokes the wrapper-filter when `matchingEntries.length > 1`. If a pattern uniquely matches a prior `context-bonsai-prune` wrapper (e.g., the model echoes unusual wording from a failed prune's `summary`), resolver returns the wrapper id, anchoring a prune ON a prior prune wrapper.
- **Verdict**: REJECTED (out of scope vs. spec/AC text)
- **Reasoning**:
  - Cross-agent spec §"Pattern Matching Contract" line 245 (verified verbatim): *"**On ambiguous pattern matches**, before returning the deterministic failure, the implementation MUST exclude from the candidate set any message whose canonical content is a prior `context-bonsai-prune` tool-use wrapper. If exactly one non-wrapper candidate remains, that is the resolved boundary; otherwise the failure is returned."*
  - The spec's MUST is **explicitly scoped to ambiguous pattern matches**, not to all matches. The reviewer's broader interpretation ("wrappers should be excluded from candidates, not just used as ambiguity tiebreak") reaches beyond the spec's literal text.
  - Story plan AC #3 mirrors the spec exactly: *"before returning ambiguity, exclude prior `context-bonsai-prune` tool-use wrapper candidates; if exactly one non-wrapper candidate remains, resolve to it."* The committed implementation matches this AC.
  - Spec line 243 (*"Synthetic transform-added content that exists only to support rendering SHOULD generally be excluded from matching."*) covers transform-injected synthetics, not persisted wrapper tool-call entries that are real session history. SHOULD-not-MUST and not on point.
  - The single-wrapper-match scenario the reviewer describes is plausible but narrow: it requires the model to author a pattern that uniquely matches wrapper-internal text and matches no real entry. Given that real targets typically share index_terms / summary text with the wrapper itself, real ambiguity (the path the spec MUST covers) is much more likely than this clean single-wrapper case.
  - Approving this would expand the implementation past both the cross-agent spec's MUST scope and the story plan's AC. That is exactly the kind of "stricter than spec" creep the judge is here to filter. If this becomes a real problem in the e2e suite (Story P.5) or another agent's port, it can be raised as a spec amendment then.
- **Why not approve as a "should fix"**: Iteration 1 already met the explicit AC. Approving an extra stricter-than-spec change adds re-review cost and potential regression risk against the (already passing) ambiguity tests for no AC-bound benefit.

#### [L1] commit message misstates SessionManager API surface
- **Reviewer's Issue**: Dev's deviation log claims `SessionManager` has no public method to append a branch_summary, which is incorrect.
- **Verdict**: APPROVED (folds into H2)
- **Reasoning**: The deviation log will be naturally corrected when H2 is fixed (the test seeds a branch_summary via the public method, so the deviation no longer exists). No separate fix needed; just ensure the iter-2 commit message and any remaining deviation note in the developer log accurately describe the API.

---

### Loop/Conflict Detection

**Previous Iterations**: 0 (this is iter 1)
**Recurring Issues**: n/a
**Conflicts Detected**: none
**Assessment**: First pass — clean port with two clear AC gaps. No loop concern.

---

### Recommendations

**NEEDS REVISION** — the developer should address these approved items only:

1. **H1**: Add reverse-direction check in `validateRange` (`packages/context-bonsai/src/prune.ts`): walk `resultsInRange` and verify each `toolCallId` is in `callIdsInRange`; if not, return an orphan-toolResult deterministic error (same plain-text style as the existing forward error). Add a unit test in `packages/context-bonsai/test/prune-validation.test.ts` for the orphan-toolResult case.

2. **H2**: Update `packages/coding-agent/test/suite/context-bonsai/02b-prune-with-compaction.test.ts` to also seed a `BranchSummaryEntry` via `harness.sessionManager.branchWithSummary(...)`. Add an assertion that the branch-summary text survives the prune transform undisturbed (analogous to the existing compaction-summary-text assertion). Correct the deviation note (folds in L1).

Do NOT touch the wrapper-filter / `resolvePatternBoundary` logic. M1 is rejected as out of scope; the implementation already matches AC #3 and the cross-agent spec MUST.

---

### Complexity Guard Notes

- **Rejected M1 (single-match wrapper exclusion)**: Reviewer's interpretation expands the spec's ambiguity-scoped MUST into an unconditional candidate-filter. Cross-agent spec line 245 reads *"On ambiguous pattern matches, ... MUST exclude..."* — the MUST is gated on ambiguity. The story plan AC mirrors that exact scoping. Expanding the filter to all matches is a stricter-than-spec change with marginal benefit (narrow edge case) and would invite re-litigation across the other agent ports if it landed in pi alone. Keeping the filter ambiguity-scoped per spec.
- **L1 follow-up note**: Treated as folded into H2 rather than a separate iter scope item. Avoids fragmenting the dev's iter-2 work.
