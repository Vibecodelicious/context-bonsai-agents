## Judge's Assessment

**Story**: CB-codex.1 — Codex replacement-history implementation plan
**Iteration**: 1 of 5 maximum
**Date**: 2026-04-23

---

### Summary

| Verdict | Count |
|---------|-------|
| APPROVED (must fix) | 4 |
| APPROVED (should fix) | 4 |
| REJECTED (over-engineering) | 1 |
| REJECTED (out of scope) | 2 |
| REJECTED (not valid) | 0 |
| DEFERRED (later iteration, documented) | 2 |

### Verified Validation Results

- **Starting commit:** `1fda843fb` (reviewer-verified; confirmed to exist in the codex repo)
- **Pre-existing failures (reviewer-reproduced):** `cargo test -p codex-core --tests hooks`: `suite::hooks::permission_request_hook_allows_network_approval_without_prompt`, `suite::hooks_mcp::post_tool_use_records_mcp_tool_payload_and_context`, `suite::hooks_mcp::pre_tool_use_blocks_mcp_tool_before_execution`
- **HEAD results:** Judge re-ran `cargo test -p codex-core --tests hooks` at HEAD: 26 passed / 3 failed — same three identifiers as baseline. Side crate `cargo test` (side-repo) all green (33 tests). `cargo test -p codex-core context_bonsai` = 9 passed.
- **Regressions:** none (same three pre-existing hooks failures at baseline and HEAD)
- **Regression gate:** clear

---

### Overall Verdict

**NEEDS REVISION**

Three CRITICAL findings are all valid and block AC1, AC6, AC7. The dev report itself flags most of the missing wiring as "deferred", but the approved plan's AC1 and "prune/retrieve uses canonical history overwrite path" cannot be claimed until at least one of the wrapper's entry points is exercised from production code and a `bonsai_archive: Some(..)` round-trips through reconstruction. No regression gate issue. Side-crate architecture is solid; the gap is that core-side integration has not started. Plenty of iteration budget remains (1 of 5).

---

### Finding-by-Finding Evaluation

#### [C1] Runtime integration entirely absent — nothing calls the wrapper
- **Reviewer's Issue**: `build_prune_install` / `build_retrieve_install` have zero production callers. `#![allow(dead_code)]` hides it. Tools not registered. Model cannot invoke bonsai.
- **Verification**: Confirmed. `grep -rn "build_prune_install\|build_retrieve_install" codex-rs --include='*.rs'` returns hits only in `context_bonsai.rs` and `context_bonsai_tests.rs`. `grep context-bonsai-prune codex-rs` returns one hit, a doc-comment in `context_bonsai.rs:43`. No tool spec entries, no session-side wiring, no handler.
- **Verdict**: APPROVED (must fix)
- **Reasoning**: AC1/AC3 of the plan depend on prune/retrieve actually reaching the replacement-history install path. The story's Implementation Plan Phase 2 + Step-by-Step tasks 1, 3, 4 are undelivered. Dev is transparent about the deferral, but a wrapper nobody calls is not functional delivery.
- **Guidance for fix**: Iteration 2 MUST land at least the minimum integration slice: (a) a call-site in `session/mod.rs` that consumes `PruneInstall` and forwards `replacement_history` + `compacted_item` through `replace_compacted_history`; (b) tool registration in `core/src/tools/spec.rs` for `context-bonsai-prune` + `context-bonsai-retrieve` with handlers that call `build_prune_install` / `build_retrieve_install`; (c) an end-to-end test in `session/tests.rs` or `context_bonsai_tests.rs` that drives prune through the real session and asserts placeholder appears in the prompt history path. Once the handlers exist, the `#![allow(dead_code)]` must come off.

#### [C2] Malformed-range guard effectively disabled
- **Reviewer's Issue**: `context_bonsai.rs:92` hardcodes `malformed: false`; the side-crate's `MalformedRange` guard is unreachable from the Codex wrapper.
- **Verification**: Confirmed (`context_bonsai.rs:92`). Side crate's `validate_range` in `guards.rs:153` trusts the flag.
- **Verdict**: APPROVED (must fix)
- **Reasoning**: Shared spec §2 "Execution rules": "The selected range MUST NOT cut through incomplete or malformed tool-call history." With `malformed` hardwired to `false`, this MUST is silently violated. This is a correctness hole the dev scoped explicitly as "out of scope this iteration" — but without it the guard surface is incomplete and can persist corrupted archives.
- **Guidance for fix**: Implement a minimum-viable malformed detector: a `FunctionCall` with no matching `FunctionCallOutput` (by `call_id`) within the history slice, and vice versa, should flip `malformed = true`. Tool-call-pair detection is cheap — a single pass computing paired `call_id`s is enough. Add a test fixture with an orphan `FunctionCall` that causes `build_prune_install` to return `GuardError::MalformedRange`.

