# Story: Codex prune-wrapper filter

> **Revisions required (2026-04-25).** Spec changed after this draft was written: commits `cb61f00` (prune-wrapper filter clause), `4d87eb9` (per-agent mirror), and `9f1ca61` (Pattern Matching Contract bullet 1 SHOULD → MUST on tool-call name/input/output). Codex `extract_text` covers `FunctionCall.arguments` and `CustomToolCall.input` but emits empty string for 11 of 13 `ResponseItem` variants and never extracts `FunctionCall.name` or any output. Story scope must expand to include the broader extraction remediation; the wrapper-filter alone closes only the self-poisoning bug, not the spec violation. Rescope before orchestration.

**Epic:** Context Bonsai Prune-Wrapper Filter
**Size:** Small
**Dependencies:** None

## Story Description

Implement the cross-agent spec's prune-wrapper filter rule for the Codex port. When `resolve_pattern` finds multiple candidates on the ambiguity path, it MUST exclude messages whose canonical content is a prior `context-bonsai-prune` tool-use wrapper before returning the existing `GuardError::Ambiguous` error.

The side crate (`codex_context_bonsai`) adds an `is_prune_wrapper: bool` field to `MessageForMatching` and a `ResponseItem`-shaped predicate helper. The agent repo (`codex`) updates `project_message_for_matching` in `core/src/context_bonsai.rs` to populate the flag using the helper.

The poisoning channel for Codex specifically: `project_message_for_matching` puts `ResponseItem::FunctionCall { arguments }` text into `MessageForMatching.text`. A prior failed prune call's `FunctionCall` carries the original `from_pattern` / `to_pattern` / `summary` JSON in `arguments`, which then matches the retry pattern.

## User Model

### User Gamut
- Codex TUI users running long sessions who retry a prune after first-attempt ambiguity
- Users resuming stored threads where prior failed prune-call wrappers persist in rollout
- Maintainers reading the side-crate resolver as a reference for other ports

### User-Needs Gamut
- Retry stability after first-attempt ambiguity
- No silent boundary selection
- Flag survives rollout/resume because the projector re-derives it every time

