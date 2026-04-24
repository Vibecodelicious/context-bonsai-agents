## Judge's Assessment

**Story**: CB-codex.1 — Codex replacement-history implementation plan
**Iteration**: 3 of 5 maximum
**Date**: 2026-04-24

---

### Summary

| Verdict | Count |
|---------|-------|
| APPROVED (must fix) | 0 |
| APPROVED (should fix) | 0 |
| REJECTED (over-engineering) | 0 |
| REJECTED (out of scope) | 0 |
| REJECTED (not valid) | 0 |

All six iteration-3 approved items from the iter-2 judgment are verified closed. Reviewer reports 0 CRITICAL / 0 HIGH / 0 MEDIUM / 0 LOW. Judge independently verified every claim.

### Verified Validation Results

- **Starting commit:** reviewer-verified iter-3 HEAD (side `ebf73cf` + agent `8e62af863`)
- **Pre-existing failures (reviewer-reproduced):** `cargo test -p codex-core --tests hooks`: `suite::hooks_mcp::post_tool_use_records_mcp_tool_payload_and_context`, `suite::hooks_mcp::pre_tool_use_blocks_mcp_tool_before_execution` (judge-reproduced identifiers; reviewer also reported `suite::hooks::permission_request_hook_allows_network_approval_without_prompt` — wiremock flake variance, same class, clearly pre-existing).
- **HEAD results:** Judge re-ran:
  - `cargo clippy -p codex-core --tests -- -D warnings`: clean (regression from iter-2 cleared)
  - `cargo check -p codex-core --tests`: clean, no warnings, unused `CompactedItem` import gone
  - `cargo test -p codex-core context_bonsai`: **19/19 pass** (includes new regression tests `context_bonsai_retrieve_unblocks_after_real_user_turn_boundary` and `context_bonsai_prune_then_retrieve_round_trips_through_session`)
  - `cargo test -p codex-core reconstruct_bonsai_archive_rehydrates_retrieve_path_after_resume`: **1/1 pass** (new H2 E2E test)
  - `cargo test -p codex-hooks bonsai_guidance_is_not_re_injected_on_resume`: **1/1 pass**
  - Side crate `cargo test`: all green; `cargo clippy --all-targets -- -D warnings`: clean
  - `cargo test -p codex-core --tests hooks`: 27 pass / 2 pre-existing failures (wiremock)
- **Regressions:** none
- **Regression gate:** clear

---

### Overall Verdict

**APPROVED AS-IS**

Iteration 3 is a surgical closing round. All four must-fix items from iter-2 (C1-new, H2, H1, M1) and both should-fix items (M2, M3) are closed with fixes that match the judge's guidance and include regression tests. Reviewer found zero new findings, verified each closure independently, traced the C1-new arithmetic at the boundary, and confirmed the H2 E2E test drives the real production path (`record_initial_history` → `apply_rollout_reconstruction` → `rehydrate_bonsai_archives`) rather than a hand-built mock.

The story is complete. Every acceptance criterion is met with direct evidence:

- AC1 (prune/retrieve centered on replacement-history): satisfied by iter-2's `apply_bonsai_prune`/`apply_bonsai_retrieve` calling `replace_compacted_history`/`replace_history`.
- AC2 (guidance and gauge outside core where feasible): hook-side `session_start` guidance + `user_prompt_submit` gauge; no core prompt-assembly additions.
- AC3 (minimum core files): session/mod.rs seam + protocol CompactedItem extension; no broader refactor.
- AC4 (guard semantics located): side crate `guards.rs` + wrapper `compute_malformed_flags`; same-step guard in `apply_bonsai_retrieve`.
- AC5 (durable archive metadata shape): `BonsaiArchiveMeta`/`BonsaiArchivePayload` in side crate, embedded in `CompactedItem.bonsai_archive`.
- AC6 (archived-content payload for retrieve): payload carries `archived_history` directly; retrieve restores verbatim.
- AC7 (persisted-history reconstruction coverage): iter-3 H2 closed this — rehydrate on resume, E2E test proves retrieve-after-resume works.
- AC8 (validation commands cover hooks/compaction/reconstruction): all green.

