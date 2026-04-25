## Judge's Assessment

**Story**: Codex CO1 — extract_text covers all model-visible ResponseItem variants
**Iteration**: 1 of 5 maximum
**Date**: 2026-04-25

---

### Summary

| Verdict | Count |
|---------|-------|
| APPROVED (must fix) | 0 |
| APPROVED (should fix) | 0 |
| REJECTED (over-engineering) | 0 |
| REJECTED (out of scope) | 2 |
| REJECTED (not valid) | 0 |

### Verified Validation Results

This subsection is the **sole** location for the judge's validation verdict. Do not repeat a regression-gate verdict elsewhere in the report.

- **Starting commit:** side `dc7bfdb4f`, agent `78af9df23` (reviewer-verified; judge re-verified with `git show`)
- **Pre-existing failures (reviewer-reproduced):** none
- **HEAD results (judge-rerun):**
  - `cd codex_context_bonsai && cargo test`: 5/5 passed across 3 integration test binaries (`archive 2/2`, `gauge 3/3`, `guards 3/3`) plus colocated unit tests
  - `cd codex_context_bonsai && cargo clippy --all-targets -- -D warnings`: clean
  - `cd codex/codex-rs && cargo test -p codex-core context_bonsai`: 31/31 passed (including all 6 required new tests + the two end-to-end matchers)
  - `cd codex/codex-rs && cargo clippy -p codex-core --tests -- -D warnings`: clean
- **Regressions:** none
- **Regression gate:** clear

---

### Overall Verdict

**APPROVED AS-IS**

Reviewer scored 0 CRITICAL / 0 HIGH / 1 MEDIUM / 1 LOW with all 15 acceptance criteria verified as landed. I re-verified the key claims via `git show 78af9df23` and `git show dc7bfdb`:

- `extract_text` signature is now `fn(&ResponseItem) -> String` with per-variant projections matching the plan exactly (FunctionCall with `tool:{name}\n[namespace:{ns}\n]input:{arguments}`, FunctionCallOutput with `tool_output:{call_id}\noutput:{body}`, parallel CustomToolCall(Output) shapes, ToolSearchCall, ToolSearchOutput, LocalShellCall::Exec, all four WebSearchAction sub-arms with Option-wrapping, ImageGenerationCall with `result_len:N` and no raw base64).
- `build_prune_install` materializes `Vec<String>` once at line 655 (`let projected_text: Vec<String> = history.iter().map(extract_text).collect();`) and lends entries via `text.as_str()` in both projection passes (lines 663 and 682). Borrow lifetime survives both `compute_malformed_flags` and `resolve_pattern` / `validate_range`.
- All six required new projector tests are present (`extract_text_includes_function_call_name_and_arguments`, `..._function_call_output_body`, `..._custom_tool_call_name_and_input`, `..._custom_tool_call_output_name_and_body`, `..._tool_search_call_execution_and_arguments`, `..._tool_search_output_status_and_tools`, `..._local_shell_call_command_and_cwd`, `..._web_search_call_query`, `..._image_generation_revised_prompt_and_result_len`, `extract_text_empty_for_internal_variants`).
- Both end-to-end tests landed (`build_prune_install_matches_by_tool_name`, `build_prune_install_matches_by_tool_output_body`).
- The side-crate resolver substring test (`public_api_resolves_unique_match_on_tool_call_projection_substrings`) verifies tool-name AND args-substring matching against the post-CO1 projection shape.

Both findings are properly disposed: M1 is the deliberate forward seam for CO2 (which the next story explicitly requires), and L1 matches the plan verbatim.

---

### Finding-by-Finding Evaluation

#### [M1] `_item` parameter on `project_message_for_matching` is dead weight today

