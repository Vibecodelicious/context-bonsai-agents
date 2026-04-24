# Story: Codex replacement-history implementation plan

**Epic:** Context Bonsai Agent Ports
**Size:** Large
**Dependencies:** None

## Story Description

Implement Context Bonsai for Codex as a hybrid design: hooks provide guidance and gauge where possible, while prune/retrieve use the narrowest core seam available, namely the existing replacement-history compaction machinery.

The bulk of the port lives in the `codex_context_bonsai` side-project submodule as a standalone Rust crate (`codex-context-bonsai`) containing guards, archive payload shape, placeholder rendering, and gauge bands. The Codex agent repo's `codex-rs/core` depends on the side crate via a Cargo path dependency pointed at the sibling submodule. The agent repo itself keeps only the pieces that cannot move out of core: the replacement-history seam, the `CompactedItem` protocol extension, the thin wrapper module that integrates the side crate with Codex's session state, tool registration, and hook event glue for guidance/gauge.

The plan does not invent a new transcript store. Codex already has canonical history replacement semantics in core through compaction and rollout reconstruction. Bonsai is implemented as a specialized use of that path.

For durable retrieve support, v1 extends the existing persisted `CompactedItem` shape with a bonsai archive payload that includes both metadata and archived content: `anchor_id`, `range_end_id`, `summary`, `index_terms`, and `archived_history`. That keeps persistence attached to the same rollout item that already carries `replacement_history`, and the payload shape itself is defined in the side crate and imported by `codex-rs/protocol`.

## Architecture Split

- **Side repo (`codex_context_bonsai`)**: standalone Rust crate with guards, archive payload shape (serde-compatible), placeholder rendering, gauge severity bands, and all tests that do not require Codex's session state. Authoritative coding standards: `codex_context_bonsai/STANDARDS.md` (mirrors Codex clippy workspace lints).
- **Agent repo (`codex`)**: replacement-history integration in `core`, `CompactedItem` protocol extension, thin wrapper module (`context_bonsai.rs`) that plugs the side crate into session state, tool registration in `core/src/tools/spec.rs`, hook event glue for guidance and gauge. Authoritative coding standards: `codex/AGENTS.md` plus per-crate `AGENTS.md`.
- **Cargo path dep**: `codex-rs/core/Cargo.toml` adds `codex-context-bonsai = { path = "../../../codex_context_bonsai" }`. Stable because both are submodules under the planning repo at fixed relative paths.
- **Feature branch**: agent-repo commits on `feat/context-bonsai-port` inside `codex`; side-repo commits on `feat/context-bonsai-port` inside `codex_context_bonsai`. Parent submodule pointers are not advanced by this story.

## User Model

### User Gamut
- Codex TUI users in long sessions
- users resuming stored threads and expecting transcript fidelity
- maintainers trying to keep new functionality out of central core where possible
- reviewers who need confidence that prune/retrieve uses canonical history, not shadow state

### User-Needs Gamut
- bonsai guidance visible to the model without waiting for core changes everywhere
- prune/retrieve that mutate the exact prompt history path
- persisted replacement histories that survive resume
- the smallest possible new core API surface

### Design Implications
- Guidance and gauge should exploit existing hook-side additional-context injection.
- The core seam should reuse `replace_compacted_history` semantics rather than inventing arbitrary mutation APIs.
- App-server exposure, if any, should wrap the same core seam rather than duplicating behavior.

## Acceptance Criteria

- [ ] Plan explicitly centers prune/retrieve on replacement-history checkpoints.
- [ ] Plan keeps guidance and gauge outside core where feasible.
- [ ] Plan identifies the minimum core files to touch for authoritative history replacement.
- [ ] Plan identifies where prune/retrieve guard semantics live: pattern resolution, malformed or incomplete boundary rejection, and same-step retrieve rejection.
- [ ] Plan identifies the durable archive metadata shape and where it is persisted.
- [ ] Plan identifies the durable archived-content payload used by retrieve.
- [ ] Plan includes persisted-history reconstruction coverage.
- [ ] Validation commands cover hooks, core compaction, and reconstruction tests.

## Context References

### Relevant Codebase Files (must read)
- `/home/basil/projects/context-bonsai-agents/codex/codex-rs/core/src/session/turn.rs` - actual prompt assembly path
- `/home/basil/projects/context-bonsai-agents/codex/codex-rs/core/src/context_manager/history.rs` - canonical prompt history and normalization
- `/home/basil/projects/context-bonsai-agents/codex/codex-rs/core/src/hook_runtime.rs` - hook-side guidance injection
- `/home/basil/projects/context-bonsai-agents/codex/codex-rs/core/src/compact.rs` - existing replacement-history install path
- `/home/basil/projects/context-bonsai-agents/codex/codex-rs/core/src/session/mod.rs` - `replace_history` and `replace_compacted_history`
- `/home/basil/projects/context-bonsai-agents/codex/codex-rs/core/src/session/rollout_reconstruction.rs` - persisted replacement-history reconstruction
- `/home/basil/projects/context-bonsai-agents/codex/codex-rs/protocol/src/protocol.rs` - durable `CompactedItem` schema