---

### Finding-by-Finding Evaluation

#### [C1-new] Same-step retrieve guard permanently blocks retrieve after first prune — CLOSED

- **Commit**: `689c4e1fc` (agent)
- **Fix**: `record_user_prompt_and_emit_turn_item` at `session/mod.rs:2968` now does `self.bonsai_turn_seq.fetch_add(1, SeqCst)` at the top of the function. Called from `session/turn.rs:324` (main turn path) and `hook_runtime.rs:319` (pending-input path) — both converge through this entrypoint, so every genuine user turn advances the counter exactly once.
- **Judge verification of arithmetic**: Walked the boundary math independently.
  - Session start: counter = 0.
  - User turn 1 boundary: `fetch_add` returns 0, counter → 1.
  - Prune in turn 1: `fetch_add` returns 1, stores `entry.turn_seq = 1`, counter → 2.
  - Retrieve same turn: `current_seq = 2`, `entry.turn_seq.saturating_add(1) = 2` → blocked. ✓
  - User turn 2 boundary: counter → 3.
  - Retrieve turn 2: `current_seq = 3`, `entry.turn_seq + 1 = 2` → not blocked. ✓
- **Verification**: `grep bonsai_turn_seq` confirms no test-only `fetch_add` writers; the E2E test at `tests.rs:7233` `context_bonsai_retrieve_unblocks_after_real_user_turn_boundary` drives the boundary through `record_user_prompt_and_emit_turn_item` — no manual counter manipulation. `saturating_add` hardening at `:2516` correctly handles `u64::MAX` sentinels installed by rehydrate.
- **Verdict**: CLOSED. Fix is correct, regression test is real.

#### [H2] Archive cache not rehydrated on resume — CLOSED

- **Commit**: `8e62af863` (agent)
- **Fix**: New `rehydrate_bonsai_archives` helper at `session/mod.rs:1263-1273` walks all `RolloutItem::Compacted`, pulls each `bonsai_archive`, installs via `state.record_bonsai_archive(payload.clone(), next_sentinel)`. Sentinels start at `u64::MAX` and decrement with `saturating_sub(1)` — well outside any live counter range, paired with the `saturating_add` hardening in the retrieve guard. Called from `apply_rollout_reconstruction` at `:1244`, which sits on both Resumed (`:1167`) and Forked (`:1204`) paths of `record_initial_history`.
- **E2E test**: `reconstruct_bonsai_archive_rehydrates_retrieve_path_after_resume` at `rollout_reconstruction_tests.rs` — drives prune on a source session, serializes the compacted item with serde, hands it to a fresh session as `InitialHistory::Resumed(...)`, calls `record_initial_history` (the real production entry), drives one real user-turn boundary, calls `apply_bonsai_retrieve`, and asserts the archived range restored verbatim. This exercises the exact path a resumed session would take — not a hand-built Vec.
- **Judge verification**: Ran the test at HEAD: 1/1 pass. Confirmed by tracing `record_initial_history` → `apply_rollout_reconstruction` → `rehydrate_bonsai_archives`. `find_archive_by_anchor` correctly keeps `#[cfg_attr(not(test), allow(dead_code))]` because rehydrate uses `state.record_bonsai_archive` directly.
- **Verdict**: CLOSED. Closes spec "Archived state survives…session reload, resume" and AC7.

#### [H1] Clippy regression in context_bonsai.rs — CLOSED