- **Reviewer's Issue**: After the refactor, `project_message_for_matching` no longer reads `&ResponseItem` — text is passed directly. The `_item` rename suppresses the unused-var lint, and both call sites at `:667` and `:686` thread `item` for nothing. Reviewer suggested either dropping the parameter or keeping it as a forward seam for CO2.
- **Verdict**: REJECTED (out of scope)
- **Reasoning**:
  1. **CO2 needs `&item` here.** I read `story-codex-prune-wrapper-filter.md` Implementation Tasks 4 and AC line 67 verbatim: *"`project_message_for_matching` (`codex/codex-rs/core/src/context_bonsai.rs:88-100`) populates `is_prune_wrapper: is_prune_wrapper_response_item(item)` inline for every projected row (cleaner than a 5th param since the projector already receives `item`)."* Removing `_item` now would force CO2 to add it back along with both call sites at `:667` and `:686`.
  2. **The plan-approved coupling is explicit.** The CO1 story (Dependencies, line 11) and the CO1↔CO2 coupling note in `codex-issues.md:58-81` both say "Land CO1 + CO2 in the same change set." The orchestration intent is that CO1 leaves a one-line seam for CO2 to fill, not that CO1 ships a stable internal API in isolation.
  3. **Cost/benefit lean toward keep.** Cost of keeping `_item` today: a single underscore-prefixed parameter and two compile-time-elided arguments at the call sites (zero runtime cost; clippy passes). Cost of dropping it now: CO2 reintroduces it, the diff between iterations grows by two extra renames at every call site, and the CO1+CO2 PR review becomes harder to read.
  4. **The "PR reviewers will object" con-side argument is weak when the next story is already drafted and queued.** The PR description for the combined CO1+CO2 PR will explain the seam in one line. If CO2 were speculative or far-off, the calculus would flip.
  5. Per Review Judge framework: this is a MEDIUM that requests work which would actively be reverted by the next story. That maps cleanly to "Future enhancement item (document for later)" — except here "later" means "the next commit in this PR series."
- **If Rejected**: Document for the CO1+CO2 PR description: the `_item` underscore is intentional dead-weight for one commit's lifetime, removed implicitly when CO2 begins reading `item` for `is_prune_wrapper_response_item(item)`.

#### [L1] `CustomToolCallOutput` discards `call_id`

- **Reviewer's Issue**: `FunctionCallOutput` projection includes `call_id`; `CustomToolCallOutput` destructures `call_id: _` and projects only `name`+`output`. Asymmetry means correlating a custom-tool output back to its call by `call_id` substring is impossible.
- **Verdict**: REJECTED (out of scope)
- **Reasoning**:
  1. The plan AC at line 59 specifies the projection literally as `format!("custom_tool_output:{}\noutput:{}", name.as_deref().unwrap_or(""), output.body.to_text().unwrap_or_default())` — `call_id` is intentionally not in the format string. Reviewer themselves notes "this MATCHES the plan."
  2. The asymmetry observation is real (FunctionCallOutput uses `call_id` for the leading line; CustomToolCallOutput uses `name`) but is a deliberate plan choice: custom tools carry a human-readable `name` that is more useful for matching than an opaque `call_id`. Adding `call_id` would be a "while we're here" plan deviation.
  3. Per Review Judge framework: LOW findings that match the plan are documented and left.
- **If Rejected**: No follow-up needed. If a future user ever wants to correlate a custom-tool output back to its call by `call_id`, that would be a new spec/plan revision, not a CO1 fix.

---

### Loop/Conflict Detection

**Previous Iterations**: 0 (this is iteration 1)
**Recurring Issues**: none
**Conflicts Detected**: none
**Assessment**: First iteration, clean approval path. Reviewer's findings are well-targeted; both are correctly identified as plan-aligned non-blockers.

---

### Recommendations

**APPROVED AS-IS:**

The implementation meets all 15 acceptance criteria. Validation is green at HEAD on both repos with no regressions. The MEDIUM finding documents a deliberate forward seam for the immediately-following CO2 story; the LOW finding matches the plan verbatim. CO1 is ready to land alongside CO2 in the combined PR per the plan's Dependencies section.

---

### Complexity Guard Notes

- Rejected the M1 suggestion to drop `_item` from `project_message_for_matching`. The next story (CO2 `story-codex-prune-wrapper-filter.md`) explicitly requires `&item` to populate `is_prune_wrapper: is_prune_wrapper_response_item(item)` inline (CO2 AC line 67). Removing it now creates churn that CO2 must immediately revert.
- Rejected the L1 suggestion to add `call_id` to `CustomToolCallOutput` projection. The plan deliberately uses `name` (human-readable) instead of `call_id` (opaque) for custom-tool output projections. Plan-authoritative.
