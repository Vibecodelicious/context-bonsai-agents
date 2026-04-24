## Judge's Assessment

**Story**: CB-codex.1 — Codex replacement-history implementation plan
**Iteration**: 2 of 5 maximum
**Date**: 2026-04-24

---

### Summary

| Verdict | Count |
|---------|-------|
| APPROVED (must fix) | 3 |
| APPROVED (should fix) | 3 |
| REJECTED (over-engineering) | 0 |
| REJECTED (out of scope) | 2 |
| REJECTED (not valid) | 0 |

### Verified Validation Results

- **Starting commit:** `1fda843fb` (reviewer-verified at iter-1; unchanged baseline)
- **Pre-existing failures (reviewer-reproduced):** `cargo test -p codex-core --tests hooks`: `suite::hooks::permission_request_hook_allows_network_approval_without_prompt`, `suite::hooks_mcp::post_tool_use_records_mcp_tool_payload_and_context`, `suite::hooks_mcp::pre_tool_use_blocks_mcp_tool_before_execution`
- **HEAD results:** Judge spot-checked `cargo test -p codex-core context_bonsai`: 18 pass / 0 fail. Side crate `cargo test` and `cargo clippy --all-targets -- -D warnings`: clean. `cargo check -p codex-core --tests`: 1 new warning (`unused_imports` for `CompactedItem`). `cargo clippy -p codex-core --tests`: **1 error + 3 warnings** (see H1).
- **Regressions:** `cargo clippy -p codex-core --tests` transitions from clean at baseline to failing at HEAD (`-D clippy::needless-collect` in `codex-rs/Cargo.toml:419` triggered by `context_bonsai.rs:370`). See H1.
- **Regression gate:** **blocked on clippy** — but the story's stated validation command list does not name `cargo clippy -p codex-core`. Treated as APPROVED must-fix rather than NEEDS_DISCUSSION because (a) `codex_context_bonsai/STANDARDS.md:5` explicitly binds workspace clippy lints, (b) `codex/AGENTS.md:56` requires `just fix -p <project>` before finalizing, (c) the fix is a two-line rewrite with no architectural blast radius.

---

### Overall Verdict

**NEEDS REVISION**

Iteration 2 delivered most of the iter-1 must-fix bundle (C1 wrapper wiring, C2 malformed detector, C3 serde round-trip, M1 reasoning text, M2 stable hashed anchors, M4 `GuardError::Internal`). H1 hook wiring also landed early. However, two genuine correctness bugs slipped in at the session-state integration layer:

