# Story: Codex prune-wrapper filter on the ambiguity path

## Goal

Implement the cross-agent spec's prune-wrapper filter (commit `cb61f00`, MUST) for the Codex port. When `resolve_pattern` finds multiple matches on the ambiguity path, it MUST exclude messages whose canonical content is a prior `context-bonsai-prune` tool-use wrapper before returning the existing `GuardError::Ambiguous` error.

**This is the only port where the bug exists in production today** (the `FunctionCall.arguments` JSON is already in `MessageForMatching.text` — see `context_bonsai.rs:121`). Failed-prune `from_pattern`/`to_pattern`/`summary` text already collides with retry patterns. CO2 is independently valuable today; once CO1 lands and adds tool name to projection, CO2 also covers `tool:context-bonsai-prune` name-text collisions.

Source issue: `.agents/issues/codex-issues.md` Issue CO2 (verified, evidence-backed).

## Dependencies

- **Should land with CO1 (`story-codex-extract-text-coverage.md`).** CO1 + CO2 in one PR is cleanest. CO2 alone is a valid forward-only fix that closes the active bug; CO1 alone re-poisons retries via `tool:context-bonsai-prune` name-text matches without CO2's mitigation.

## User Model

### User Gamut
- Codex TUI users who hit `GuardError::Ambiguous` on the first prune attempt and retry with a refined pattern (active production bug)
- Maintainers reviewing the filter design against the OpenCode reference

### User-Needs Gamut
- Retry stability after first-attempt ambiguity (active fix today)
- No regression in single-match (`matches.len() == 1`) or zero-match paths
- Symmetric coverage of both `FunctionCall` and `CustomToolCall` variants — Codex routes MCP-bridged tools through both depending on the registry path

### Ambiguities From User Model
- **Where to detect wrapper-ness:** in the resolver (would need raw `ResponseItem`) OR via a flag on `MessageForMatching`. Resolved: flag on `MessageForMatching`. Keeps the side crate's `resolve_pattern` shape-agnostic and avoids cross-crate coupling.
- **Which tool name(s) to match:** Kilo, Cline are native (no MCP prefix). For Codex, the in-tree handler exposes only `PRUNE_TOOL_NAME = "context-bonsai-prune"` as a native name — no MCP-prefix path is in tree. Resolved: filter on `"context-bonsai-prune"` only. Both `FunctionCall` and `CustomToolCall` variants checked.

## Context References

- `codex_context_bonsai/src/guards.rs:21-41` — `MessageForMatching<'a>` struct (4 fields today; one new bool field added).
- `codex_context_bonsai/src/guards.rs:108-139` — `resolve_pattern` body. Ambiguity branch is the single line `count => Err(GuardError::Ambiguous { which, count })` at `:137`. Filter must be inserted BEFORE the `match matches.len()` block.
- `codex_context_bonsai/src/lib.rs:41` — `pub const PRUNE_TOOL_NAME: &str = "context-bonsai-prune";` (already exported).
- `codex/codex-rs/core/src/context_bonsai.rs:88-100` — `project_message_for_matching` (signature changes to populate the new flag).
- `codex/codex-rs/core/src/context_bonsai.rs:517` — `build_prune_install` (calls `project_message_for_matching` at two sites).
- `codex/codex-rs/core/src/tools/handlers/context_bonsai.rs:1,66,87` — confirms `PRUNE_TOOL_NAME` is the literal `name` string used for both `FunctionCall` and `CustomToolCall` dispatch.
- `codex/codex-rs/protocol/src/models.rs:486-499` — `FunctionCall { name, arguments, .. }`.
- `codex/codex-rs/protocol/src/models.rs:523-534` — `CustomToolCall { name, input, .. }`.
- `codex_context_bonsai/tests/guards.rs:1-42` — side-crate test conventions; `plain` test helper at `:8-15`.
- `opencode_context_bonsai_plugin/src/prune-pattern.ts:85-107` — reference filter behavior on ambiguity branch only.
- `docs/context-bonsai-agent-spec.md` Pattern Matching Contract — spec authority.
- `docs/agent-specs/codex-context-bonsai-spec.md` — Codex's mirror.