### Design Implications
- The predicate identifies a `ResponseItem::FunctionCall` (and `CustomToolCall` if Codex's MCP layer surfaces tools that way) whose tool name equals `context-bonsai-prune` or `mcp__context-bonsai__context-bonsai-prune`.
- Adding the field with `#[serde(default)]` keeps it invisible at the protocol surface (the protocol's `CompactedItem` does not embed `MessageForMatching`; the field is purely an in-memory projection concern).

## Acceptance Criteria

- [ ] `codex_context_bonsai/src/guards.rs` `MessageForMatching` struct gains `pub is_prune_wrapper: bool` (no `#[serde]` attributes needed; struct is not serde-derived).
- [ ] `codex_context_bonsai` exports a public predicate `is_prune_wrapper_response_item(item: &ResponseItem) -> bool` (or equivalent name) that returns true iff the item is a tool-call whose name matches one of the two accepted prune-tool names. Both names listed explicitly in the function body.
- [ ] `resolve_pattern`'s ambiguity branch (`guards.rs:131-138`) filters wrappers BEFORE returning `GuardError::Ambiguous`. If exactly one non-wrapper match remains, return it; otherwise the existing `Ambiguous` error fires unchanged.
- [ ] `codex/codex-rs/core/src/context_bonsai.rs::project_message_for_matching` populates `is_prune_wrapper` for each projected row using the side-crate predicate. All other arms still set the field to `false`.
- [ ] Single-match path untouched.
- [ ] Zero-match path untouched.
- [ ] Tests in `codex_context_bonsai/tests/guards.rs` cover all four outcomes (filter-then-1, filter-then-0, filter-then-many, single-match-untouched) using the existing `plain` helper plus a new `prune_wrapper` helper.
- [ ] Predicate has dedicated tests (native name, MCP-prefixed name, non-prune `FunctionCall`, non-`FunctionCall` variant).
- [ ] At least one test in `codex/codex-rs/core/src/context_bonsai_tests.rs` covers `project_message_for_matching` populating the flag from a real `ResponseItem::FunctionCall { name: "context-bonsai-prune", .. }`.
- [ ] All existing tests pass: `cargo test -p codex-context-bonsai`, `cargo test -p codex-core context_bonsai`, `cargo clippy -p codex-core --tests -- -D warnings`.
- [ ] Side-crate clippy clean: `cargo clippy --all-targets -- -D warnings`.

## Context References

### Relevant Codebase Files (must read)
- `/home/basil/projects/context-bonsai-agents/codex_context_bonsai/src/guards.rs:22-41` — `MessageForMatching` struct definition
- `/home/basil/projects/context-bonsai-agents/codex_context_bonsai/src/guards.rs:108-139` — `resolve_pattern` signature + ambiguity branch
- `/home/basil/projects/context-bonsai-agents/codex_context_bonsai/src/guards.rs:131-138` — exact ambiguity branch to modify
- `/home/basil/projects/context-bonsai-agents/codex_context_bonsai/src/lib.rs` — public re-exports (the new predicate must be re-exported here)
- `/home/basil/projects/context-bonsai-agents/codex_context_bonsai/tests/guards.rs:1-42` — test conventions and `plain` helper
- `/home/basil/projects/context-bonsai-agents/codex/codex-rs/core/src/context_bonsai.rs:88-153` — `project_message_for_matching` (target for population)
- `/home/basil/projects/context-bonsai-agents/codex/codex-rs/core/src/context_bonsai_tests.rs` — agent-repo test conventions

### Reference Implementation
- `/home/basil/projects/opencode_context_bonsai_plugin/src/prune-pattern.ts:85-107`
- `/home/basil/projects/the_observer/.agents/plans/story-context-bonsai-v2-prune-call-filtering.md`

### Relevant Documentation
- `/home/basil/projects/context-bonsai-agents/docs/context-bonsai-agent-spec.md` (commit `cb61f00`)
- `/home/basil/projects/context-bonsai-agents/docs/agent-specs/codex-context-bonsai-spec.md` (commit `4d87eb9`)

### Codex `ResponseItem` shape
- `ResponseItem::FunctionCall { name, arguments, .. }` — primary detection target. `name` is the tool name string the model invoked.
- `ResponseItem::CustomToolCall { input, .. }` — present in Codex but does not currently carry a separate tool-name field on the call itself; if Codex routes MCP tools through `CustomToolCall` rather than `FunctionCall`, additional handling may be needed. Implementer to verify by inspecting how `context-bonsai-prune` tool calls land in real Codex transcripts (a `CompactedItem.replacement_history` or a rollout from a prune-attempted session is sufficient evidence).

## Implementation Plan

### Phase 1: Side-crate predicate + struct extension
- Add `is_prune_wrapper: bool` to `MessageForMatching`. Update the existing `plain` test helper and any side-crate construction sites to default `false`.
- Add `is_prune_wrapper_response_item(item: &ResponseItem) -> bool` in `guards.rs` (or a sibling pure module). Re-export from `lib.rs`.

### Phase 2: Side-crate filter integration
- In `resolve_pattern`'s ambiguity branch, before returning `GuardError::Ambiguous`, filter `matches` by `!is_prune_wrapper`. If exactly one survives, return it; otherwise return the existing ambiguity error unchanged.

### Phase 3: Agent-repo population
- Update `project_message_for_matching` to set `is_prune_wrapper: is_prune_wrapper_response_item(item)` for each row. Default false for arms that don't naturally carry tool-name metadata.

### Phase 4: Tests
- Side-crate predicate tests (native name, MCP-prefixed name, non-prune `FunctionCall`, non-call variant).
- Side-crate resolver tests (four outcomes).
- Agent-repo projector test (real `ResponseItem::FunctionCall { name: "context-bonsai-prune", .. }` produces a projected row with `is_prune_wrapper == true`).

## Step-by-Step Tasks

1. Read the side-crate and agent-repo files above to confirm exact symbols + match arms.
2. Verify whether prune calls land as `FunctionCall` or `CustomToolCall` (or both) in real Codex transcripts; document choice.
3. Add the predicate + struct field.
4. Add filter logic in `resolve_pattern`.
5. Update `project_message_for_matching` to populate the flag.
6. Add tests at both layers.
7. Run validation; verify clippy clean and no regressions.

## Testing Strategy

Side-crate `cargo test` for predicate + resolver. One agent-repo test in `context_bonsai_tests.rs` for the projector populating the flag from a real `ResponseItem`.

## Validation Commands

- `cd /home/basil/projects/context-bonsai-agents/codex_context_bonsai && cargo test`
- `cd /home/basil/projects/context-bonsai-agents/codex_context_bonsai && cargo clippy --all-targets -- -D warnings`
- `cd /home/basil/projects/context-bonsai-agents/codex/codex-rs && cargo test -p codex-core context_bonsai`
- `cd /home/basil/projects/context-bonsai-agents/codex/codex-rs && cargo clippy -p codex-core --tests -- -D warnings`

## Worktree Artifact Check

- Checked At: 2026-04-24
- Planned Target Files:
  - `codex_context_bonsai/src/guards.rs`
  - `codex_context_bonsai/src/lib.rs`
  - `codex_context_bonsai/tests/guards.rs`
  - `codex/codex-rs/core/src/context_bonsai.rs`
  - `codex/codex-rs/core/src/context_bonsai_tests.rs`
- Overlaps Found: pending (planner re-checks before commit)
- Escalation Status: none
- Decision Citation: n/a

## Plan Approval and Commit Status

- Approval Status: pending
- Approval Citation: none
- Plan Commit Hash: pending-next-commit
- Ready-for-Orchestration: no

## Validation Loop Results

- Missing details check: pending
- Ambiguity check: pending
- Worktree artifact risk check: pending
- Plan-commit status check: pending
- Iterations run: 1

## Completion Checklist

- [ ] All acceptance criteria met
- [ ] Validation commands pass
- [ ] Plan approved and committed before orchestration begins