1. **C1 (this iteration's numbering — same-step retrieve guard permanently blocks retrieve after first prune).** The counter only advances on prune. After one prune in a session, every subsequent retrieve for that anchor returns `SameStepRetrieve`. The E2E test in `session/tests.rs:7195` masks this by manually bumping the counter — a step no production caller performs. This defeats AC from spec §3 (retrieve must succeed when not same-step).
2. **H2 (archive cache not rehydrated on resume).** `rollout_reconstruction.rs` was never modified to repopulate `SessionState.bonsai_archives` from `CompactedItem.bonsai_archive` rows. The serde payload survives (C3 test confirms that much), but `session.apply_bonsai_retrieve(&anchor)` post-resume will return `Missing`. This defeats the spec's "Archived state survives…session reload, resume, or process restart" (Required User Outcomes).

Together, (1) forces a second prune to unlock the first archive, and (2) makes retrieve totally dead after resume regardless. Three iterations remain; both are straightforward surgical fixes (tens of LoC each).

Side-crate architecture, guard correctness, and the serde shape are in excellent shape. The seam choice (replacement-history snapshots) remains correct. The remaining work is plumbing, not design.

---

### Finding-by-Finding Evaluation

#### [C1-new] Same-step retrieve guard permanently blocks retrieve after any prune
- **Reviewer's Issue**: `bonsai_turn_seq` only increments inside `apply_bonsai_prune` via `fetch_add(1)`. After a single prune the counter lands one step past the stored `entry.turn_seq`; retrieve's check `current_seq == entry.turn_seq + 1` is true until another prune fires. No user-turn, tool-call, or session-event code advances the counter.
- **Verification**: Judge confirmed by `grep -rn bonsai_turn_seq codex-rs/core/src/ --include='*.rs'` — the only non-test writer is `apply_bonsai_prune` at `session/mod.rs:2443`. The E2E test at `session/tests.rs:7195-7197` manually invokes `session.bonsai_turn_seq.fetch_add(1, SeqCst)` to simulate a turn boundary — this path is not reachable from any production code. Traced arithmetic: first prune stores `turn_seq = 0` (prior value), leaves counter at 1; later retrieve loads `current_seq = 1`, compares against `entry.turn_seq + 1 = 1`, match → `SameStepRetrieve`.
- **Verdict**: APPROVED (must fix — blocks AC6/spec §3)
- **Reasoning**: The same-step guard is a SHOULD in the shared spec, but the implementation chose to implement it. Having chosen to implement it, it must be correct. The current design turns retrieve into single-use-per-session-or-dead, which is strictly worse than not having the guard at all. Spec §3 says "If the archive was created in the same model step or turn" — the counter must track actual step/turn boundaries.
- **Guidance for fix**: Advance `bonsai_turn_seq.fetch_add(1, SeqCst)` at a stable user-turn boundary. The natural site is inside `Session::record_user_prompt_and_emit_turn_item` (`session/mod.rs:2923`) or the hook-runtime entry for `run_user_prompt_submit_hooks`. Either location fires exactly once per genuine user turn. After the fix, adjust the E2E test to drive the boundary through the same production path rather than a manual `fetch_add`. Add one new test: prune → simulate one user-turn boundary → retrieve succeeds without `SameStepRetrieve`.

#### [H1] Clippy regression: `needless_collect` denied + 3 ancillary warnings
- **Reviewer's Issue**: `codex-rs/core/src/context_bonsai.rs:370` collects `Vec<bool>` only to re-iterate. Workspace lint `needless_collect = "deny"` at `codex-rs/Cargo.toml:419`. Additional `unnecessary_find_map` warning at `:136`.
- **Verification**: Judge ran `cargo clippy -p codex-core --tests` at HEAD and reproduced: 1 error + 3 warnings. Baseline `1fda843fb` compiles clean. `compute_malformed_flags` is new in `d94efcf17` — the iter-2 harden-guards commit introduced the offending `.collect::<Vec<bool>>()`. `codex_context_bonsai/STANDARDS.md:5` binds workspace lints; `codex/AGENTS.md:56` requires `just fix -p <project>` before finalizing large changes.
- **Verdict**: APPROVED (must fix — standard compliance)
- **Reasoning**: The story's named validation commands do not include `cargo clippy -p codex-core`, which is why this is not escalated as a hard regression gate violation. But both STANDARDS.md (binding) and AGENTS.md (explicit discipline) require a clean clippy result before finalization. The fix is mechanical (chain the iterator through `.map(...)` without collecting to `Vec<bool>`). Not fixing this blocks any reviewer who runs the workspace lint — which is standard practice for this codebase.
- **Guidance for fix**: Drop the intermediate `Vec<bool>` collect at `context_bonsai.rs:370`. Either (a) return an `impl Iterator<Item = bool>` from the helper and consume it directly, or (b) restructure so `compute_malformed_flags` materializes once at the call site that actually needs indexed access. Also address the three clippy warnings in the same commit: `unnecessary_find_map` at `:136-138` and whatever two warnings the `:126-127` comment describes. Run `just fix -p codex-core` once to surface anything else.

#### [H2] Archive cache not rehydrated on resume — retrieve-after-resume silently broken
- **Reviewer's Issue**: `SessionState::bonsai_archives` initialized fresh by `SessionState::new()` at `state/session.rs:74`, only written by `apply_bonsai_prune`. `rollout_reconstruction.rs` has zero handling of `CompactedItem.bonsai_archive`. Test `reconstruct_history_bonsai_archive_payload_survives_resume` does not call `session.apply_bonsai_retrieve(&anchor)` post-resume — it only asserts the payload is findable via `find_archive_by_anchor` on the in-memory Vec the test built itself.
- **Verification**: Judge confirmed three ways:
  1. `grep -n "bonsai\|CompactedItem" codex-rs/core/src/session/rollout_reconstruction.rs` — zero matches for bonsai. The only `RolloutItem::Compacted` handlers at `:112` and `:250` deal with `replacement_history` only.
  2. `SessionState::new()` at `state/session.rs:59-76` initializes `bonsai_archives: HashMap::new()`. The only writer is `record_bonsai_archive`, called from `apply_bonsai_prune`. No reconstruction path invokes it.
  3. The test at `rollout_reconstruction_tests.rs:1600` calls `crate::context_bonsai::find_archive_by_anchor(&compactions, &expected_anchor)` on a test-built Vec — not the session's live state.
- **Verdict**: APPROVED (must fix — blocks AC7 and shared-spec Required User Outcome)
- **Reasoning**: Shared spec "Required User Outcomes": "Archived state survives the persistence model used by the host agent, such as session reload, resume, or process restart." Codex has persistence (rollout), so this clause applies. The payload survives on disk but the live cache does not get populated on resume, so the retrieve TOOL — which is the only thing the model can invoke — fails with `Missing` for any pre-resume archive. This is a user-visible correctness bug.
- **Guidance for fix**: In the reconstruction path (`rollout_reconstruction.rs` around the existing `RolloutItem::Compacted` handler, or in the finalize step that writes the reconstructed state), iterate over all `Compacted` items and for each `bonsai_archive: Some(payload)` call `state.record_bonsai_archive(payload, <sentinel turn_seq>)`. Use a sentinel that cannot collide with live prune counters (e.g. `u64::MAX.saturating_sub(i)` where `i` is the index). With the C1 fix landed, the `current_seq == entry.turn_seq + 1` check will correctly evaluate to false for sentinels, so retrieve proceeds. Add an E2E test: prune in session A, drop session, resume from the rollout file, call `session.apply_bonsai_retrieve(&anchor)`, assert archived history restored verbatim. The function-level `#[cfg_attr(not(test), allow(dead_code))]` on `find_archive_by_anchor` at `context_bonsai.rs:700` should come off when reconstruction starts using it.

#### [M1] BONSAI_GUIDANCE omits multiple spec §1 meanings
- **Reviewer's Issue**: Current text covers (1) tool existence, (4) prioritization, (6) non-destructiveness partial. Missing: (2) pattern-boundary-not-ranking disclosure, (3) protected-content list, (5) recency/drift effects.
- **Verification**: Judge read `codex_context_bonsai/src/lib.rs:52`. The constant mentions tools, placeholder shape, "older completed blocks when the context pressure gauge reports High or Urgent," never-prune-in-progress-tool-call, and never-retrieve-same-turn. It omits protected content (system/developer rules, session goal, unresolved tasks, unmet acceptance criteria, active validation context — all listed in spec "Protected Context Contract"), the pattern-boundary-not-ranking disclosure rule from spec §1 bullet 2, and the recency-and-drift cue from bullet 5. Spec §1 says: "If wording changes, the meaning of the protected-context, ranking, drift, and execution rules MUST remain equivalent." Three of those four categories are currently silent.
- **Verdict**: APPROVED (must fix — spec §1 MUST)
- **Reasoning**: The spec draws an explicit equivalence line at four meanings (protected-context, ranking, drift, execution); the current text covers execution and a thin sliver of ranking. The fix is text expansion in one constant — low blast radius. Skipping it leaves the model blind to what it should NOT prune.
- **Guidance for fix**: Extend `BONSAI_GUIDANCE` in `codex_context_bonsai/src/lib.rs` to cover: protected-content list (operational rules, session goal, unresolved tasks, active fix-loop context), pattern-boundary-not-ranking disclosure (the model should choose by pattern boundaries, not expose its internal ranking heuristic), and recency/drift (prefer older completed contiguous blocks; drift away from recent in-progress work). Keep it one paragraph — the existing single-line format is fine. Host-side tests that assert exact wording will need updating in lockstep.

#### [M2] Session-start guidance duplicates on every resume
- **Reviewer's Issue**: `SessionStartSource::Resume` fires the session-start pending-source flag; `session_start::run` unconditionally prepends `BONSAI_GUIDANCE`. Resumed sessions accumulate one extra `[context-bonsai]` developer row per resume.
- **Verification**: Judge confirmed: `session/session.rs:921-927` maps `InitialHistory::Resumed(_)` → `SessionStartSource::Resume` and sets `pending_session_start_source`. `hooks/src/events/session_start.rs:82-99` unconditionally initializes `let bonsai_guidance = codex_context_bonsai::BONSAI_GUIDANCE.to_string();` and always includes it in `additional_contexts`. There is no dedup check against already-present bonsai rows.
- **Verdict**: APPROVED (should fix — quality, resume path correctness)
- **Reasoning**: A user resumes a session N times → N copies of the same block. Tests currently filter the prefix so the accumulation is invisible to test assertions but real in production transcripts. Affects token budget and gauge math subtly. Fix is localized.
- **Guidance for fix**: Simplest: gate the prepend on `matches!(request.source, SessionStartSource::Startup | SessionStartSource::Clear)` — on Resume, the guidance is already in the replayed transcript, no need to re-add. Alternative (safer if the resumed transcript might have been compacted past the original guidance row): check `additional_contexts` or the replayed history for an existing row whose text starts with `"[context-bonsai]"` before prepending. Add one test for each branch (startup includes, resume does not duplicate).

#### [M3] Unused import warning in test module
- **Reviewer's Issue**: `use codex_protocol::protocol::CompactedItem;` at `context_bonsai_tests.rs:8` only appears in a doc comment at `:289`. `cargo check -p codex-core --tests` warns.
- **Verification**: Judge ran `cargo check -p codex-core --tests` at HEAD — reproduced warning. Reference at `:289` is inside a `//` comment only.
- **Verdict**: APPROVED (should fix — trivial hygiene)
- **Reasoning**: One-line fix. Leaving it in degrades the signal-to-noise of `cargo check` for anyone iterating on this area.
- **Guidance for fix**: Delete the import line.

#### [L1] Gauge fires only on turn 5, 10, 15 — no always-fire escape hatch
- **Reviewer's Issue**: `hooks/src/events/user_prompt_submit.rs:151-159` returns `None` unless `turn % 5 == 0`. Even at ratio > 0.9 the first four turns emit nothing.
- **Verification**: Confirmed.
- **Verdict**: REJECTED (out of scope — future enhancement)
- **Reasoning**: Spec §7 sets cadence at "every 5 turns by default." The every-5 default is explicitly a default, but there is no MUST requiring an always-fire-at-critical-pressure escape hatch. The reviewer flagged this as defer-friendly and so do I. Revisit in a later iteration or a new story if empirical usage shows the gap matters. Not in scope for CB-codex.1.

#### [L2] `.agent_tmp/` untracked in both repos
- **Reviewer's Issue**: Harness-level scratch dirs.
- **Verdict**: REJECTED (out of scope — iter-1 judge already rejected this as harness hygiene, not story scope)
- **Reasoning**: Same reasoning as iter-1: gitignore hygiene is a separate chore. Reviewer acknowledges iter-1 rejected this.

---

### Status of Iter-1 Approvals (verified against iter-2 HEAD)

- **C1 (iter-1, runtime integration)**: LANDED. Wrapper wired via `Session::apply_bonsai_prune` and `apply_bonsai_retrieve`; tool handlers registered (`a17bc74e7`); `#![allow(dead_code)]` removed from module (function-level remains on `find_archive_by_anchor`, which is fine until H2 fix consumes it). **However the integration introduced the new C1-new bug above.**
- **C2 (malformed guard)**: LANDED. `compute_malformed_flags` + `malformed_flags_for_range` now reject ranges that sever tool-call pairs.
- **C3 (reconstruction coverage)**: **PARTIAL.** Serde round-trip proven; retrieve-after-resume not exercised. Subsumed by new H2.
- **M1 (reasoning text in extract_text)**: LANDED.
- **M2 (stable anchor ids)**: LANDED. Hash over role+kind+first-128-char+index.
- **M4 (GuardError::Internal replacing assert_eq!)**: LANDED.
- **H1 iter-1 (gauge & guidance)**: LANDED but introduces M1-new (guidance content gap) and M2-new (resume duplication).
- **H2 iter-1 (dev report baseline accuracy)**: N/A this iteration; judge did not re-verify test counts at HEAD but reviewer's 27/29 hooks number matches the expected pre-existing failures list. Regression gate remains clear on named validation commands.
- **Rejected iter-1 items** (M3-old, M5-old, L1-old, L2-old): not re-addressed by dev. Good — iter-1 judge said do not address.

---

### Loop/Conflict Detection

**Previous Iterations**: 1 (judgement.1.md committed as `b4e2302`)
**Recurring Issues**: One reused letter (C1) but different content — iter-1 C1 was "no runtime integration"; iter-2 C1 is "runtime integration introduced a same-step-guard arithmetic bug." Not a loop; not a conflict.
**Conflicts Detected**: None. No iter-1 approved item is contradicted by iter-2 guidance.
**Assessment**: Progressing. Iter-1 shipped a scaffolded wrapper; iter-2 wired it through and added substantial test coverage. Iter-3 is a surgical round to close the two seam-level correctness bugs (C1-new, H2) and tighten the guidance text (M1). No architectural rework required.

---

### Recommendations

**Iteration 3 must-fix bundle** (ordered by risk-reduction per LoC):

1. **C1-new (same-step guard)**: Advance `bonsai_turn_seq` at a user-turn boundary. Natural site: `Session::record_user_prompt_and_emit_turn_item` or the top of `run_user_prompt_submit_hooks`. Update the E2E test to drive the boundary through production code rather than `fetch_add` manually. Add one test: prune → turn boundary → retrieve succeeds.
2. **H2 (rehydrate archive cache on resume)**: In `rollout_reconstruction.rs`, when materializing compactions, for each `CompactedItem { bonsai_archive: Some(payload), .. }` call `state.record_bonsai_archive(payload, sentinel_turn_seq)`. Use a sentinel that cannot collide with live prune counters. Add an E2E test covering prune → drop session → resume → retrieve → verify restored history. Remove `#[cfg_attr(not(test), allow(dead_code))]` from `find_archive_by_anchor` if it becomes dead, or keep if reconstruction uses a different helper.
3. **H1 (clippy regression)**: Fix `needless_collect` at `context_bonsai.rs:370` and the three warnings (one at `:136-138`, two around `:126-127`). Run `just fix -p codex-core` once at the end.
4. **M1 (guidance content coverage)**: Extend `BONSAI_GUIDANCE` in `codex_context_bonsai/src/lib.rs` to cover protected-content list, pattern-boundary-not-ranking, and recency/drift. Update host-side wording assertions in the same commit.

**Iteration 3 should-fix** (small quality wins, bundle with must-fix):

5. **M2 (resume duplication)**: Gate bonsai guidance prepend on `SessionStartSource::Startup | Clear`, or dedup against existing transcript rows.
6. **M3 (unused import)**: Delete `use codex_protocol::protocol::CompactedItem;` at `context_bonsai_tests.rs:8`.

**Rejected** (do NOT address): L1, L2.

With four remaining items of real substance and three of those being small text/glue changes, iteration 3 is comfortable scope. Two iteration budget remain after that, leaving headroom.

---

### Complexity Guard Notes

Items rejected specifically to prevent over-engineering or scope creep:

- **L1 (gauge always-fire at critical pressure)**: Spec §7 explicitly permits the every-5 cadence as default. No MUST. Adding a ratio-based escape hatch is a future enhancement; defer until empirical evidence says the gap matters.
- **L2 (.agent_tmp gitignore)**: Harness hygiene, confirmed out-of-story by iter-1 judge.

No iter-2 reviewer suggestion rose to the level of "tempting but actually over-engineering." The report is well-scoped.