## Acceptance Criteria

- [ ] `MessageForMatching<'a>` (`codex_context_bonsai/src/guards.rs:21-41`) gains `pub is_prune_wrapper: bool` (plain bool; lifetime `'a` unchanged).
- [ ] All in-tree constructors of `MessageForMatching` (including the `plain` test helper at `tests/guards.rs:8-15`) are updated to set `is_prune_wrapper: false` by default.
- [ ] A new predicate `fn is_prune_wrapper_response_item(item: &ResponseItem) -> bool` is added to `codex/codex-rs/core/src/context_bonsai.rs` (the agent repo, NOT the side crate — the side crate is intentionally host-neutral and does not depend on `codex_protocol`; verified via `codex_context_bonsai/src/archive.rs:9-12` + `src/lib.rs:9-12` design comments). Imports `PRUNE_TOOL_NAME` from `codex_context_bonsai`. Returns true iff:
  - `ResponseItem::FunctionCall { name, .. }` AND `name == PRUNE_TOOL_NAME`, OR
  - `ResponseItem::CustomToolCall { name, .. }` AND `name == PRUNE_TOOL_NAME`.
  Returns false for all other variants.
- [ ] `resolve_pattern` (`codex_context_bonsai/src/guards.rs:108-139`) gets a filter step inserted BEFORE the `match matches.len()` block (i.e. between `:130` and `:131`):
  ```rust
  if matches.len() > 1 {
      let non_wrappers: Vec<_> = matches.iter()
          .filter(|m| !messages[m.index].is_prune_wrapper)
          .cloned()
          .collect();
      if non_wrappers.len() == 1 {
          matches = non_wrappers;
      }
      // else: leave `matches` unchanged so the existing match.len() arm reports the original count
  }
  ```
  This preserves `NoMatch`/single-success/`Ambiguous` semantics for non-pathological cases. The `Ambiguous { count }` reports the unfiltered count when filter→0 or filter→>1.
- [ ] `project_message_for_matching` (`codex/codex-rs/core/src/context_bonsai.rs:88-100`) populates `is_prune_wrapper: is_prune_wrapper_response_item(item)` inline for every projected row (cleaner than a 5th param since the projector already receives `item`). Both call sites in `build_prune_install` propagate the flag.
- [ ] Side-crate tests in `codex_context_bonsai/tests/guards.rs`:
  1. **filter→1**: two matches, one wrapper + one real → returns the real match.
  2. **filter→0**: two matches, both wrappers → still `Ambiguous { count: 2 }` (filter must not over-collapse).
  3. **filter→>1**: three matches, two non-wrappers + one wrapper → still `Ambiguous { count: 3 }` (count unchanged).
  4. **single-match-untouched**: one match (a wrapper) → returns it (single-match path is not filtered).
- [ ] Predicate unit tests in `codex/codex-rs/core/src/context_bonsai_tests.rs` (the predicate lives in the agent repo): `FunctionCall` with `name == "context-bonsai-prune"` (true); `CustomToolCall` with same name (true); `FunctionCall` with another name (false); non-call variants (`Message`, `Reasoning`, `FunctionCallOutput`, etc.) all false.
- [ ] Agent-repo tests in `codex/codex-rs/core/src/context_bonsai_tests.rs`: end-to-end `build_prune_install` test where a prior failed `FunctionCall { name: "context-bonsai-prune", arguments: <JSON containing "older"> }` is in history and a real user message also contains the substring `"older"`; assert the real message wins. Same scenario for `CustomToolCall`.
- [ ] `cargo test -p codex-core context_bonsai` passes.
- [ ] `cargo clippy -p codex-core --tests -- -D warnings` passes.
- [ ] `cargo test -p codex-context-bonsai` passes.
- [ ] `cargo clippy -p codex-context-bonsai --all-targets -- -D warnings` passes.

## Implementation Tasks

