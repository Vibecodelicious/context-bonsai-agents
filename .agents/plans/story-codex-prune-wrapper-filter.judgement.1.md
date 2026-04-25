## Judge's Assessment

**Story**: CO2 - Codex prune-wrapper filter on the ambiguity path
**Iteration**: 1 of 5 maximum
**Date**: 2026-04-25

---

### Summary

| Verdict | Count |
|---------|-------|
| APPROVED (must fix) | 0 |
| APPROVED (should fix) | 0 |
| REJECTED (over-engineering) | 0 |
| REJECTED (out of scope) | 0 |
| REJECTED (not valid) | 0 |

The reviewer reported 0/0/0/0 with an APPROVE recommendation. No findings required adjudication. Judge independently verified the implementation against acceptance criteria and ran all four validation commands at HEAD.

### Verified Validation Results

- **Starting commit:** side `codex_context_bonsai@50698c274`, agent `codex@5a680bcb3` (reviewer-verified)
- **Pre-existing failures (reviewer-reproduced):** none
- **HEAD results:** 4/4 validation commands pass
  - `cargo test -p codex-context-bonsai`: side-crate suite green; tests/guards.rs runs 7 tests including the four new prune-wrapper outcome cases (filter→1, filter→0, filter→>1, single-match-untouched), all pass
  - `cargo clippy -p codex-context-bonsai --all-targets -- -D warnings`: clean
  - `cargo test -p codex-core context_bonsai`: 38 tests pass (filtered context_bonsai subset), including the 5 new predicate unit tests and 2 new end-to-end `build_prune_install_filters_*_prune_wrapper_on_ambiguous_retry` tests
  - `cargo clippy -p codex-core --tests -- -D warnings`: clean
- **Regressions:** none
- **Regression gate:** clear

---

### Overall Verdict

**APPROVED AS-IS**

The implementation matches the plan exactly. The side crate stays host-neutral (no `codex_protocol` dependency added; the predicate `is_prune_wrapper_response_item` lives in `codex/codex-rs/core/src/context_bonsai.rs` as planned). The filter is inserted in `resolve_pattern` precisely where specified — before the `match matches.len()` block — and only collapses multi-match into singleton when filtering yields exactly one survivor. The `Ambiguous { count }` reports the original (unfiltered) count for both filter→0 and filter→>1 paths, verified via the two count-preservation tests asserting `count: 2` and `count: 3` respectively.

All 11 acceptance criteria are landed:

1. `MessageForMatching<'a>` gained `pub is_prune_wrapper: bool` (lifetime unchanged) — verified at `codex_context_bonsai/src/guards.rs:42-50`.
2. All 7 in-tree literal sites updated (3 in `src/guards_tests.rs`, 2 in `tests/guards.rs` helpers, 1 in agent-repo `project_message_for_matching`, plus the new wrapper helper). The `plain` test helper at `tests/guards.rs:13` and the `msg` helper at `guards_tests.rs:4` initialize `is_prune_wrapper: false`.
3. Predicate `is_prune_wrapper_response_item` added to agent repo at `codex/codex-rs/core/src/context_bonsai.rs:96-101`; imports `PRUNE_TOOL_NAME` from the side crate.
4. Predicate matches both `FunctionCall` and `CustomToolCall` against `PRUNE_TOOL_NAME`.
5. Filter inserted at `codex_context_bonsai/src/guards.rs:141-159` before `match matches.len()`. Replaces `matches` only when `non_wrappers.len() == 1`.
6. Original count preserved on filter→0 (test asserts `count: 2`) and filter→>1 (test asserts `count: 3`).
7. Single-match path untouched — gated on `matches.len() > 1`.
8. CO1's `_item` parameter renamed to `item` correctly in this commit; both call sites in `build_prune_install` propagate the flag via the projector.
9. Predicate unit tests cover both call shapes (true), other names (false), and four non-call variants (`Message`, `Reasoning`, `FunctionCallOutput`, `Other`) all false.
10. End-to-end tests (`build_prune_install_filters_function_call_prune_wrapper_on_ambiguous_retry` and `build_prune_install_filters_custom_tool_call_prune_wrapper_on_ambiguous_retry`) assert structural evidence that the archive starts at a real user `Message`, not the wrapper `FunctionCall`/`CustomToolCall`.
11. Both clippy gates clean.

Adversarial probes considered: clone cost on the rare ambiguity path is acceptable; all-wrappers fall-through correctly preserves the original ambiguity count; no-wrappers fast-path is a no-op; mixed 1+1 (1 wrapper + 1 real) collapses to the real match; single-match-wrapper bypasses the filter; no scope creep beyond the four ACs. The end-to-end tests verify structural evidence (variant tag check) rather than relying on string matching, which is the right discriminator.

---

### Finding-by-Finding Evaluation

No findings — reviewer reported 0/0/0/0.

---

### Loop/Conflict Detection

**Previous Iterations**: 0 (first iteration)
**Recurring Issues**: none
**Conflicts Detected**: none
**Assessment**: Clean first-pass landing. Plan was thoroughly validated (2 planning iterations) before implementation, which paid off here.

---

### Recommendations

**APPROVED AS-IS:** The implementation meets all acceptance criteria. Both Codex stories (CO1 and CO2) close. The orchestrator may now pin the Codex submodules and proceed with downstream work (Gemini).

---

### Complexity Guard Notes

Nothing rejected — the reviewer surfaced no findings to filter. The implementation chose the simpler of two valid options (predicate inlined in projector vs. 5th parameter) and kept the side crate host-neutral, which avoids an unnecessary `codex_protocol` dependency. Both choices align with the project's "minimal impact, no over-engineering" stance.
