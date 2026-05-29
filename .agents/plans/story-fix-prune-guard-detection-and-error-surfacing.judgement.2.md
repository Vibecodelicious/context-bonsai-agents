## Judge's Assessment

**Story**: fix-prune-guard-detection-and-error-surfacing — Make Prune Success Trustworthy (Defect A: launch-shape-independent patch detection; Defect B: deterministic failures via MCP `isError`)
**Iteration**: 2 of 5 maximum
**Date**: 2026-05-29

---

### Summary

| Verdict | Count |
|---------|-------|
| APPROVED (must fix) | 0 |
| APPROVED (should fix) | 0 |
| REJECTED (over-engineering) | 0 |
| REJECTED (out of scope) | 0 |
| REJECTED (not valid) | 0 |

(Iteration 1's single must-fix M1 and folded should-fix M2 are both resolved by commit `95c2422`; the reviewer raised 0/0/0/0 new findings.)

### Verified Validation Results

- **Starting commit:** `7035701` (the frozen iteration-1 HEAD). Side HEAD advanced `7035701` → `95c2422`.
- **Pre-existing failures (reviewer-reproduced):** `bun run typecheck`: `mcp-server/index.test.ts(173,35)` TS2769 (Buffer overload on the base64 metadata test). Independently reproduced at HEAD `95c2422`; it is the same baseline failure carried as an approved exception since iteration 1, unrelated to this story.
- **HEAD results:** `bun test` 159 pass / 0 fail (independently rerun). `bun run typecheck` exits 2 with only the single baseline TS2769 — no new type errors from the widened/changed e2e signatures.
- **Regressions:** none.
- **Regression gate:** clear.

---

### Overall Verdict

**APPROVED AS-IS**

Iteration 2 resolves the one approved must-fix (M1) and the folded should-fix (M2) with a tightly-scoped change to the e2e harness, its test, and the evidence doc — and nothing else. Every load-bearing claim was independently verified:

- **The oracle is now bound to the real removal mechanism (M1 resolved; the false-PASS question is SOUND, not a gap).** The archived-filter patch (`patches/archived-filter.patch.ts:34`) computes the model-visible message array by reading exactly `~/.claude/archived-<sessionId>.json` into a UUID set and filtering `messagesVar = messagesVar.filter(m => !(m.uuid && archivedIds.has(m.uuid)))`. Model-visible removal is therefore driven **solely** by marker-UUID membership. The corrected oracle's `isArchivedRow` (`e2e/native-e2e.ts:276-280`) returns `row.archived === true` OR marker-set membership, reading that **same** marker file via `loadMarkerUuids`/`resolveMarkerSet` (`:286-321`). So "in the marker set" == "absent from the model-visible payload" *by construction* — the oracle reads the authoritative hide-list itself, not a proxy. This is the opposite of a false-PASS: it cannot report removal that the patch did not actually perform, because it consults the very list the patch consults. The never-written `context_bonsai_v2.archived` per-row read (the iteration-1 defect) is deleted.
- **Runtime signals match.** `src/lib/compact.ts:278-280,307-309` stamp top-level `message.archived`/`archivedAt`/`archivedBy`; `:326` calls `addArchivedMarkerEntries`, which writes the marker file (`:86-113`). The oracle reads exactly these two signals (top-level flag + marker), nothing the product never writes.
- **The token-footprint drop remains the load-bearing transform-EFFECT signal** (≈9018 tokens; model-visible prefix 26704 → 17686), now corroborated by the oracle agreeing through its own written rule (`rangeVisibleCharsPre 266 → Post 0`). The footprint metric is scoped to the from..to range UUIDs (`rangeVisibleChars`), closing the whole-transcript-inflation vector where the drive turn's appended verbatim tool_result echo could mask a non-drop. This satisfies the e2e-spec discipline "verify transform EFFECT, not flag/intent."
- **Independently reproduced offline (no live `claude -p`)** on the retained `/tmp/cc-bonsai-e2e/20260529T173104Z-clean` and `…173443Z-oracle` snapshots through the committed `95c2422` harness: `prune-effect` → `verdict PASS`, exit 0, `rangeVisibleCharsPre 266 → Post 0`, `footprintDropped true`, `placeholderPresentPost true`. **Discrimination confirmed:** feeding the pre snapshot as "post" (empty marker, no top-level flag, no placeholder) → `verdict FAIL`, exit 1. The protocol-a corrected result records `valid: true` with the single secret-bearing occurrence detected `archived: true`; I confirmed the underlying row (`2e0b5975…`, post.jsonl line 15) carries top-level `archived: true`, so the oracle resolves it through the top-level flag (the marker was cleared by the later retrieve in that snapshot — the flag is load-bearing there, as the reviewer noted). I did not re-drive the protocol-a oracle with the secret literal to avoid any leak risk; verifying the row's top-level flag and the oracle's read path is sufficient and equivalent.
- **Fixtures rewritten to the real shape.** `e2e/native-e2e.test.ts` now uses top-level `archived` + anchor `context_bonsai_v2` + a marker set, and adds a marker-only PASS case (rows lack the top-level flag, marker carries the range). The suite still discriminates: top-level-flag PASS, marker-only PASS, bug-shape FAIL, archived-but-no-placeholder FAIL, range-absent BLOCKED. The hollow `context_bonsai_v2: { archived: true }` fixture shape is gone.
- **No frozen/approved code changed.** `git diff 7035701 95c2422 -- mcp-server/ src/ patches/ apply/` is empty; `95c2422` touches only `e2e/native-e2e.ts`, `e2e/native-e2e.test.ts`, and `docs/e2e-results-2026-05-29-prune-guard-detection.md`. The Defect A commit (`36010a7`), Defect B commit (`4dd6eb7`), harness commit (`4c7626c`), live-evidence commit (`7035701`), and the parent spec commit (`55862d1`) are all intact ancestors of HEAD — none rewritten.
- **M2 resolved.** The evidence doc now states archival is recorded as the top-level `message.archived` flag plus the marker file (not `context_bonsai_v2.archived`), citing `src/lib/compact.ts:278-280,307-309` (flag) and `:86-113` (marker), and documents the oracle correction for both `prune-effect` and `protocol-a-oracle`.
- **Hygiene.** `bun test` 159 pass / 0 fail; `bun run typecheck` only the baseline TS2769; the committed parent pin is still `bfb12e3` (the orchestrator advances it on this APPROVED verdict); nothing pushed (side repo is ahead 7 of origin, all local); no secrets, credentials, or transcripts in the evidence doc (scanned).

This is a trustworthy automated gate: the oracle now reaches PASS through its own rule, agrees with the iteration-1 host-state evidence, and discriminates the bug shape (FAIL exit 1). The story's deliverable — a working hard automated gate that does not false-PASS or false-FAIL — is met.

---

### Finding-by-Finding Evaluation

#### [M1 — iteration 1] Oracle read a field the product never writes (false-FAIL on correct prune)
- **Status carried from iteration 1**: APPROVED (must fix).
- **Resolution verdict**: RESOLVED.
- **Reasoning**: The corrected `isArchivedRow` (`e2e/native-e2e.ts:276-280`) reads top-level `row.archived === true` OR marker-UUID membership; the `context_bonsai_v2.archived` read is deleted. Because the archived-filter patch (`patches/archived-filter.patch.ts:34`) hides rows by exactly that same marker-UUID set, the oracle is bound to the authoritative removal mechanism — it cannot false-PASS (report removal that did not happen) and no longer false-FAILs on correct behavior. `analyzePruneEffect` (`:422-436` `rangeVisibleChars`, `:489+`) and `protocol-a-oracle` (`:237`) both use the marker-aware detection. Independently reproduced PASS exit 0 on the retained snapshots and FAIL exit 1 on the bug shape. The footprint metric is scoped to the range UUIDs, closing the inflation vector. Fixtures rewritten to the real product shape; the unit PASS is no longer hollow.

#### [M2 — iteration 1] Evidence doc omitted the top-level `archived` stamping
- **Status carried from iteration 1**: APPROVED (should fix, folded into M1).
- **Resolution verdict**: RESOLVED.
- **Reasoning**: The evidence doc now precisely states an archived row is recorded as top-level `message.archived` (plus the marker file), not `context_bonsai_v2.archived`, citing `src/lib/compact.ts:278-280,307-309` and `:86-113`.

#### [L1 — iteration 1] `native-e2e.test.ts` not enumerated in Worktree Artifact Check
- **Status carried from iteration 1**: REJECTED (not valid). No action required and none taken. Unchanged.

#### Iteration-2 reviewer findings
- The reviewer reported 0 CRITICAL / 0 HIGH / 0 MEDIUM / 0 LOW. Independently confirmed: no new defects exist in the iteration-2 change. Nothing to evaluate.

---

### Loop/Conflict Detection

**Previous Iterations**: 1.
**Recurring Issues**: none. M1 appeared once (iteration 1) and is resolved in iteration 2; it does not recur.
**Conflicts Detected**: none. Iteration 2 did not reverse any iteration-1 guidance; it implemented exactly the iteration-1 "If Approved" instruction (point detection at the marker file and/or top-level flag; fix fixtures; re-run so E2E-08 passes through its own rule; scope to the harness + test + evidence doc; do not touch source).
**Assessment**: Converging cleanly. The single must-fix was resolved with a scoped, source-free change that introduced no new issues and left all frozen/approved work intact. No thrashing.

---

### Recommendations

**APPROVED AS-IS.** The implementation meets the acceptance criteria. The source fixes (Defect A `36010a7`, Defect B `4dd6eb7`), the spec clause (parent `55862d1`), the harness (`4c7626c`), the live evidence (`7035701`), and now the corrected automated oracle (`95c2422`) together deliver a trustworthy prune with a hard automated gate that passes through its own rule and discriminates the bug shape.

The orchestrator may now advance the parent `tweakcc_context_bonsai` submodule pin from `bfb12e3` to `95c2422` in this judgment turn, per the per-story pin discipline. (The judge does not advance the pin or push.)

---

### Complexity Guard Notes

- The iteration-2 change adds only the minimal helpers needed to read the product's real archival signals (`loadMarkerUuids`, `markerPathForSession`, `resolveMarkerSet`) plus a `--marker` flag. No new abstraction, configuration, or generalization beyond reading the file/field the product already writes. This is strictly less coupling than the prior wrong-field read.
- Did not require or request re-running the live model-driven e2e; the iteration-1 behavioral host-state evidence is authoritative and unchanged, and the corrected oracle was validated offline against the retained snapshots, exactly as the iteration-1 guidance permitted.