1. Add `pub is_prune_wrapper: bool` to `MessageForMatching<'a>` at `codex_context_bonsai/src/guards.rs:21-41`. Update the `plain` helper at `tests/guards.rs:8-15` and any in-tree construction sites to initialize the field.
2. Add `is_prune_wrapper_response_item(item: &ResponseItem) -> bool` to `codex/codex-rs/core/src/context_bonsai.rs` (agent repo). Import `PRUNE_TOOL_NAME` from `codex_context_bonsai`. The side crate stays host-neutral.
3. Modify `resolve_pattern` (`guards.rs:108-139`): insert the filter step before the `match matches.len()` block as shown in ACs. The `Match` type at `guards.rs:44` already derives `Clone`, so `.cloned()` compiles.
4. Update `project_message_for_matching` (`codex/codex-rs/core/src/context_bonsai.rs:88-100`) to populate the flag inline via the new predicate. Both call sites in `build_prune_install` (`:517`) propagate.
5. Add the four resolver outcome tests to `codex_context_bonsai/tests/guards.rs`.
6. Add predicate tests + the end-to-end `build_prune_install` tests (covering both `FunctionCall` and `CustomToolCall` wrapper paths) to `codex/codex-rs/core/src/context_bonsai_tests.rs`.
7. Run all four validation commands.

## Testing Strategy

Side-crate `cargo test` for resolver outcomes + predicate. Agent-repo `cargo test -p codex-core context_bonsai` for end-to-end `build_prune_install` proving the wrapper filter prevents real-bug retry collisions.

## Validation Commands

- `cd /home/basil/projects/context-bonsai-agents/codex_context_bonsai && cargo test`
- `cd /home/basil/projects/context-bonsai-agents/codex_context_bonsai && cargo clippy --all-targets -- -D warnings`
- `cd /home/basil/projects/context-bonsai-agents/codex/codex-rs && cargo test -p codex-core context_bonsai`
- `cd /home/basil/projects/context-bonsai-agents/codex/codex-rs && cargo clippy -p codex-core --tests -- -D warnings`

## Worktree Artifact Check

- Checked At: 2026-04-25
- Planned Target Files:
  - `codex_context_bonsai/src/guards.rs` (add `is_prune_wrapper` field + filter)
  - `codex_context_bonsai/tests/guards.rs` (resolver outcome tests + helper update)
  - `codex/codex-rs/core/src/context_bonsai.rs` (predicate + projector populator)
  - `codex/codex-rs/core/src/context_bonsai_tests.rs` (predicate tests + end-to-end tests)
  - No `Cargo.toml` changes — predicate lives in agent repo, side crate stays host-neutral.
- Overlaps Found (path + class): none. Both `codex/` and `codex_context_bonsai/` clean. CO1 also touches `context_bonsai.rs` and `guards.rs` — the regions are disjoint (CO1 modifies `extract_text` body; CO2 modifies struct field + resolver ambiguity branch + projector flag population) so landing CO1 + CO2 in one PR is safe and recommended.
- Escalation Status: none
- Decision Citation: n/a

## Plan Approval and Commit Status

- Approval Status: llm-agent-approved
- Approval Citation: validation loop iteration 2 cleared all findings (predicate location locked to agent repo because side crate is intentionally host-neutral per `archive.rs:9-12` design; `Match` is `Clone` confirmed; `is_prune_wrapper` field-name collision-free; projector populator inlined).
- Plan Commit Hash: b243a03
- Ready-for-Orchestration: yes

## Validation Loop Results

- Missing details check: pass (iteration 2). Iter-1 findings: (1) side crate has no `codex_protocol` dep and is intentionally host-neutral — predicate moved to agent repo; (2) `Match` derives `Clone`, `.cloned()` compiles; (3) borrow shape verified; (4) field-name collision-free.
- Ambiguity check: pass (iteration 2). Iter-1 findings: (1) predicate location locked (no preferred/fallback); (2) projector populator inlined; (3) test file location split per code location.
- Worktree artifact risk check: pass. Both submodules clean.
- Plan-commit status check: pending until commit.
- Iterations run: 2
