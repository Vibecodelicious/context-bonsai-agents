# Story: Cline canonical-history implementation plan

**Epic:** Context Bonsai Agent Ports
**Size:** Large
**Dependencies:** None

## Story Description

Implement Context Bonsai for Cline as a hybrid design: required bonsai guidance is injected through the internal system-prompt path, hooks remain available for gauge or precompact advisory context, and prune/retrieve extend the canonical history overwrite path already used by message-state persistence, checkpoint restore, and `ContextManager` context-history state.

Cline has no plugin surface capable of authoritative transcript replacement, so the agent-repo share of this port is larger than the other three projects. Even so, the extractable pure-logic pieces (pattern guards, placeholder rendering, gauge severity bands, shared archive types) live in the `cline_context_bonsai` side-project submodule and are consumed by the Cline agent repo through a `file:` workspace dependency. The side repo also owns this project's docs and standards.

The plan does not attempt a hook-only transcript layer. The actual provider request uses `truncatedConversationHistory` assembled in core, so prune/retrieve must ultimately update that canonical path.

The canonical entrypoint for v1 is the existing summarize/precompact flow centered on `SummarizeTaskHandler` and `executePreCompactHookWithCleanup`, not a parallel sibling lifecycle.
The model-facing prune/retrieve contract is implemented as real native Cline tools, with their handlers delegating into the same canonical bonsai applier used by the summarize/precompact path.
Archive state for v1 lives in a dedicated task-directory sidecar file, `context_bonsai_archives.json`, owned by core storage utilities rather than hidden in `context_history.json` or UI-only task state. That sidecar stores both archive metadata and the archived conversation payload needed for later retrieve.

## Architecture Split