### New Files to Create (side repo: `codex_context_bonsai/`)
- `/home/basil/projects/context-bonsai-agents/codex_context_bonsai/Cargo.toml` - `codex-context-bonsai` crate manifest (mirrors Codex workspace lints)
- `/home/basil/projects/context-bonsai-agents/codex_context_bonsai/src/lib.rs` - public API re-exports consumed by `codex-rs/core`
- `/home/basil/projects/context-bonsai-agents/codex_context_bonsai/src/guards.rs` - pattern resolution, boundary and same-step guards (pure)
- `/home/basil/projects/context-bonsai-agents/codex_context_bonsai/src/archive.rs` - archive metadata and archived-content payload shape (serde + schemars derivations)
- `/home/basil/projects/context-bonsai-agents/codex_context_bonsai/src/placeholder.rs` - structured placeholder rendering
- `/home/basil/projects/context-bonsai-agents/codex_context_bonsai/src/gauge.rs` - gauge severity band logic (pure)
- `/home/basil/projects/context-bonsai-agents/codex_context_bonsai/tests/guards.rs` - guard-path tests
- `/home/basil/projects/context-bonsai-agents/codex_context_bonsai/tests/archive_roundtrip.rs` - serde roundtrip with the exact shape `CompactedItem` will embed
- `/home/basil/projects/context-bonsai-agents/codex_context_bonsai/tests/gauge.rs` - severity bands
- `/home/basil/projects/context-bonsai-agents/codex_context_bonsai/docs/story.md` - pointer to parent story plan

### New Files to Create (agent repo: `codex/`)
- `/home/basil/projects/context-bonsai-agents/codex/codex-rs/core/src/context_bonsai.rs` - thin wrapper module: delegates to `codex-context-bonsai` and plumbs results into session state / replacement-history installs
- `/home/basil/projects/context-bonsai-agents/codex/codex-rs/core/src/context_bonsai_tests.rs` - Codex-side tests exercising the replacement-history seam (per the `#[cfg(test)] #[path = "..."] mod tests;` idiom)

### Files Modified (agent repo: `codex/`)
- `/home/basil/projects/context-bonsai-agents/codex/codex-rs/core/Cargo.toml` - add `codex-context-bonsai = { path = "../../../codex_context_bonsai" }`
- `/home/basil/projects/context-bonsai-agents/codex/codex-rs/core/src/hook_runtime.rs` - hook-side guidance and gauge injection
- `/home/basil/projects/context-bonsai-agents/codex/codex-rs/core/src/compact.rs` - install bonsai replacement-history snapshots
- `/home/basil/projects/context-bonsai-agents/codex/codex-rs/core/src/compact_remote.rs` - mirror behavior for remote compact path
- `/home/basil/projects/context-bonsai-agents/codex/codex-rs/core/src/session/mod.rs` - wire prune/retrieve through `replace_history` / `replace_compacted_history`
- `/home/basil/projects/context-bonsai-agents/codex/codex-rs/core/src/session/rollout_reconstruction.rs` - reconstruct bonsai archive payloads on resume
- `/home/basil/projects/context-bonsai-agents/codex/codex-rs/core/src/tools/spec.rs` - register `context-bonsai-prune` and `context-bonsai-retrieve`
- `/home/basil/projects/context-bonsai-agents/codex/codex-rs/protocol/Cargo.toml` - depend on `codex-context-bonsai` to reuse the archive payload type directly in `CompactedItem`
- `/home/basil/projects/context-bonsai-agents/codex/codex-rs/protocol/src/protocol.rs` - extend `CompactedItem` with optional `bonsai_archive: Option<BonsaiArchivePayload>` using the side-crate type
- `/home/basil/projects/context-bonsai-agents/codex/codex-rs/hooks/src/events/session_start.rs` - guidance injection
- `/home/basil/projects/context-bonsai-agents/codex/codex-rs/hooks/src/events/user_prompt_submit.rs` - gauge injection

### Relevant Documentation
- [codex-context-bonsai-spec.md](/home/basil/projects/context-bonsai-agents/docs/agent-specs/codex-context-bonsai-spec.md)
- [context-bonsai-agent-spec.md](/home/basil/projects/context-bonsai-agents/docs/context-bonsai-agent-spec.md)

## Implementation Plan

### Phase 1: Guidance and state wiring
- Use existing hook-side additional-context injection for bonsai instructions and gauge wording.
- Decide whether any built-in instruction text also needs a core prompt addition.