- **Commit**: `1beb7b2d9` (agent)
- **Fix**: `compute_malformed_flags` collapsed to a single `zip().map()` chain, eliminating the `Vec<bool>` intermediate collect that triggered `needless_collect = deny`. Nested `if let` in `extract_text`'s Reasoning arm converted to a let-chain. Two `find_map(|x| Some(..))` calls rewritten to `.map(..).next()`. `vec![..]` → `[..]` where the allocation is indexed without mutation.
- **Judge verification**: Ran `cargo clippy -p codex-core --tests -- -D warnings` at HEAD — clean. Re-read the `compute_malformed_flags` rewrite: semantically equivalent (orphan computation unchanged; archive mask applied per-element via tuple destructuring rather than a second pass). Let-chain preserves short-circuit. `.find_map(|_| Some(x))` and `.map(..).next()` are identical because the inner match always returns `Some(_)`.
- **Verdict**: CLOSED. Standard compliance restored.

#### [M1] BONSAI_GUIDANCE missing spec §1 meanings — CLOSED

- **Commit**: `ebf73cf` (side)
- **Fix**: `codex_context_bonsai/src/lib.rs:52` now carries a single-paragraph guidance string that covers all six spec §1 bullets.
- **Judge verification of spec §1 coverage**:
  1. Tool existence: "You have access to two tools for managing long transcripts: `context-bonsai-prune`…`context-bonsai-retrieve`" ✓
  2. Pattern-boundary, not ranking disclosure: "Selection uses `from_pattern` and `to_pattern` text matches to pick boundaries; do not expose your internal ranking heuristics" ✓
  3. Protected content by default: "Keep protected content in context by default: system and developer operational rules, the overarching session goal, unresolved task instructions, unmet acceptance criteria, and active validation or fix-loop context" ✓ — matches the spec's "Protected Context Contract" list verbatim.
  4. Prioritization: "Prefer pruning older completed contiguous blocks" ✓
  5. Recency and drift: "drift away from recent in-progress work. Prune more aggressively when the context pressure gauge reports High or Urgent" ✓
  6. Non-destructiveness: "Pruning is non-destructive: archives remain retrievable by anchor id" ✓
- **Verdict**: CLOSED. Spec §1 equivalence restored.

#### [M2] Session-start guidance duplicates on every resume — CLOSED

- **Commit**: `1863ca285` (agent)
- **Fix**: `hooks/src/events/session_start.rs:90-95` matches on `SessionStartSource::Startup | Clear` → inject guidance; `SessionStartSource::Resume` → `Vec::new()`. `additional_contexts` now initialized from `bonsai_guidance` (already a Vec).
- **Judge verification**: Enum at `:21-25` has exactly three variants with no `_`, so the match is exhaustive without catch-all — any future variant would fail to compile and force a re-review. `Clear` semantically correct for injection (user wiped transcript; need re-injection). Resume correctly skipped because the replayed transcript already carries the original guidance row. New test `bonsai_guidance_is_not_re_injected_on_resume` at `:406-430` asserts `additional_contexts.is_empty()` on Resume — ran 1/1 pass.
- **Verdict**: CLOSED.

#### [M3] Unused `CompactedItem` import in context_bonsai_tests.rs — CLOSED

- **Commit**: `1beb7b2d9` (agent; bundled with H1)
- **Fix**: Import removed; sole remaining mention at `:288` is inside a doc comment (non-code).
- **Judge verification**: `cargo check -p codex-core --tests` clean, no warnings.
- **Verdict**: CLOSED.

---

### Reviewer's "minor informational note" — two-prunes-same-turn design corner

**Note**: Reviewer flagged that if the model performs two prunes in the same user turn, the first prune's same-step guard becomes bypassable within that turn (counter advances twice in the turn, delta = 2 rather than 1, so `current_seq == entry.turn_seq + 1` returns false for the first archive before any user-turn boundary fires).

**Judge assessment**: Not story-blocking.

