# Cline Context Bonsai Spec

## Purpose

This document specializes the shared Context Bonsai contract for Cline.
Cline has real hook infrastructure, but the authoritative history, truncation, and compaction behavior still live in first-party core state. The seam question is now resolved: hooks can add advisory model-visible context, but full bonsai prune/retrieve requires a small core seam because extension-side hooks do not own canonical transcript replacement or persistence.

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

- The remaining design choice is not whether a core seam is needed, but how narrowly bonsai can extend the existing checkpoint/history-overwrite machinery while leaving guidance and tool ergonomics extension-side.

## Capability Evidence Matrix

| Area | Status | Notes |
|---|---|---|
| Persistent transcript | Verified | API and UI histories are both stored on disk |
| Tool execution layer | Verified | Centralized coordinator and handlers exist |
| Hook system | Verified | Lifecycle hooks can inject additional context |
| Full transcript rewrite via hooks | Missing | Hooks can append context but do not replace canonical transcript history |
| System prompt assembly | Verified | Prompt assembly is internal and direct |
| Token/context tracking | Verified | Context window and truncation utilities already exist |
| Canonical history overwrite path | Verified | Core already persists and reloads overwritten conversation history |

## Verified Host Primitives

- Canonical task history lives in [message-state.ts](/home/basil/projects/context-bonsai-agents/cline/src/core/task/message-state.ts) and [disk.ts](/home/basil/projects/context-bonsai-agents/cline/src/core/storage/disk.ts).
- Tools are centralized through [ToolExecutor.ts](/home/basil/projects/context-bonsai-agents/cline/src/core/task/ToolExecutor.ts) and [ToolExecutorCoordinator.ts](/home/basil/projects/context-bonsai-agents/cline/src/core/task/tools/ToolExecutorCoordinator.ts).
- Hooks exist and can append context through [hook-factory.ts](/home/basil/projects/context-bonsai-agents/cline/src/core/hooks/hook-factory.ts) and task-side hook handling in [index.ts](/home/basil/projects/context-bonsai-agents/cline/src/core/task/index.ts).
- Context sizing and truncation logic already exists in [ContextManager.ts](/home/basil/projects/context-bonsai-agents/cline/src/core/context/context-management/ContextManager.ts).
- Core already exposes canonical overwrite and restore mechanisms through [overwriteApiConversationHistory](/home/basil/projects/context-bonsai-agents/cline/src/core/task/message-state.ts#L186) and checkpoint restore flows in [checkpoints/index.ts](/home/basil/projects/context-bonsai-agents/cline/src/integrations/checkpoints/index.ts#L661).

## Unverified Or Weak Areas

- Hook APIs do not own canonical full-history replacement before every model call.
- Bonsai cannot safely rely on UI transcript state alone because API conversation history is the authoritative model-facing source.
- Existing `conversationHistoryDeletedRange` and context-history updates are optimized for cumulative truncation, not arbitrary bonsai archive placeholders, so a narrow extension is still needed.

## Integration Posture

### Required architecture stance

- Cline Context Bonsai MUST preserve canonical-history correctness, not merely mutate a parallel hook-side transcript.
- Cline Context Bonsai SHOULD keep guidance, gauge, and tool ergonomics extension-side where possible.
- Cline Context Bonsai MUST use a narrow core seam for authoritative prune/retrieve transcript mutation and persistence, because no extension-side surface currently owns the canonical history.
- Hooks MAY provide guidance, observability, and lightweight context injection, but prune/retrieve state MUST be reflected in persisted API conversation history.

### Prune and retrieve contract

- The model-facing tool contract remains `context-bonsai-prune` and `context-bonsai-retrieve`.
- Archive metadata SHOULD be stored alongside or in a structure directly correlated with API conversation history.
- Retrieval MUST restore visibility in the same history layer used for actual request construction.
- The narrowest implementation path is to extend the existing message-state/checkpoint/context-manager overwrite flow rather than inventing a separate transcript store.
- Per shared spec Pattern Matching Contract, the prune-wrapper filter on the ambiguity path MUST be implemented inside the side-repo pattern resolver in `cline_context_bonsai/src/guards.ts`, operating on the conversation-history snapshot the applier feeds into pattern resolution.

### Transcript mutation path

- Hook-side and extension-side paths are insufficient for authoritative history replacement; they can only append advisory context.
- Placeholder rendering must occur in the same transcript path that reaches `api.createMessage(...)`.
- The preferred core seam is an extension of the existing `overwriteApiConversationHistory` plus `ContextManager` persistence/update path.

### System guidance path

- System guidance SHOULD be injected through the internal prompt-building path.
- Hooks MAY augment, but should not be the only location for core bonsai instructions.

### Gauge path

- Gauge logic SHOULD reuse existing context-window information and task token accounting.
- Hook-delivered context is acceptable for gauge nudges if it is reliably model-visible, but cadence and severity must be driven from authoritative context data.
- Gauge does not need the same core seam as prune/retrieve if hook delivery remains sufficient and correctly ordered.

## Fail-Closed Requirements

- If the canonical history overwrite seam is unavailable, prune/retrieve MUST fail closed.
- If archive state and checkpoint restore could diverge, the implementation must reject the mutation rather than risk split-brain task history.
- Gauge remains silent when context data is unavailable.

## Parity Gaps Against Shared Spec

- Hooks are strong for guidance, but not sufficient by themselves for prune/retrieve parity.
- Existing condense and truncate behavior could conflict with bonsai unless explicitly integrated into the same overwrite path.
- Dual persistence of UI and API histories makes authoritative-path discipline mandatory.

## Specified Implementation Direction

- Preferred: hybrid design where hooks own guidance and gauge delivery while a minimal core seam extends checkpoint/message-state/context-manager overwrite behavior for prune/retrieve.
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
