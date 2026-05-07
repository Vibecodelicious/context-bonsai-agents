## Judge's Assessment

**Story**: P.3 — Pi context-bonsai retrieve tool
**Iteration**: 1 of 5 maximum
**Date**: 2026-05-06

---

### Summary

| Verdict | Count |
|---------|-------|
| APPROVED (must fix) | 0 |
| APPROVED (should fix) | 0 |
| REJECTED (over-engineering) | 0 |
| REJECTED (out of scope) | 0 |
| REJECTED (not valid / minor accuracy) | 2 |

### Verified Validation Results

- **Starting commit:** `cddd3155` (P.2 close)
- **Iter-1 HEAD:** `f5c4f3a6` on `feat/context-bonsai-port`
- **Pre-existing failures (reviewer-reproduced):** none
- **HEAD results:** 48/48 unit pass (6 files); 8/8 integration pass (6 files); `npm run check` clean
- **Regressions:** none
- **Regression gate:** clear

Independently re-run by the judge:
- `packages/context-bonsai` vitest → 48/48 pass across `archive-store` (5), `context-transform` (6), `prompt` (3), `prune-pattern` (12), `prune-validation` (14), `retrieve` (8).
- `packages/coding-agent/test/suite/context-bonsai/` vitest → 8/8 pass across `01-scaffold` (1), `02-prune` (2), `02b-prune-with-compaction` (1), `02c-prune-secret-oracle` (1), `03-retrieve` (2), `03b-same-turn-prune-retrieve` (1).

---

### Overall Verdict

**APPROVED AS-IS**

All Story P.3 acceptance criteria are met by `f5c4f3a6`. The reviewer's two LOW findings are accepted as accurate observations but rejected as not warranting another revision cycle: L1 is an informational-only count accuracy issue with a trivial future fix, and L2 is defensive coding that matches the established style in `prune.ts`. Pi's intentional omission of the same-step retrieve guard is per-spec (Pi spec lines 27, 77, 127; cross-agent spec §3 line 144 uses SHOULD), with tombstone-wins hydration providing the equivalent audit-clean behavior — verified by `03b-same-turn-prune-retrieve.test.ts` and the unit test at `retrieve.test.ts:187`.

Story P.3 closes. Orchestrator should pin the parent submodule at pi @ `f5c4f3a6` and proceed to Story P.4 (context gauge).

---

### Finding-by-Finding Evaluation

#### [L1] `messageCount` may overstate when non-message entries lie between anchor and rangeEnd
- **Reviewer's Issue**: `retrieve.ts:88-101` derives `messageCount` from `ctx.sessionManager.getBranch()` index distance. Because `getBranch()` returns the heterogeneous `SessionEntry[]` (which can include `CompactionEntry`, `BranchSummaryEntry`, `CustomEntry`, `LabelEntry`), index distance overstates the true message count when any non-message entry sits between anchor and rangeEnd. The user-visible success string includes this `N`, so the count can be inflated. Reviewer notes the prune side already filters via `filterMessageEntries` from `prune-pattern.ts`.
- **Verdict**: REJECTED (informational accuracy only; not blocking)
- **Reasoning**: Verified the issue exists in the code:
  - `pi/packages/coding-agent/src/core/session-manager.ts:138-147` defines `SessionEntry` as a union spanning eight entry types, only one of which is `SessionMessageEntry`.
  - `pi/packages/context-bonsai/src/retrieve.ts:90-91` uses `branch.findIndex(...)` directly against this heterogeneous list, then computes `hi - lo + 1` as `messageCount`.
  - `pi/packages/context-bonsai/src/prune-pattern.ts:261-263` already exports `filterMessageEntries` and is already used by `prune.ts:220` for exactly this kind of message-only computation.
  - The OpenCode reference (`/home/basil/projects/opencode_context_bonsai_plugin/src/retrieve.ts:46-55`) operates on `messages` (a homogeneous list), so its count is naturally accurate; Pi's port loses that property by reading `getBranch()` directly.
  - Tests pass because the unit test scenarios place no non-message entries between anchor/rangeEnd, and in the integration test the prune's `context-bonsai:archive` custom entry is appended *after* both range boundaries (not between them).
  
  Why rejected for this iteration:
  1. The acceptance criterion specifies the success-string template `Restored N messages from range <anchor> to <rangeEnd>. Original content is now visible.` — the format is met. AC does not specify that `N` be exact when the branch contains non-message entries.
  2. The output is informational. The load-bearing behaviors (tombstone written, in-memory store cleared, transcript restored on next turn) are unaffected.
  3. The complexity-guard framework in `REVIEW_JUDGE_SUBAGENTS.md` directs the judge to document minor accuracy issues and approve as-is when core functionality is met. This is a textbook example.
  4. The fix is a one-line change (replace `branch.findIndex(...)` with `filterMessageEntries(branch).findIndex(...)`) that can be picked up opportunistically in P.5 (the e2e test fix-loop story) if real-world transcripts ever surface this. No need to spin another P.3 iteration.
- **Documented for future**: If P.5 surfaces an inflated count in any e2e transcript, fix in `retrieve.ts:88-101` by importing `filterMessageEntries` from `./prune-pattern.js` and calling it on `branch` before index lookup. Mirror the prune pattern at `prune.ts:220`.

