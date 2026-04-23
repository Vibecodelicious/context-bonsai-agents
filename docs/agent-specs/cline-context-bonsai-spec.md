# Cline Context Bonsai Spec

## Purpose

This document specializes the shared Context Bonsai contract for Cline.
Cline has real hook infrastructure, but the authoritative history, truncation, and compaction behavior still live in first-party core state. The correct stance is plugin-side and hook-side first, while treating canonical history correctness as a hard constraint that may require a narrow core seam if the extension surfaces cannot reach the authoritative transcript path.

## User Model

### User Gamut

- VS Code users running long Cline tasks with approval-gated tools
- users relying on task resume, checkpoints, and restored task state
- teams using hooks and MCP to extend Cline behavior
- users sensitive to visible task-history correctness after compaction or restore

### User-Needs Gamut

- prune and retrieve must align with persisted API conversation history, not only transient UI messages
- archive placeholders must survive resume and checkpoint flows
- hooks should remain useful, but not be treated as the sole source of truth for transcript mutation
- built-in compaction and bonsai must not corrupt one another's history state

### Ambiguities From User Model

- Whether bonsai should integrate with Cline's existing condense/precompact path or remain orthogonal. This spec favors explicit integration with the canonical history path rather than a separate parallel transcript layer.

## Capability Evidence Matrix

| Area | Status | Notes |
|---|---|---|
| Persistent transcript | Verified | API and UI histories are both stored on disk |
| Tool execution layer | Verified | Centralized coordinator and handlers exist |
| Hook system | Verified | Lifecycle hooks can inject additional context |
| Full transcript rewrite via hooks | Not verified | Hooks are additive; canonical history mutation remains core-owned |
| System prompt assembly | Verified | Prompt assembly is internal and direct |
| Token/context tracking | Verified | Context window and truncation utilities already exist |

## Verified Host Primitives

- Canonical task history lives in [message-state.ts](/home/basil/projects/context-bonsai-agents/cline/src/core/task/message-state.ts) and [disk.ts](/home/basil/projects/context-bonsai-agents/cline/src/core/storage/disk.ts).
- Tools are centralized through [ToolExecutor.ts](/home/basil/projects/context-bonsai-agents/cline/src/core/task/ToolExecutor.ts) and [ToolExecutorCoordinator.ts](/home/basil/projects/context-bonsai-agents/cline/src/core/task/tools/ToolExecutorCoordinator.ts).
- Hooks exist and can append context through [hook-factory.ts](/home/basil/projects/context-bonsai-agents/cline/src/core/hooks/hook-factory.ts) and task-side hook handling in [index.ts](/home/basil/projects/context-bonsai-agents/cline/src/core/task/index.ts).
- Context sizing and truncation logic already exists in [ContextManager.ts](/home/basil/projects/context-bonsai-agents/cline/src/core/context/context-management/ContextManager.ts).

## Unverified Or Weak Areas

- Hook APIs do not appear to own canonical full-history replacement before every model call.
- Bonsai cannot safely rely on UI transcript state alone because API conversation history is the authoritative model-facing source.
- Exact reuse of existing condense flows requires further design work.

## Integration Posture

### Required architecture stance

- Prefer hook-side or extension-side delivery first, but only where those paths can mutate the authoritative model-facing history.
- Cline Context Bonsai MUST preserve canonical-history correctness, not merely mutate a parallel hook-side transcript.
- Hooks MAY provide guidance, observability, and lightweight context injection, but prune/retrieve state MUST be reflected in persisted API conversation history.

### Prune and retrieve contract

- The model-facing tool contract remains `context-bonsai-prune` and `context-bonsai-retrieve`.
- Archive metadata SHOULD be stored alongside or in a structure directly correlated with API conversation history.
- Retrieval MUST restore visibility in the same history layer used for actual request construction.

### Transcript mutation path

- The implementation SHOULD first exhaust hook-side and extension-side paths that can reach canonical history before adding core history or compaction-management changes.
- Placeholder rendering must occur in the same transcript path that reaches `api.createMessage(...)`.

### System guidance path

- System guidance SHOULD be injected through the internal prompt-building path.
- Hooks MAY augment, but should not be the only location for core bonsai instructions.

### Gauge path

- Gauge logic SHOULD reuse existing context-window information and task token accounting.
- Hook-delivered context is acceptable for gauge nudges if it is reliably model-visible, but cadence and severity must be driven from authoritative context data.

## Fail-Closed Requirements

- If canonical history cannot be rewritten safely, prune MUST fail closed.
- If archive state and checkpoint restore could diverge, the implementation must reject the mutation rather than risk split-brain task history.
- Gauge remains silent when context data is unavailable.

## Parity Gaps Against Shared Spec

- Hooks are strong, but not sufficient by themselves for full parity.
- Existing condense and truncate behavior could conflict with bonsai unless explicitly integrated.
- Dual persistence of UI and API histories makes authoritative-path discipline mandatory.

## Specified Implementation Direction

- Preferred: the smallest integration that preserves canonical correctness, with hooks and extension surfaces handling everything they can safely own before core changes are introduced.
- Acceptable: precompact integration if it preserves deterministic prune/retrieve semantics.
- Not acceptable: a hook-only implementation that leaves canonical API history unchanged.

## E2E Priorities

- prune/retrieve roundtrip against persisted API conversation history
- resume/checkpoint persistence
- gauge visibility without relying only on VS Code UI affordances
- boundary rejection with no history mutation

## Key References

- [message-state.ts](/home/basil/projects/context-bonsai-agents/cline/src/core/task/message-state.ts)
- [disk.ts](/home/basil/projects/context-bonsai-agents/cline/src/core/storage/disk.ts)
- [ToolExecutor.ts](/home/basil/projects/context-bonsai-agents/cline/src/core/task/ToolExecutor.ts)
- [ToolExecutorCoordinator.ts](/home/basil/projects/context-bonsai-agents/cline/src/core/task/tools/ToolExecutorCoordinator.ts)
- [ContextManager.ts](/home/basil/projects/context-bonsai-agents/cline/src/core/context/context-management/ContextManager.ts)
- [index.ts](/home/basil/projects/context-bonsai-agents/cline/src/core/task/index.ts)