- Spec §3 uses SHOULD, not MUST: "If the archive was created in the same model step or turn, the implementation SHOULD reject immediate retrieval with a deterministic same-step guard error." A partial implementation of a SHOULD is tolerable; the common case (single prune per turn) is correct.
- The bypass is narrow: it requires the model to issue prune-prune-retrieve(first-anchor) in one turn, which contradicts the guidance constant ("never retrieve an archive you created in the same turn") and is strictly a model-choice failure rather than an implementation correctness failure.
- The fix (stamping a per-archive `same_step_boundary` marker at prune time rather than relying on counter arithmetic) is a refinement, not a correctness gap. Worth tracking as future-iteration work, not iteration-4 scope.
- Iteration 3 is the final surgical round. Opening a new must-fix for a SHOULD partial implementation on a story that's otherwise spec-compliant would be scope creep.

Document for future hardening if empirical use surfaces it.

---

### Status of Previous-Iteration Approvals (verified against iter-3 HEAD)

All iter-1 and iter-2 approved items remain closed:

- **C1 iter-1** (runtime integration): LANDED iter-2, intact iter-3.
- **C2 iter-1** (malformed guard): LANDED iter-2, intact iter-3 (refactored by H1 into single-pass form, semantically equivalent).
- **C3 iter-1** (reconstruction coverage): LANDED iter-2 (serde); iter-3 H2 closed the retrieve-after-resume gap.
- **M1 iter-1** (reasoning text): LANDED iter-2, intact iter-3 (let-chain rewrite by H1).
- **M2 iter-1** (stable anchor ids): LANDED iter-2, intact iter-3.
- **M4 iter-1** (`GuardError::Internal`): LANDED iter-2, intact iter-3.
- **C1-new iter-2** (same-step guard counter): CLOSED iter-3.
- **H2 iter-2** (rehydrate on resume): CLOSED iter-3.
- **H1 iter-2** (clippy): CLOSED iter-3.
- **M1 iter-2** (guidance content coverage): CLOSED iter-3.
- **M2 iter-2** (resume duplication): CLOSED iter-3.
- **M3 iter-2** (unused import): CLOSED iter-3.

Rejected items (M3-iter1, M5-iter1, L1-iter1&2, L2-iter1&2) correctly not re-addressed.

---

### Loop/Conflict Detection

**Previous Iterations**: 2 (judgement.1.md, judgement.2.md)
**Recurring Issues**: None. Iter-1 identified scaffolding gaps; iter-2 identified integration bugs in the newly-wired path; iter-3 closed those bugs with no new regressions.
**Conflicts Detected**: None. No approved item in iter-3 contradicts prior guidance.
**Assessment**: Healthy progression. Each iteration tightened a specific seam (scaffold → wire → correct). Iter-3 added zero new debt and removed all open findings.

---

### Recommendations

**APPROVED AS-IS.** The implementation meets every acceptance criterion with real evidence, survives the full validation command set with zero regressions, and the single reviewer "informational note" is spec-compliant-as-SHOULD. Close Story CB-codex.1.

This also closes the Context Bonsai agent-ports epic (CB-kilo.1, CB-gemini.1, CB-cline.1, CB-codex.1 all now complete).

**Suggested future-iteration work (NOT story scope)**:

- Two-prunes-same-turn guard refinement — track a per-archive `same_step_boundary` flag stamped at prune time so the guard does not rely solely on counter delta. Low priority; guidance text already instructs the model not to retrieve same-turn, and SHOULD not MUST.
- Iter-2 rejected L1 (gauge always-fire at critical pressure): still rejected; revisit if empirical use shows the gap matters.
- Iter-2 rejected L2 (`.agent_tmp/` gitignore): still rejected; harness hygiene, not story scope.

---

### Complexity Guard Notes

No new suggestions to reject this iteration — reviewer already filtered their own report to zero findings. Carryover rejections from prior iterations remain appropriate:

- Adding a dedicated `same_step_boundary` bool field on archive entries is the clean fix for the two-prunes-same-turn corner, but introducing it now as iteration-4 scope would be over-engineering: spec §3 is SHOULD, the common case is correct, and iter-3 is the final surgical round. Document for future hardening.
- L1 and L2 remain future-enhancement territory; rejecting them prevents scope creep on a story that is otherwise complete.