### Phase 2: Replacement-history prune/retrieve seam
- Add a dedicated bonsai module that builds replacement histories plus durable archived-content payloads.
- Reuse `replace_compacted_history`-style atomic install behavior.
- Make retrieval restore from persisted bonsai archived-history state.
- Implement prune/retrieve validation guards inside the bonsai core module so tool handlers remain thin wrappers.
- Extend `CompactedItem` with optional bonsai archive metadata plus `archived_history` so retrieve has an authoritative stored payload.

### Phase 3: Optional exposure surfaces
- Register prune/retrieve through the existing tool registry in `core/src/tools/spec.rs`.
- If app-server support is required, expose the same core seam instead of a second implementation.

### Phase 4: Validation
- Add tests for hook guidance, replacement-history persistence, and reconstruction.
- Add TUI/app-server tests only if those surfaces are changed.

## Step-by-Step Tasks

1. Create a dedicated core bonsai module centered on replacement-history snapshots.
2. Wire guidance and gauge through hook-side additional context.
3. Add prune/retrieve tool integration that calls the new module.
4. Wire the tools into `core/src/tools/spec.rs` and add spec-level tests.
5. Extend `CompactedItem` with bonsai archive metadata fields plus `archived_history`, and thread that data through compaction persistence and reconstruction.
6. Implement pattern and same-step retrieve guards in the bonsai core module.
7. Extend reconstruction and compaction tests for bonsai-specific histories, including guard paths, metadata persistence, and archived-content restore.
8. Expose app-server or UI affordances only if required for the chosen v1.
9. Run validation commands and refine.

## Testing Strategy

- Core tests must prove replacement-history persistence and reconstruction correctness.
- Hook tests must prove guidance reaches the real prompt history.
- TUI snapshot or app-server tests are secondary and should be added only if those surfaces change.

## Validation Commands

- `cd /home/basil/projects/context-bonsai-agents/codex_context_bonsai && cargo test`
- `cd /home/basil/projects/context-bonsai-agents/codex_context_bonsai && cargo clippy --all-targets -- -D warnings`
- `cd /home/basil/projects/context-bonsai-agents/codex/codex-rs && cargo test -p codex-hooks`
- `cd /home/basil/projects/context-bonsai-agents/codex/codex-rs && cargo test -p codex-protocol`
- `cd /home/basil/projects/context-bonsai-agents/codex/codex-rs && cargo test -p codex-core spec_tests`
- `cd /home/basil/projects/context-bonsai-agents/codex/codex-rs && cargo test -p codex-core hooks`
- `cd /home/basil/projects/context-bonsai-agents/codex/codex-rs && cargo test -p codex-core compact`
- `cd /home/basil/projects/context-bonsai-agents/codex/codex-rs && cargo test -p codex-core context_bonsai`
- `cd /home/basil/projects/context-bonsai-agents/codex/codex-rs && cargo test -p codex-core reconstruct_history_uses_replacement_history_verbatim`
- `cd /home/basil/projects/context-bonsai-agents/codex/codex-rs && cargo test -p codex-core reconstruct_history_matches_live_compactions`

## Worktree Artifact Check

- Checked At: `2026-04-23`
- Planned Target Files: `/home/basil/projects/context-bonsai-agents/codex/codex-rs/core/src/context_bonsai.rs`, `/home/basil/projects/context-bonsai-agents/codex/codex-rs/core/src/hook_runtime.rs`, `/home/basil/projects/context-bonsai-agents/codex/codex-rs/core/src/compact.rs`, `/home/basil/projects/context-bonsai-agents/codex/codex-rs/core/src/compact_remote.rs`, `/home/basil/projects/context-bonsai-agents/codex/codex-rs/core/src/session/mod.rs`, `/home/basil/projects/context-bonsai-agents/codex/codex-rs/core/src/session/rollout_reconstruction.rs`, `/home/basil/projects/context-bonsai-agents/codex/codex-rs/core/src/tools/spec.rs`, `/home/basil/projects/context-bonsai-agents/codex/codex-rs/protocol/src/protocol.rs`, `/home/basil/projects/context-bonsai-agents/codex/codex-rs/hooks/src/events/session_start.rs`, `/home/basil/projects/context-bonsai-agents/codex/codex-rs/hooks/src/events/user_prompt_submit.rs`
- Overlaps Found: `none`
- Escalation Status: `none`
- Decision Citation: `none`

## Plan Approval and Commit Status

- Approval Status: `approved`
- Approval Citation: `user message 2026-04-23: "All stories are approved."`
- Plan Commit Hash: `2ce34af3e79031d3b8142d52176d700ec81836b6`
- Ready-for-Orchestration: `yes`

## Validation Loop Results

- Missing details check: pass
- Ambiguity check: pass
- Worktree artifact risk check: pass
- Plan-commit status check: pending
- Iterations run: 4

## Completion Checklist

- [ ] All acceptance criteria met
- [ ] Validation commands pass
- [ ] Plan approved and committed before orchestration begins
- [ ] User-model ambiguities resolved or escalated
- [ ] Worktree artifact overlaps resolved (approved direction or explicit deferral)