#### [C3] Reconstruction path does not handle `bonsai_archive`
- **Reviewer's Issue**: `rollout_reconstruction.rs` unchanged; no test exercises a `CompactedItem { bonsai_archive: Some(..) }` round-trip.
- **Verification**: Confirmed. `grep "bonsai_archive: Some"` returns exactly one hit — inside `build_prune_install` itself. All fixture literals use `None`.
- **Verdict**: APPROVED (must fix)
- **Reasoning**: AC7 "persisted-history reconstruction coverage" is unproven. Serde back-compat is present (good), but the story explicitly adds persistence specifically so retrieve can survive resume. Without a reconstruction test that starts from a rollout file containing a `Some(..)` payload, the persistence claim is untested.
- **Guidance for fix**: Add a reconstruction-path test in `session/rollout_reconstruction_tests.rs` that writes a `CompactedItem { bonsai_archive: Some(..), replacement_history: Some(..), .. }` to a rollout fixture, replays it through `rollout_reconstruction`, and asserts the resulting live history contains the placeholder (from `replacement_history`) while the archive payload is retrievable by anchor id. If iteration 2 scope can't stretch that far, at minimum add a serde-JSON round-trip assertion for the full `RolloutItem::Compacted(..)` variant with a populated bonsai payload.

#### [H1] Gauge & guidance never reach the model
- **Reviewer's Issue**: `hooks/src/events/session_start.rs` and `user_prompt_submit.rs` untouched. `gauge_text_for_ratio` exists in the side crate but is never injected.
- **Verification**: Confirmed — `grep "bonsai\|gauge_text_for_ratio\|context-bonsai" codex-rs/hooks codex-rs/core/src/hook_runtime.rs` returns empty.
- **Verdict**: APPROVED (should fix — NOT required for iteration 2 if C1/C2/C3 are fixed instead; required by iteration 3)
- **Reasoning**: Shared spec §1 (system guidance) and §7 (gauge) are MUSTs, not niceties. Codex-specific spec §"System guidance path" + "Gauge path" say both live hook-side. Dev scoped this as "scaffolding round" which is reasonable for iter 1, but the clock is ticking — spec violations cannot accumulate without resolution. Escalate to **must fix** if iteration 2 still ships without gauge/guidance and C1 is also unfixed.
- **Guidance for fix**: `session_start.rs` appends a static guidance text block via the hook's additional-context mechanism — use the side-crate constants from `placeholder.rs`/equivalent (add a `guidance_text()` helper in the side crate if needed). `user_prompt_submit.rs` calls `gauge_text_for_ratio` using the existing context-manager token usage on a 5-turn cadence (counter can live in session state) and appends the result to the hook's injected context. Both hook tests should assert the expected wording lands in the captured prompt.

#### [H2] Dev report overclaims baseline flake count
- **Reviewer's Issue**: Dev said "2 pre-existing wiremock flakes, one fixed"; reviewer reproduced 3, no flake fixed.
- **Verification**: Judge re-ran `cargo test -p codex-core --tests hooks` at HEAD and observed exactly the three listed failures. None appear fixed by this branch.
- **Verdict**: APPROVED (should fix — dev-report hygiene only, not a code fix)
- **Reasoning**: REVIEWER_SUBAGENTS § A0 requires accurate baseline reporting. The undercount is mild (1 missed failure out of 3), and critically it did not mask any regression — all three fail at baseline AND at HEAD, so the regression gate is clear. Still worth correcting in the next round's dev report to maintain audit discipline.
- **Guidance for fix**: In iteration 2's dev report, include the full list of three pre-existing hooks failures under "pre-existing failures" and do not claim any are fixed unless the fix is demonstrable.

#### [H3] `#![allow(dead_code)]` hides large unused surface
- **Reviewer's Issue**: 299 LoC in codex-core with module-wide dead-code allow. Suggested: move wrapper to a new crate `codex-context-bonsai-core`, or commit to landing call-sites before merge.
- **Verification**: Confirmed the allow and the unused surface. Confirmed `codex/AGENTS.md:62`: "resist adding code to codex-core".
- **Verdict**: APPROVED in spirit (commit to landing call sites); REJECTED on the specific suggestion to extract into a new crate.
- **Reasoning**: The root concern is real — a 299 LoC dead-code module in a crate whose AGENTS.md asks resisters to push back is a real smell. However, extracting the wrapper into yet another new crate (`codex-context-bonsai-core`) would be over-engineering: the wrapper's entire job is to plug codex-protocol `ResponseItem` into the side crate and build a `CompactedItem`. Both inputs are core-adjacent; a standalone crate would need to re-export `ResponseItem` handling and still be called from `codex-core`. The cleaner answer is simply to make C1's integration happen, which deletes the `#![allow(dead_code)]` and the concern with it. If iteration 2 slips, revisit.
- **Guidance for fix**: Tie the removal of `#![allow(dead_code)]` to the iteration that wires at least one call-site. If iteration 3 still has no call-site, re-open H3 for architectural action.

