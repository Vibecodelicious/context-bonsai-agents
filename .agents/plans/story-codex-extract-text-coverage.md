# Story: Codex extract_text covers all model-visible ResponseItem variants

## Goal

Bring Codex's text projector into compliance with the cross-agent spec's Pattern Matching Contract bullet 1 (MUST, since commit `9f1ca61`). Today `extract_text` at `codex/codex-rs/core/src/context_bonsai.rs:100-153` emits empty string for 10 of 13 `ResponseItem` variants, and for the two tool-call variants it does cover (`FunctionCall`, `CustomToolCall`) it returns only the `arguments`/`input` JSON — the `name` field is dropped on the floor. Tool-call name and tool-call output are unsearchable.

Source issue: `.agents/issues/codex-issues.md` Issue CO1 (verified, evidence-backed).

## Dependencies

- **CO2 (`story-codex-prune-wrapper-filter.md`) should land in the same PR.** Today CO2 is independently valuable (the `arguments` JSON already self-poisons retries). After CO1 lands, the wrapper filter additionally covers the new `tool:context-bonsai-prune` name-text matches. Ordering: CO1 + CO2 together is cleanest; CO2 alone is a valid forward-only fix.

## User Model

### User Gamut
- Codex TUI users trying to prune by tool name (e.g. `from_pattern: "tool:shell"`)
- Codex users trying to prune by tool output (e.g. `from_pattern: substring(stdout)` for a previous shell call)
- Codex users running web search / image generation / local shell tasks

### User-Needs Gamut
- Tool name + arguments + output reachable by pattern
- Stable, deterministic projected text (independent of internal struct field ordering)
- 11 currently-empty variants get non-empty searchable representations where the model can see content
- Internal-only variants (`GhostSnapshot`, `Compaction`, `Other`) explicitly remain empty with a comment explaining why

### Ambiguities From User Model
- **Lifetime model:** today `MessageForMatching::text: &'a str` borrows from `ResponseItem`. New projection requires owned strings. Resolved: `build_prune_install` materializes a `Vec<String>` whose entries are then borrowed by the `MessageForMatching` slice. Side-crate struct stays unchanged.
- **Should `ImageGenerationCall.result` (base64) be included?** No — large, no value for matching. Include `revised_prompt` and `result.len()` only.

## Context References

- `codex/codex-rs/core/src/context_bonsai.rs:88-100` — `project_message_for_matching`.
- `codex/codex-rs/core/src/context_bonsai.rs:110-153` — `extract_text` entry and variant arms; `:142-151` is the empty-string catch-all.
- `codex/codex-rs/core/src/context_bonsai.rs:167-172` — `default_item_id`.
- `codex/codex-rs/core/src/context_bonsai.rs:217-240` — `stable_hashed_id` (calls `extract_text` at `:223` for content-hashed anchor ids; hash changes when projection grows).
- `codex/codex-rs/core/src/context_bonsai.rs:517` — `build_prune_install` (caller of `project_message_for_matching`; this is where the new owned `Vec<String>` is materialized).
- `codex/codex-rs/core/src/context_bonsai.rs:317-340` — existing `extract_text_returns_reasoning_content_for_matching` and `build_prune_install_matches_reasoning_content_in_patterns` (test references for new tests).
- `codex/codex-rs/core/src/context_bonsai.rs:373-460` — `function_call`/`function_call_output` test helpers + four `build_prune_install_*` tests. The args-substring patterns these use will continue to work post-fix because `arguments` remains in the projection (just newly wrapped).
- `codex/codex-rs/protocol/src/models.rs:447-600` — full `ResponseItem` enum definition (13 variants).
- `codex/codex-rs/protocol/src/models.rs:486-499` — `FunctionCall { name, arguments, .. }`.
- `codex/codex-rs/protocol/src/models.rs:517-522` — `FunctionCallOutput { call_id, output: FunctionCallOutputPayload }`.
- `codex/codex-rs/protocol/src/models.rs:523-534` — `CustomToolCall { name, input, .. }`.
- `codex/codex-rs/protocol/src/models.rs:1103` — `FunctionCallOutputPayload::body.to_text()` accessor.
- `codex_context_bonsai/src/guards.rs:21-41` — `MessageForMatching<'a>` struct definition (no change required).
- `codex_context_bonsai/tests/guards.rs:1-42` — side-crate test conventions.
- `opencode_context_bonsai_plugin/src/prune-pattern.ts:6-51` — conceptual model for stable serialization (Rust equivalent: `serde_json::to_string` over a `BTreeMap` is stable by default).
- `docs/context-bonsai-agent-spec.md` Pattern Matching Contract — spec authority.
- `docs/agent-specs/codex-context-bonsai-spec.md` — Codex's mirror of the rule.

## Acceptance Criteria

