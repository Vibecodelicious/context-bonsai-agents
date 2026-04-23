# Codex Context Bonsai Spec

## Purpose

This document specializes the shared Context Bonsai contract for Codex.
Codex has durable thread state, usage tracking, tools, hooks, and app-server surfaces. The core seam question is now resolved: hook-side and plugin-side paths can inject model-visible guidance, but authoritative prune/retrieve transcript replacement requires a small core seam built on the existing replacement-history compaction machinery.

## User Model

### User Gamut

- TUI users running long Codex sessions
- users relying on stored threads and rollout history
- teams integrating Codex through MCP or app-server surfaces
- maintainers who need a fail-closed design when runtime seams are still moving

### User-Needs Gamut

- preserved thread correctness after prune and retrieve
- deterministic behavior across local thread storage and exported history
- gauge signals based on real context usage rather than guesswork alone
- implementation paths that do not assume hooks can already rewrite transcript history if they cannot

### Ambiguities From User Model

- The remaining design choice is not whether a core seam is needed, but how narrow that seam can be while keeping most bonsai logic outside core.

## Capability Evidence Matrix

| Area | Status | Notes |
|---|---|---|
| Persistent thread history | Verified | Thread store and rollout-backed persistence exist |
| Tool execution layer | Verified | Tool registry and handler pipeline are strong |
| Hook system | Verified | Hooks can inject additional context/messages |
| Authoritative transcript rewrite outside core | Missing | No verified non-core path can replace arbitrary existing prompt history |
| System guidance path | Verified | Existing hook-added context provides a model-visible guidance path |
| Token/context tracking | Verified | Context manager and session state track usage and windows |
| Replacement-history checkpoint machinery | Verified | Core already has atomic history replacement plus persisted compaction snapshots |

## Verified Host Primitives

- Thread and history persistence exist in [thread-store](/home/basil/projects/context-bonsai-agents/codex/codex-rs/thread-store/src/store.rs) and [types.rs](/home/basil/projects/context-bonsai-agents/codex/codex-rs/thread-store/src/types.rs).
- Prompt-ready history is produced by [history.rs](/home/basil/projects/context-bonsai-agents/codex/codex-rs/core/src/context_manager/history.rs) and sent from [turn.rs](/home/basil/projects/context-bonsai-agents/codex/codex-rs/core/src/session/turn.rs).
- Tool handling is centralized in [registry.rs](/home/basil/projects/context-bonsai-agents/codex/codex-rs/core/src/tools/registry.rs).
- Initial system and developer context assembly is in [session/mod.rs](/home/basil/projects/context-bonsai-agents/codex/codex-rs/core/src/session/mod.rs).
- Hook runtime exists in [hook_runtime.rs](/home/basil/projects/context-bonsai-agents/codex/codex-rs/core/src/hook_runtime.rs).
- Core exposes authoritative history replacement through [replace_history](/home/basil/projects/context-bonsai-agents/codex/codex-rs/core/src/session/mod.rs#L2402) and [replace_compacted_history](/home/basil/projects/context-bonsai-agents/codex/codex-rs/core/src/session/mod.rs#L2411).
- Existing compaction persists replacement-history checkpoints in [compact.rs](/home/basil/projects/context-bonsai-agents/codex/codex-rs/core/src/compact.rs#L279) and rebuilds them on resume in [rollout_reconstruction.rs](/home/basil/projects/context-bonsai-agents/codex/codex-rs/core/src/session/rollout_reconstruction.rs#L234).

## Unverified Or Weak Areas

- Hooks clearly support additive context and guidance injection, but not transcript replacement.
- App-server surfaces can append items and trigger rollback or compaction, but they do not provide arbitrary contiguous-range replacement for an existing thread.
- The remaining open question is API shape, not whether a core replacement seam is required.

## Integration Posture

### Required architecture stance

- Hooks, plugins, or app-server surfaces SHOULD be exhausted first before core patches are proposed.
- Codex Context Bonsai MUST use hooks and plugins for guidance, gauge delivery, and tool exposure wherever possible.
- Codex Context Bonsai MUST use a narrow core seam for authoritative prune/retrieve history replacement, because no non-core path currently reaches the real prompt history with replacement semantics.
- Future implementation planning SHOULD center that seam on the existing replacement-history checkpoint path rather than inventing a broader arbitrary-history mutation mechanism.

### Prune and retrieve contract

- The target model-facing contract is still `context-bonsai-prune` and `context-bonsai-retrieve`.
- Tool definitions SHOULD live in the existing tool registry.
- Tool execution SHOULD delegate to a minimal core capability that installs a new replacement-history snapshot for the live thread and persists the corresponding rollout item.

### Transcript mutation path

- The canonical source of prompt history appears to be `ContextManager` plus session turn assembly.
- Any implementation MUST mutate or transform the same history path used by `for_prompt(...)`, not a parallel shadow log only.
- The preferred mutation mechanism is to reuse the existing replacement-history install path already used by compaction.
- App-server `thread/inject_items` and `thread/rollback` are insufficient for bonsai parity because they only append items or drop suffix turns.

### System guidance path

- Bonsai guidance SHOULD use the already-verified hook-side context injection path unless a stronger path is later shown to be necessary.

### Gauge path

- Gauge SHOULD reuse session/context-manager token data and model context window resolution.
- Hook-added context MAY be acceptable for gauge delivery if it is confirmed to be model-visible and ordered correctly.
- Gauge does not require the same core seam as prune/retrieve; it can remain hook-side if cadence and ordering are reliable.

## Fail-Closed Requirements

- If the replacement-history core seam is unavailable, prune/retrieve MUST fail closed rather than degrade into additive summaries.
- Hook-only additive summaries are not sufficient to claim prune parity.
- Any future patch or hook matcher must fail closed when runtime structure changes.

## Parity Gaps Against Shared Spec

- The main gap is that Codex does not currently expose the replacement-history path as a bonsai-oriented capability.
- Tooling, persistence, token tracking, and guidance injection are already strong.
- Codex is viable for bonsai, but unlike Kilo/OpenCode it needs one small core seam before the rest can live outside core.

## Specified Implementation Direction

- Preferred: hybrid design where hooks/plugins own guidance, gauge, and tool exposure, while a minimal core seam installs replacement-history snapshots for prune/retrieve.
- Acceptable: exposing that seam through app-server or internal session APIs, provided the actual history replacement still uses the canonical core path.
- Not acceptable: claiming parity based only on additive hook messages or external sidecar inspection.

## E2E Priorities

- prove placeholder rendering in the exact prompt path sent to the model
- verify thread persistence and retrieval across stored thread resume
- verify gauge delivery in-band
- verify fail-closed behavior when mutation seam is unavailable

## Key References

- [history.rs](/home/basil/projects/context-bonsai-agents/codex/codex-rs/core/src/context_manager/history.rs)
- [turn.rs](/home/basil/projects/context-bonsai-agents/codex/codex-rs/core/src/session/turn.rs)
- [session/mod.rs](/home/basil/projects/context-bonsai-agents/codex/codex-rs/core/src/session/mod.rs)
- [registry.rs](/home/basil/projects/context-bonsai-agents/codex/codex-rs/core/src/tools/registry.rs)
- [hook_runtime.rs](/home/basil/projects/context-bonsai-agents/codex/codex-rs/core/src/hook_runtime.rs)
- [thread-store/src/store.rs](/home/basil/projects/context-bonsai-agents/codex/codex-rs/thread-store/src/store.rs)