#### [M1] `extract_text` returns `""` for `ResponseItem::Reasoning`
- **Reviewer's Issue**: Reasoning items invisible to pattern matching.
- **Verification**: Confirmed (`context_bonsai.rs:100-123`).
- **Verdict**: APPROVED (should fix)
- **Reasoning**: Shared spec §"Pattern Matching Contract" says matching SHOULD operate on "message text and stable representations of completed tool-call input and output" — reasoning content is a stable message-like surface and excluding it silently creates match-surface holes. The fix is trivial (map `ResponseItem::Reasoning { summary, content, .. }` to the concatenated summary/content text).
- **Guidance for fix**: Extend `extract_text` to return the reasoning summary joined, or `content` text if present. Add a unit test under `context_bonsai_tests.rs` that prunes a range whose `from_pattern` matches reasoning text.

#### [M2] `default_item_id` collapses to synthetic `idx-<n>` after resume
- **Reviewer's Issue**: `ResponseItem::Message.id` / `Reasoning.id` carry `#[serde(default, skip_serializing)]`. After rollout round-trip the id is absent, so the anchor becomes `idx-<n>` — unstable across rewrites.
- **Verification**: Confirmed by inspecting `protocol/src/models.rs:449` and `:466`.
- **Verdict**: APPROVED (must fix before retrieve persistence is claimed)
- **Reasoning**: This directly undermines AC "durable archive metadata that survives reload". Bonsai's contract is that retrieve-by-anchor works after resume. If anchors are synthetic indices, any history edit (or a new compaction) shifts indices and breaks retrieval. This is the same class of issue as C3 — both sides of the persistence path are unproven. The codex-specific spec "Verified Host Primitives" mentions "role plus timestamp, session entry id, branch information, or host-native message metadata" as valid correlation data.
- **Guidance for fix**: Pick a stable correlation key other than runtime-only `id`. Options: (a) use the rollout line number (stable as long as the rollout file isn't rewritten non-monotonically); (b) use `(role, first-16-chars-of-text, position)` triple; (c) persist a synthetic stable id into the bonsai payload at prune time and store that id against the message in the replacement history so reconstruction can re-bind. Document the chosen strategy in the plan. This fix is best delivered in the same iteration as C3.

#### [M3] `build_retrieve_install` placeholder match is text-only prefix
- **Reviewer's Issue**: `starts_with("[PRUNED: <anchor> to <end>]")` could collide with a model-authored message that happens to begin with that prefix.
- **Verification**: Confirmed (`context_bonsai.rs:257-267`).
- **Verdict**: REJECTED (over-engineering for current scope)
- **Reasoning**: The placeholder string embeds both `anchor_id` and `range_end_id`, and is emitted by the wrapper itself as an `assistant` `Message` with `OutputText`. A user-authored or model-authored collision would require the exact same anchor and range-end id strings, which are host-stable message ids. Probabilistically negligible. Fixing it would require adding a sentinel marker (e.g. a dedicated `ResponseItem` variant or a metadata tag on `Message`) — a significant protocol change for a theoretical collision. Revisit if a real collision ever surfaces.

#### [M4] `assert_eq!` panics in production when `history.len() != archived_flags.len()`
- **Reviewer's Issue**: `context_bonsai.rs:151-155` uses `assert_eq!`, which panics on mismatched inputs rather than returning `Err`.
- **Verification**: Confirmed.
- **Verdict**: APPROVED (should fix)
- **Reasoning**: `build_prune_install` is called from a tool handler driven by model input indirectly — callers can (and will, during iteration 2) plumb in `archived_flags` derived from their own state. A mismatch is an invariant violation, not a model-supplied error, but panicking in a tool handler is a user-visible crash. Convert to `debug_assert_eq!` so debug builds still surface the bug, or return a new `GuardError::Internal` variant.
- **Guidance for fix**: Replace `assert_eq!` with `debug_assert_eq!` *and* an early `return Err(...)` in release builds, or (cleaner) make the function accept only `&[ResponseItem]` and compute `archived_flags` internally by scanning for previously-archived placeholder markers. The latter also removes one failure mode from caller code.

#### [M5] Side crate uses `edition = "2024"` without explicit justification
- **Reviewer's Issue**: `codex_context_bonsai/STANDARDS.md:11` says "Edition 2021 unless the crate justifies otherwise."
- **Verification**: `codex_context_bonsai/Cargo.toml:4` has `edition = "2024"`. Judge checked `codex-rs/Cargo.toml` and confirmed the agent workspace itself is `edition = "2024"`.
- **Verdict**: REJECTED (not valid as a finding — or at most a one-line doc nit)
- **Reasoning**: The justification is implicit and obvious: the side crate must cross-compile under the same edition as the crate that imports it (`codex-protocol` and `codex-core` both inherit `edition = "2024"`). Mixing 2021/2024 across path-deps causes macro-hygiene drift that would manifest as spurious build errors. The STANDARDS.md wording is the looser constraint here. Suggest updating STANDARDS.md to reflect the reality rather than changing the Cargo.toml.

#### [L1] Untracked `.agent_tmp/` scratch dirs in both submodules
- **Reviewer's Issue**: Add to `.gitignore`.
- **Verdict**: REJECTED (out of scope for CB-codex.1)
- **Reasoning**: These are harness-level scratch directories, not story output. Gitignore hygiene belongs to a separate chore, not a bonsai story iteration. If the dirs are committed accidentally in a future commit, catch it then. Note: judge confirmed the side repo has `tmp.*` subdirs (not `.agent_tmp/`) — reviewer's path is slightly off but the underlying observation stands.

#### [L2] Mixed re-export style in `protocol.rs`
- **Reviewer's Issue**: `pub use codex_context_bonsai::BonsaiArchiveMeta` vs `pub type BonsaiArchivePayload = ...<ResponseItem>`.
- **Verdict**: REJECTED (not valid — different tools for different jobs)
- **Reasoning**: The two items are semantically different: `BonsaiArchiveMeta` is unchanged across instantiations and rightly re-exported by name; `BonsaiArchivePayload` must be instantiated at the `ResponseItem` generic parameter so a type alias is the correct idiom. Forcing them into the same style would either require a newtype wrapper (over-engineering) or erase the instantiation (loses type information).

---

### Deferred (explicitly permitted across iterations)

- `compact_remote.rs` handler wiring beyond the field propagation already done. Dev flagged; judge concurs — scope this alongside C1 in iteration 2 or 3.
- App-server surface. Plan's Phase 3 + Step 8 say "only if required"; not required for v1.

### Loop/Conflict Detection

**Previous Iterations**: 0 (iteration 1)
**Recurring Issues**: n/a
**Conflicts Detected**: n/a
**Assessment**: n/a — first iteration. No loop risk yet. Architecture direction (hybrid side crate + minimal core seam) is intact; iteration 2 is sequencing risk, not architectural risk.

---

### Recommendations

**Iteration 2 must-fix bundle (ordered by risk-reduction per LoC):**

1. **C1**: Wire at least one call site. Minimum: a `Session::apply_bonsai_prune(..)` path that consumes `PruneInstall` and calls `replace_compacted_history`; tool handlers registered in `core/src/tools/spec.rs`. Include an end-to-end test that drives prune through the session and observes the placeholder in the prompt history.
2. **C3** + **M2**: Land reconstruction coverage. Choose a stable anchor id strategy that does not depend on `ResponseItem::id`, persist it into the `BonsaiArchiveMeta`, and cover `RolloutItem::Compacted { .. bonsai_archive: Some(..) }` in `rollout_reconstruction_tests.rs`.
3. **C2**: Implement the orphan-tool-call detector and flip `malformed`. Add a test case.
4. **M4**: Switch `assert_eq!` to `debug_assert_eq!` (or remove the dual-slice API in favor of internal flag computation).
5. **M1**: Include `ResponseItem::Reasoning` text in `extract_text`.
6. **H2**: Report all three pre-existing hooks failures accurately in the iteration-2 dev report.

**Iteration 3 should-fix bundle (if not pulled forward):**

- **H1**: Hook wiring for guidance (`session_start`) and gauge (`user_prompt_submit`). This becomes CRITICAL if still absent at iteration 3.

**Rejected (do NOT address):** M3, M5, L1, L2. H3 stands down as long as C1 lands in iteration 2; if C1 slips, H3 re-opens.

---

### Complexity Guard Notes

Items rejected specifically to prevent over-engineering or scope creep:

- **H3's crate-extraction suggestion**: Solving C1 (wiring call sites) deletes the dead-code smell. Adding a fourth crate just to house a 300-line wrapper that adapts `ResponseItem` into the side crate is over-engineering. If C1 persists across iterations, revisit.
- **M3 (placeholder sentinel variant)**: A dedicated `ResponseItem` variant or metadata tag for placeholders is a protocol change with large blast radius to prevent a collision that requires the attacker to guess two host-generated message ids. Not justifiable.
- **M5 (edition 2021)**: The side crate must match the agent workspace's edition to avoid macro-hygiene drift. The STANDARDS.md wording is the stale artifact, not the Cargo.toml.
- **L1 (.agent_tmp gitignore)**: Harness hygiene, not story scope.
- **L2 (re-export style)**: The two items are semantically different; unifying the style destroys type information or adds a newtype wrapper for nothing.