- [ ] `build_prune_install` (the caller of `project_message_for_matching` in `context_bonsai.rs`) materializes an owned `Vec<String>` of projected text, one entry per `ResponseItem`. The `MessageForMatching` slice borrows from this vec via `&projected[i]`.
- [ ] `extract_text` keeps its name; signature changes from `fn(&ResponseItem) -> &str` to `fn(&ResponseItem) -> String`. Per-variant representations:
  - `Message`: unchanged behavior — content-text concatenation.
  - `Reasoning`: unchanged.
  - `FunctionCall { name, arguments, namespace, .. }`: `format!("tool:{name}\n{namespace_line}input:{arguments}")` where `namespace_line` is `format!("namespace:{ns}\n")` if `Some` else empty.
  - `FunctionCallOutput { call_id, output }`: `format!("tool_output:{call_id}\noutput:{}", output.body.to_text().unwrap_or_default())` (verify `body` accessor against `models.rs:1103`; if the field has a different name the implementer adjusts).
  - `CustomToolCall { name, input, .. }`: `format!("custom_tool:{name}\ninput:{input}")`.
  - `CustomToolCallOutput { call_id, name, output }`: `format!("custom_tool_output:{}\noutput:{}", name.as_deref().unwrap_or(""), output.body.to_text().unwrap_or_default())`.
  - `ToolSearchCall { execution, arguments, .. }`: `format!("tool_search:{execution}\narguments:{}", serde_json::to_string(arguments).unwrap_or_default())`.
  - `ToolSearchOutput { execution, status, tools, .. }`: `format!("tool_search_output:{execution}\nstatus:{status}\ntools:{}", serde_json::to_string(tools).unwrap_or_default())`.
  - `LocalShellCall { action: LocalShellAction::Exec(LocalShellExecAction { command, working_directory, .. }), .. }`: `format!("shell:{}\ncwd:{}", command.join(" "), working_directory.as_deref().unwrap_or(""))`.
  - `WebSearchCall { action }`: project per inner `WebSearchAction` variant (note: `query`, `queries`, `url`, `pattern` are all `Option`-wrapped):
    - `Some(WebSearchAction::Search { query, queries })` → `format!("web_search:{}\nqueries:{}", query.clone().unwrap_or_default(), queries.as_deref().map(|q| q.join("|")).unwrap_or_default())`.
    - `Some(WebSearchAction::OpenPage { url })` → `format!("web_open:{}", url.clone().unwrap_or_default())`.
    - `Some(WebSearchAction::FindInPage { url, pattern })` → `format!("web_find:{}\npattern:{}", url.clone().unwrap_or_default(), pattern.clone().unwrap_or_default())`.
    - `Some(WebSearchAction::Other)` → empty string.
    - `None` → empty string.
  - `ImageGenerationCall { revised_prompt, result, .. }`: `format!("image_generation:{}\nresult_len:{}", revised_prompt.as_deref().unwrap_or(""), result.len())`. Do NOT include the raw `result` body.
  - `GhostSnapshot`, `Compaction`: empty string. Include a `// not model-visible: <reason>` comment.
  - `Other`: empty string. Comment: `// unknown variant via #[serde(other)]: nothing to project`.
- [ ] New tests in `codex/codex-rs/core/src/context_bonsai_tests.rs`:
  - `extract_text_includes_function_call_name_and_arguments`: `FunctionCall { name: "context-bonsai-prune", arguments: "{\"from_pattern\":\"X\"}" }` projects to text containing both `context-bonsai-prune` AND `from_pattern`.
  - `extract_text_includes_function_call_output_body`: `FunctionCallOutput` whose `body = Text("compilation succeeded")` projects to text containing `compilation succeeded`.
  - One non-empty test per remaining variant (`CustomToolCall`, `CustomToolCallOutput`, `ToolSearchCall`, `ToolSearchOutput`, `LocalShellCall`, `WebSearchCall::Search`, `ImageGenerationCall`).
  - `extract_text_empty_for_internal_variants`: `GhostSnapshot`, `Compaction`, `Other` project to `""`.
  - `build_prune_install_matches_by_tool_name`: end-to-end with `FunctionCall { name: "shell", arguments: "{}" }`, `from_pattern: "tool:shell"` resolves successfully.
  - `build_prune_install_matches_by_tool_output_body`: end-to-end with `FunctionCallOutput` body containing `"entries"`, `to_pattern: "entries"` resolves successfully.