- **Side repo (`cline_context_bonsai`)**: pure-logic modules (guards, placeholder rendering, gauge severity bands, shared archive types) plus standalone mocha tests. Cline imports these through a `file:` dependency so the agent code does not re-implement them. Authoritative coding standards: `cline_context_bonsai/STANDARDS.md` (mirrors Cline's Biome + Mocha conventions).
- **Agent repo (`cline`)**: canonical integration: `ContextBonsaiApplier`, native tool handlers, prompt-tool definitions, message-state / ContextManager extensions, proto updates, webview gauge surfaces, and the internal system-prompt guidance path. Authoritative coding standards: `cline/CLAUDE.md` plus `.clinerules/*.md`.
- **Feature branch**: agent-repo commits on `feat/context-bonsai-port` inside `cline`; side-repo commits on `feat/context-bonsai-port` inside `cline_context_bonsai`. Parent submodule pointers are not advanced by this story.

## User Model

### User Gamut
- VS Code users running long Cline tasks
- users depending on resume and checkpoint restore
- maintainers who want bonsai without fighting the existing task/history model
- reviewers who care about preserving canonical API history correctness

### User-Needs Gamut
- hook-visible guidance and gauge before compaction events
- prune/retrieve that mutate the exact conversation history sent to the provider
- safe coexistence with checkpoint restore and existing truncation behavior
- the smallest possible extension to current core overwrite machinery

### Design Implications
- Hooks should stay responsible for advisory context, not canonical transcript mutation.
- The narrowest core seam is an extension of existing overwrite/reset flows.
- Bonsai must reset or realign persisted `context_history.json` when overwriting canonical API history.

## Acceptance Criteria

- [ ] Plan explicitly uses the canonical history overwrite path for prune/retrieve.
- [ ] Plan keeps guidance and gauge hook-side where possible.
- [ ] Plan identifies how `conversationHistoryDeletedRange` and `contextHistoryUpdates` are reset or rebuilt after bonsai operations.
- [ ] Plan identifies how `context-bonsai-prune` and `context-bonsai-retrieve` become real native Cline tools.
- [ ] Plan identifies where prune/retrieve guard semantics live: pattern resolution, malformed or incomplete boundary rejection, and same-step retrieve rejection.
- [ ] Plan identifies the durable archived-content payload used by retrieve.
- [ ] Plan avoids coupling bonsai v1 to checkpoint semantics unless needed.
- [ ] Validation commands cover proto, unit, webview, and compile checks where touched.

## Context References

### Relevant Codebase Files (must read)
- `/home/basil/projects/context-bonsai-agents/cline/src/core/task/index.ts` - provider request assembly and hook context injection
- `/home/basil/projects/context-bonsai-agents/cline/src/core/task/message-state.ts` - canonical conversation persistence and overwrite
- `/home/basil/projects/context-bonsai-agents/cline/src/core/context/context-management/ContextManager.ts` - truncation and persisted context-history updates
- `/home/basil/projects/context-bonsai-agents/cline/src/core/hooks/precompact-executor.ts` - PreCompact hook integration
- `/home/basil/projects/context-bonsai-agents/cline/src/core/task/tools/handlers/SummarizeTaskHandler.ts` - existing summarize/compact path
- `/home/basil/projects/context-bonsai-agents/cline/src/shared/tools.ts` - native tool name registry
- `/home/basil/projects/context-bonsai-agents/cline/src/core/task/tools/ToolExecutorCoordinator.ts` - tool-handler routing
- `/home/basil/projects/context-bonsai-agents/cline/src/core/prompts/system-prompt/index.ts` - system prompt assembly
- `/home/basil/projects/context-bonsai-agents/cline/src/core/prompts/system-prompt/tools/init.ts` - tool prompt exposure and registration into the prompt spec
- `/home/basil/projects/context-bonsai-agents/cline/src/integrations/checkpoints/index.ts` - canonical overwrite/reset precedent

### New Files to Create (side repo: `cline_context_bonsai/`)
- `/home/basil/projects/context-bonsai-agents/cline_context_bonsai/package.json` - side-repo manifest with Mocha + Biome
- `/home/basil/projects/context-bonsai-agents/cline_context_bonsai/tsconfig.json` - strict TS config
- `/home/basil/projects/context-bonsai-agents/cline_context_bonsai/.mocharc.json` - test runner config mirroring Cline's
- `/home/basil/projects/context-bonsai-agents/cline_context_bonsai/src/index.ts` - public API re-exports consumed by Cline via `file:` dep
- `/home/basil/projects/context-bonsai-agents/cline_context_bonsai/src/guards.ts` - pattern resolution, boundary and same-step guards (pure)
- `/home/basil/projects/context-bonsai-agents/cline_context_bonsai/src/placeholder.ts` - placeholder rendering (pure)
- `/home/basil/projects/context-bonsai-agents/cline_context_bonsai/src/archive-types.ts` - shared archive metadata + archived-content payload types
- `/home/basil/projects/context-bonsai-agents/cline_context_bonsai/src/gauge.ts` - gauge severity band logic (pure)
- `/home/basil/projects/context-bonsai-agents/cline_context_bonsai/test/guards.test.ts` - guard-path coverage
- `/home/basil/projects/context-bonsai-agents/cline_context_bonsai/test/placeholder.test.ts` - placeholder rendering
- `/home/basil/projects/context-bonsai-agents/cline_context_bonsai/test/gauge.test.ts` - severity bands
- `/home/basil/projects/context-bonsai-agents/cline_context_bonsai/docs/story.md` - pointer to parent story plan

### New Files to Create (agent repo: `cline/`)
- `/home/basil/projects/context-bonsai-agents/cline/src/core/task/ContextBonsaiApplier.ts` - canonical overwrite/reset helper; imports guards/placeholder/gauge/types from the side repo
- `/home/basil/projects/context-bonsai-agents/cline/src/core/hooks/__tests__/precompact-executor.test.ts` - PreCompact payload/result tests
- `/home/basil/projects/context-bonsai-agents/cline/src/core/task/tools/handlers/ContextBonsaiPruneHandler.ts` - native prune tool handler
- `/home/basil/projects/context-bonsai-agents/cline/src/core/task/tools/handlers/ContextBonsaiRetrieveHandler.ts` - native retrieve tool handler
- `/home/basil/projects/context-bonsai-agents/cline/src/core/prompts/system-prompt/tools/context-bonsai-prune.ts` - prompt-side prune tool definition
- `/home/basil/projects/context-bonsai-agents/cline/src/core/prompts/system-prompt/tools/context-bonsai-retrieve.ts` - prompt-side retrieve tool definition

### Runtime-Created Files
- task-directory `context_bonsai_archives.json` - persisted archive records keyed by anchor id, containing range, summary, index terms, correlation data, and the archived conversation payload for retrieve

### Files Modified (agent repo: `cline/`)
- `/home/basil/projects/context-bonsai-agents/cline/package.json` - add `"cline-context-bonsai": "file:../cline_context_bonsai"`
- `/home/basil/projects/context-bonsai-agents/cline/src/core/task/tools/handlers/SummarizeTaskHandler.ts`
- `/home/basil/projects/context-bonsai-agents/cline/src/core/hooks/precompact-executor.ts`
- `/home/basil/projects/context-bonsai-agents/cline/src/core/task/message-state.ts`
- `/home/basil/projects/context-bonsai-agents/cline/src/core/context/context-management/ContextManager.ts`
- `/home/basil/projects/context-bonsai-agents/cline/src/shared/tools.ts`
- `/home/basil/projects/context-bonsai-agents/cline/src/core/task/tools/ToolExecutorCoordinator.ts`
- `/home/basil/projects/context-bonsai-agents/cline/src/core/prompts/system-prompt/index.ts`
- `/home/basil/projects/context-bonsai-agents/cline/src/core/prompts/system-prompt/tools/init.ts`
- `/home/basil/projects/context-bonsai-agents/cline/src/core/storage/disk.ts`
- `/home/basil/projects/context-bonsai-agents/cline/proto/cline/hooks.proto`
- `/home/basil/projects/context-bonsai-agents/cline/src/core/hooks/hook-factory.ts`
- `/home/basil/projects/context-bonsai-agents/cline/src/core/hooks/templates.ts`
- `/home/basil/projects/context-bonsai-agents/cline/webview-ui/src/components/chat/task-header/ContextWindow.tsx`
- `/home/basil/projects/context-bonsai-agents/cline/webview-ui/src/components/chat/task-header/ContextWindowSummary.tsx`

### Relevant Documentation
- [cline-context-bonsai-spec.md](/home/basil/projects/context-bonsai-agents/docs/agent-specs/cline-context-bonsai-spec.md)
- [context-bonsai-agent-spec.md](/home/basil/projects/context-bonsai-agents/docs/context-bonsai-agent-spec.md)

## Implementation Plan

### Phase 1: Structured hook payload and bonsai applier
- Extend hook payloads only as far as needed to carry bonsai results or metadata.
- Add a single helper that applies bonsai history overwrites, reads/writes `context_bonsai_archives.json` including archived conversation payloads, and resets related persisted state.

### Phase 2: Canonical prune/retrieve integration
- Integrate bonsai application into the existing summarize/precompact flow.
- Ensure overwritten history, deleted-range state, and `context_history.json` remain aligned.
- Add native bonsai tool handlers that route into the same canonical applier.
- Implement prune/retrieve validation guards inside `ContextBonsaiApplier`, with handlers and summarize flow delegating to that shared logic.

### Phase 3: Guidance and gauge
- Inject required bonsai guidance through the internal system prompt path.
- Keep hook-side delivery only for gauge or precompact advisory context where it remains additive and useful.
- Reuse existing context-window UI surfaces rather than inventing new backend telemetry.

### Phase 4: Validation
- Add unit tests for precompact execution and context-history reset behavior.
- Add webview tests only for changed gauge surfaces.

## Step-by-Step Tasks

1. Create `ContextBonsaiApplier` as the canonical overwrite/reset helper.
2. Extend the existing PreCompact payload and summarize flow to carry bonsai results.
3. Persist archive records plus archived conversation payloads in task-directory `context_bonsai_archives.json` and align resume/retrieve around that store.
4. Apply prune/retrieve through `overwriteApiConversationHistory` and coordinated `ContextManager` reset/update behavior.
5. Add native `context-bonsai-prune` and `context-bonsai-retrieve` handlers plus prompt-side tool definitions and registration.
6. Add internal system-prompt bonsai guidance, with hooks reserved for gauge or precompact advisory context.
7. Implement boundary and same-step retrieve guard logic in `ContextBonsaiApplier` and cover it with handler tests.
8. Update minimal webview context-window surfaces if needed.
9. Add tests and run validation commands.

## Testing Strategy

- Core unit tests should focus on canonical overwrite plus `ContextManager` alignment.
- Tool-handler tests should verify native bonsai tool routing and handler behavior.
- Prompt-tool tests should verify `context-bonsai-prune` and `context-bonsai-retrieve` are exposed in the system prompt tool spec.
- Hook tests should verify payload shape, cancellation, and bonsai handoff.
- Webview tests should stay limited to gauge rendering changes.

## Validation Commands

- `cd /home/basil/projects/context-bonsai-agents/cline_context_bonsai && npm test`
- `cd /home/basil/projects/context-bonsai-agents/cline_context_bonsai && npm run typecheck`
- `cd /home/basil/projects/context-bonsai-agents/cline && npm run protos`
- `cd /home/basil/projects/context-bonsai-agents/cline && npm run check-types`
- `cd /home/basil/projects/context-bonsai-agents/cline && npm run test:unit`
- `cd /home/basil/projects/context-bonsai-agents/cline && npm run test:webview`
- `cd /home/basil/projects/context-bonsai-agents/cline && npm run compile`

## Worktree Artifact Check

- Checked At: `2026-04-23`
- Planned Target Files: `/home/basil/projects/context-bonsai-agents/cline/src/core/task/ContextBonsaiApplier.ts`, `/home/basil/projects/context-bonsai-agents/cline/src/core/hooks/__tests__/precompact-executor.test.ts`, `/home/basil/projects/context-bonsai-agents/cline/src/core/task/tools/handlers/ContextBonsaiPruneHandler.ts`, `/home/basil/projects/context-bonsai-agents/cline/src/core/task/tools/handlers/ContextBonsaiRetrieveHandler.ts`, `/home/basil/projects/context-bonsai-agents/cline/src/core/task/tools/handlers/SummarizeTaskHandler.ts`, `/home/basil/projects/context-bonsai-agents/cline/src/core/hooks/precompact-executor.ts`, `/home/basil/projects/context-bonsai-agents/cline/src/core/task/message-state.ts`, `/home/basil/projects/context-bonsai-agents/cline/src/core/context/context-management/ContextManager.ts`, `/home/basil/projects/context-bonsai-agents/cline/src/shared/tools.ts`, `/home/basil/projects/context-bonsai-agents/cline/src/core/task/tools/ToolExecutorCoordinator.ts`, `/home/basil/projects/context-bonsai-agents/cline/src/core/prompts/system-prompt/index.ts`, `/home/basil/projects/context-bonsai-agents/cline/src/core/prompts/system-prompt/tools/init.ts`, `/home/basil/projects/context-bonsai-agents/cline/src/core/prompts/system-prompt/tools/context-bonsai-prune.ts`, `/home/basil/projects/context-bonsai-agents/cline/src/core/prompts/system-prompt/tools/context-bonsai-retrieve.ts`, `/home/basil/projects/context-bonsai-agents/cline/src/core/storage/disk.ts`, `/home/basil/projects/context-bonsai-agents/cline/proto/cline/hooks.proto`, `/home/basil/projects/context-bonsai-agents/cline/src/core/hooks/hook-factory.ts`, `/home/basil/projects/context-bonsai-agents/cline/src/core/hooks/templates.ts`, `/home/basil/projects/context-bonsai-agents/cline/webview-ui/src/components/chat/task-header/ContextWindow.tsx`, `/home/basil/projects/context-bonsai-agents/cline/webview-ui/src/components/chat/task-header/ContextWindowSummary.tsx`
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