#### [L2] Defensive `typeof anchorId !== "string"` check is unreachable
- **Reviewer's Issue**: `retrieve.ts:71-73` guards against a non-string `anchor_id`, but TypeBox `Type.String()` already rejects non-string upstream. The dead branch is acceptable defensive coding but creates an undocumented asymmetry vs. other validators.
- **Verdict**: REJECTED (matches established defensive style; not a real defect)
- **Reasoning**: Verified the guard is unreachable for inputs that pass schema validation. However:
  1. The same defensive pattern is already established in `prune.ts:205-207` (`if (typeof fromPattern !== "string" || typeof toPattern !== "string")`) — so removing it from retrieve would create inconsistency, not fix one.
  2. Defensive narrowing also tightens the TypeScript type to `string` for the body of the function, which is structural rather than purely defensive.
  3. The empty-string check on the same line *is* reachable (TypeBox `Type.String()` does not reject empty strings) and is the substantive part of the guard.
  4. "Asymmetry not documented" is a documentation preference, not a code defect. Project standards (`pi/CLAUDE.md`, `pi/packages/context-bonsai/STANDARDS.md`) do not require inline justification for defensive narrowing.
  
  No fix needed.

---

### Spec Conformance Spot-Checks

The judge independently verified the following acceptance criteria against `f5c4f3a6`:

- **`executionMode: "sequential"`** — `retrieve.ts:59`. Asserted by unit test at `retrieve.test.ts:82-88`. ✔
- **Fail-closed on missing `pi.appendEntry`** — `retrieve.ts:64-68`. Asserted by `retrieve.test.ts:141-154`. ✔
- **Empty-string anchor_id rejected** — `retrieve.ts:71-73`. Asserted by `retrieve.test.ts:175-185`. ✔
- **Archive lookup deterministic error** — `retrieve.ts:75-78` returns exactly `Error: No archive found for message ${anchorId}`. Asserted at `retrieve.test.ts:90-101` (unit) and `03-retrieve.test.ts:157-198` (integration). ✔
- **Tombstone via `pi.appendEntry("context-bonsai:archive-clear", { anchorEntryId })`** — `retrieve.ts:103-110`. Constants from `schema.ts`. Asserted at `retrieve.test.ts:103-126` and integration `03-retrieve.test.ts:121-128`. ✔
- **In-memory `ArchiveStore.clear()` AFTER successful append** — `retrieve.ts:111`, executed only after the try/catch around `appendEntry` succeeds. The "exception leaves store intact" path is asserted at `retrieve.test.ts:156-173`. ✔
- **OpenCode-shaped success string** — `retrieve.ts:113-115` produces `Restored ${messageCount} messages from range ${archive.anchorEntryId} to ${archive.rangeEndEntryId}. Original content is now visible.` ✔
- **Same-turn prune+retrieve no-op via tombstone-wins hydration** — Pi spec lines 27, 77, 127 explicitly authorize this. Cross-agent spec §3 line 144 uses SHOULD. The unit test `retrieve.test.ts:187-244` replays captured custom entries through `ArchiveStore.hydrateFromEntries` and asserts the final store is empty. The integration test `03b-same-turn-prune-retrieve.test.ts` exercises one assistant message emitting both tools and asserts both succeed, both custom entries land in append order, and the next `"context"` event is un-elided. ✔
- **Reload persistence of tombstone** — `03-retrieve.test.ts:140-154` reloads the session and asserts the post-reload transcript is still un-elided. ✔
- **Tool registered in factory** — `index.ts:36` calls `pi.registerTool(createRetrieveTool(pi, store))`. Wiring assertion updated at `prompt.test.ts`. ✔
- **`npm run check` clean** — verified by reviewer; no regressions reported.

---

### Loop/Conflict Detection

**Previous Iterations**: 0 (this is iteration 1).
**Recurring Issues**: n/a.
**Conflicts Detected**: none.
**Assessment**: First-pass clean approval. P.3 is a smaller story than P.2 (no validation matrix, no transform side, no archive store changes — just one new tool factory + tests + one-line registration), and the developer hit it cleanly on the first try. No risk of cycling.

---

### Recommendations

**APPROVED AS-IS.** No revisions required.

Orchestrator next steps:
1. Pin parent submodule `pi/` at `f5c4f3a6` (this judgment commit advances the gitlink).
2. Proceed to Story P.4 (context gauge) per `epic-port-context-bonsai.md`.
3. Carry the L1 documentation note into P.5 (`story-port-context-bonsai.5-e2e-test-fix-loop.md`) for opportunistic pickup if any e2e transcript surfaces an inflated `Restored N messages` count.

---

### Complexity Guard Notes

- **Rejected L1 fix as a P.3 revision** — the count is informational only, the format-specified part of the success string (which `N` template-formats into) is met, and the fix is a 1-line opportunistic improvement that belongs in P.5's e2e fix-loop scope rather than another P.3 cycle. Approving-as-is preserves orchestration velocity without sacrificing correctness.
- **Rejected L2 documentation request** — defensive narrowing matches Pi's established style; demanding inline justification for every dead-but-defensive branch would inflate the codebase without protecting any real invariant. The reviewer's own framing ("acceptable") supports rejection.