- [ ] New tests in `codex_context_bonsai/tests/guards.rs`: a `MessageForMatching` whose `text` contains both `tool:context-bonsai-prune` and `from_pattern:"older"` resolves uniquely on either substring.
- [ ] Existing tests unchanged: `function_call`/`function_call_output` helpers and four `build_prune_install_*` tests around `:393-460` use args-substring patterns like `r#""cmd":"ls""#` — these still pass because `arguments` remains in the projection (now wrapped in `tool:shell\ninput:{...}`).
- [ ] Hashed anchor ids (`default_item_id` / `stable_hashed_id`) change for variants whose projection grew. Update any test that hard-codes a specific `bonsai-anchor-XXXX` hex value. Use `grep -rn "bonsai-anchor-[0-9a-f]" codex/codex-rs/core/src codex_context_bonsai/tests` to surface them.
- [ ] `cargo test -p codex-core context_bonsai` passes.
- [ ] `cargo clippy -p codex-core --tests -- -D warnings` passes.
- [ ] `cargo test -p codex-context-bonsai` passes (side crate).
- [ ] `cargo clippy -p codex-context-bonsai --all-targets -- -D warnings` passes.

## Implementation Tasks

1. Read the full `ResponseItem` enum at `codex/codex-rs/protocol/src/models.rs:447-600`. Confirm field names and `Option`-wrapping for every variant the projection touches (especially `WebSearchAction` variants).
2. Modify `extract_text` (`context_bonsai.rs:110-153`) to return `String`. Keep the function name; only the signature and arms change. Return owned strings per the per-variant table in ACs.
3. Update `build_prune_install` (`context_bonsai.rs:517`) to materialize a `Vec<String>` first via `history.iter().map(extract_text).collect()`, then build `MessageForMatching` slices that borrow from it (`text: &projected[i]`). Ensure the borrow lifetime survives both the `compute_malformed_flags` pass and the `resolve_pattern`/`validate_range` chain. Two-phase construction.
4. Update `stable_hashed_id` (`:223`) to use the new owned `String` from `extract_text`. Behavior is otherwise unchanged (hash-based).
5. Add the projector tests + end-to-end tests listed in ACs to `context_bonsai_tests.rs`.
6. Add the side-crate resolver test in `codex_context_bonsai/tests/guards.rs`.
7. Run `grep -rn "bonsai-anchor-[0-9a-f]" codex/codex-rs/core/src codex_context_bonsai/tests` to surface any pinned hashed-id expectations and update them.
8. Run all four validation commands.

## Testing Strategy

Side-crate `cargo test` covers resolver-shape logic (input must contain projected substrings to match). Agent-repo `cargo test -p codex-core context_bonsai` covers the projector (real `ResponseItem` variants → projected text). End-to-end `build_prune_install_*` tests cover the pattern → range chain.

## Validation Commands

- `cd /home/basil/projects/context-bonsai-agents/codex_context_bonsai && cargo test`
- `cd /home/basil/projects/context-bonsai-agents/codex_context_bonsai && cargo clippy --all-targets -- -D warnings`
- `cd /home/basil/projects/context-bonsai-agents/codex/codex-rs && cargo test -p codex-core context_bonsai`
- `cd /home/basil/projects/context-bonsai-agents/codex/codex-rs && cargo clippy -p codex-core --tests -- -D warnings`

## Worktree Artifact Check

- Checked At: 2026-04-25
- Planned Target Files:
  - `codex/codex-rs/core/src/context_bonsai.rs`
  - `codex/codex-rs/core/src/context_bonsai_tests.rs`
  - `codex_context_bonsai/tests/guards.rs`
  - Possibly other test files where `bonsai-anchor-` literals are pinned (TBD by grep)
- Overlaps Found (path + class): none. Both `codex/` and `codex_context_bonsai/` clean per `git status --short`.
- Escalation Status: none
- Decision Citation: n/a

## Plan Approval and Commit Status

- Approval Status: llm-agent-approved
- Approval Citation: validation loop iteration 2 cleared all findings (added `:517` build_prune_install pointer; corrected `WebSearchAction` Option-wrapping for all variants including `Other`; dropped `extract_text` rename; corrected `Other` variant comment; tightened file:line citations).
- Plan Commit Hash: pending-next-commit
- Ready-for-Orchestration: yes (after this plan is committed and the Plan Commit Hash field is updated)

## Validation Loop Results

- Missing details check: pass (iteration 2). Iter-1 findings: (1) `:100` corrected to `:110` for `extract_text` entry; (2) `default_item_id` location separated to `:167-172`; (3) `build_prune_install` location pinned to `:517`; (4) `WebSearchAction::Search.queries` is `Option<Vec<String>>` not `Vec<String>` — corrected; (5) `WebSearchAction::OpenPage.url` and `FindInPage.url`/`pattern` Option-wrapped — corrected; (6) `WebSearchAction::Other` arm added explicitly.
- Ambiguity check: pass (iteration 2). Iter-1 findings: (1) `extract_text` rename dropped — keep name, change signature only; (2) `Other` variant comment corrected to "unknown variant via #[serde(other)]"; (3) two-phase borrow strategy confirmed feasible.
- Worktree artifact risk check: pass. Both submodules clean.
- Plan-commit status check: pending until commit.
- Iterations run: 2
