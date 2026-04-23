# Story: Kilo/OpenCode plugin-first implementation plan

**Epic:** Context Bonsai Agent Ports
**Size:** Large
**Dependencies:** None

## Story Description

Port Context Bonsai to Kilo CLI with the least possible shared-core drift.

Kilo is the strongest host in this workspace because it already exposes the two critical extension points: message transformation and system transformation. The implementation will be a repo-local plugin activated through `.opencode/opencode.jsonc`, with one capability-enabling shared-core change: extending hook input so gauge data reaches the plugin at every current `system.transform` caller.

Archive persistence for v1 is plugin-managed sidecar storage under the worktree-local `.opencode/context-bonsai/` directory, keyed one file per `sessionID`: `.opencode/context-bonsai/<sessionID>.json`.

Message transform can already recover `sessionID` from `output.messages[*].info.sessionID`, so no seam is required for session identity. The only required capability seam is on transform inputs for gauge telemetry: extend the hook input with `usedTokens`, `usableBudget`, and `percentUsed`, and make those fields optional so both current `system.transform` callers remain type-safe after `session/llm.ts` and `agent/agent.ts` are updated.

The implementation should target full bonsai parity:
- `context-bonsai-prune`
- `context-bonsai-retrieve`
- placeholder rendering in the model-facing message transform
- in-band gauge injection
- system guidance injection
- persisted archive state compatible with session reload

## User Model

### User Gamut
- Kilo CLI users in long-running coding sessions
- VS Code users whose extension runtime depends on the shared CLI engine
- maintainers responsible for upstream OpenCode sync hygiene
- reviewers who want proof that bonsai lives mostly plugin-side rather than as a permanent shared-core fork

### User-Needs Gamut
- full bonsai behavior with minimal merge-conflict exposure
- archive state that survives Kilo session persistence
- a plan that keeps the bonsai logic mostly in Kilo-owned plugin code
- tests that prove parity without requiring widespread shared-file changes

### Design Implications
- Prefer a single repo-local plugin file or a very small plugin module tree.
- Use existing `experimental.chat.messages.transform` and `experimental.chat.system.transform` hooks as the backbone.
- Keep shared-core changes limited to exposing gauge telemetry to plugin transforms.

## Acceptance Criteria

- [ ] Plan chooses a plugin-first implementation with bonsai logic living primarily outside shared OpenCode runtime files.
- [ ] Plan identifies a concrete archive-state strategy compatible with Kilo session storage and reload.
- [ ] Plan defines tool registration, message transform, system transform, and gauge injection paths.
- [ ] Plan defines where prune/retrieve guard semantics live: pattern resolution, malformed or incomplete boundary rejection, and same-step retrieve rejection.
- [ ] Plan identifies the concrete access path for gauge token and context-window data.
- [ ] Plan identifies the concrete access path for `sessionID` inside message transform.
- [ ] Plan adds targeted tests under Kilo-owned test paths rather than broad shared test churn.
- [ ] Validation commands are explicit and repo-correct.

## Context References

### Relevant Codebase Files (must read)
- `/home/basil/projects/context-bonsai-agents/context-bonsai-kilo/kilocode/packages/plugin/src/index.ts` - plugin hook and tool contract
- `/home/basil/projects/context-bonsai-agents/context-bonsai-kilo/kilocode/packages/opencode/src/session/prompt.ts` - message transform application point
- `/home/basil/projects/context-bonsai-agents/context-bonsai-kilo/kilocode/packages/opencode/src/session/llm.ts` - system transform application point
- `/home/basil/projects/context-bonsai-agents/context-bonsai-kilo/kilocode/packages/opencode/src/session/compaction.ts` - existing compaction flow
- `/home/basil/projects/context-bonsai-agents/context-bonsai-kilo/kilocode/packages/opencode/src/session/message-v2.ts` - message info shape including `sessionID`
- `/home/basil/projects/context-bonsai-agents/context-bonsai-kilo/kilocode/packages/opencode/src/session/overflow.ts` - usable-budget logic for gauge data
- `/home/basil/projects/context-bonsai-agents/context-bonsai-kilo/kilocode/packages/opencode/src/tool/registry.ts` - tool registration and execution path
- `/home/basil/projects/context-bonsai-agents/context-bonsai-kilo/kilocode/AGENTS.md` - upstream-minimization and Kilo-marking rules

### New Files to Create
- `/home/basil/projects/context-bonsai-agents/context-bonsai-kilo/kilocode/.opencode/plugins/context-bonsai.ts` - primary plugin implementation
- `/home/basil/projects/context-bonsai-agents/context-bonsai-kilo/kilocode/packages/opencode/test/kilocode/context-bonsai.test.ts` - targeted parity tests

### Runtime-Created Files
- `/home/basil/projects/context-bonsai-agents/context-bonsai-kilo/kilocode/.opencode/context-bonsai/<session-id>.json` - plugin-managed archive metadata store

### Files Modified
- `/home/basil/projects/context-bonsai-agents/context-bonsai-kilo/kilocode/.opencode/opencode.jsonc` - add a `plugin` entry pointing at `./plugins/context-bonsai.ts`
- `/home/basil/projects/context-bonsai-agents/context-bonsai-kilo/kilocode/packages/plugin/src/index.ts` - extend `experimental.chat.messages.transform` input shape with gauge telemetry fields
- `/home/basil/projects/context-bonsai-agents/context-bonsai-kilo/kilocode/packages/opencode/src/session/llm.ts` - extend `experimental.chat.system.transform` input with the same gauge telemetry fields
- `/home/basil/projects/context-bonsai-agents/context-bonsai-kilo/kilocode/packages/opencode/src/agent/agent.ts` - extend the second `experimental.chat.system.transform` callsite with the same optional telemetry fields
- `/home/basil/projects/context-bonsai-agents/context-bonsai-kilo/kilocode/packages/opencode/src/session/prompt.ts` - pass gauge telemetry into plugin message-transform input
- `/home/basil/projects/context-bonsai-agents/context-bonsai-kilo/kilocode/packages/opencode/src/session/compaction.ts` - keep compaction-time transform invocation aligned with the same input shape

### Relevant Documentation
- [kilo-context-bonsai-spec.md](/home/basil/projects/context-bonsai-agents/docs/agent-specs/kilo-context-bonsai-spec.md)
- [context-bonsai-agent-spec.md](/home/basil/projects/context-bonsai-agents/docs/context-bonsai-agent-spec.md)

## Implementation Plan

### Phase 1: Plugin skeleton and state model
- Create the repo-local plugin entry.
- Define archive metadata shape and per-session state inside plugin code.
- Persist archive metadata in `.opencode/context-bonsai/<session-id>.json` inside the worktree.

### Phase 2: Core bonsai behavior in plugin hooks
- Implement system guidance through system transform.
- Implement placeholder rendering and archived-range elision through message transform.
- Add gauge logic using a tiny capability-enabling seam that surfaces `usedTokens`, `usableBudget`, and `percentUsed` into plugin transform inputs.

### Phase 3: Tooling and persistence
- Register `context-bonsai-prune` and `context-bonsai-retrieve`.
- Persist archive state in a way that survives reload and allows retrieval by anchor.
- Implement prune/retrieve validation guards inside the plugin tool implementation so all parity-critical boundary checks live in one place.
- Keep shared-core touch limited to the gauge telemetry hook-input extension.

### Phase 4: Validation
- Add targeted Kilo tests.
- Run focused CLI/plugin tests and type checks.
- Confirm no unnecessary shared OpenCode files were touched.

## Step-by-Step Tasks

1. Create the repo-local plugin file and wire it into Kilo discovery.
2. Add `.opencode/opencode.jsonc` `plugin` activation for `./plugins/context-bonsai.ts`.
3. Implement archive metadata storage and plugin-local session state.
4. Add system guidance and message transform logic for placeholder rendering.
5. Add prune/retrieve tool definitions.
6. Add prune/retrieve guard logic for pattern resolution, malformed boundary rejection, and same-step retrieve blocking.
7. Extend transform hook inputs with `usedTokens`, `usableBudget`, and `percentUsed`.
8. Add in-band gauge injection.
9. Write targeted tests under `packages/opencode/test/kilocode/`, including guard-path and gauge-path tests.
10. Run validation commands and refine until green.

## Testing Strategy

- Unit/integration tests should focus on plugin behavior rather than shared runtime internals.
- Validate tool registration, placeholder rendering, archive persistence, retrieve roundtrip, and gauge injection.
- Prefer new dedicated tests over expanding large shared suites.

## Validation Commands

- `cd /home/basil/projects/context-bonsai-agents/context-bonsai-kilo/kilocode && bun run --cwd packages/opencode test test/kilocode/context-bonsai.test.ts`
- `cd /home/basil/projects/context-bonsai-agents/context-bonsai-kilo/kilocode && bun run --cwd packages/opencode typecheck`
- `cd /home/basil/projects/context-bonsai-agents/context-bonsai-kilo/kilocode && bun turbo typecheck`

## Worktree Artifact Check

- Checked At: `2026-04-23`
- Planned Target Files: `/home/basil/projects/context-bonsai-agents/context-bonsai-kilo/kilocode/.opencode/plugins/context-bonsai.ts`, `/home/basil/projects/context-bonsai-agents/context-bonsai-kilo/kilocode/packages/opencode/test/kilocode/context-bonsai.test.ts`, `/home/basil/projects/context-bonsai-agents/context-bonsai-kilo/kilocode/.opencode/opencode.jsonc`, `/home/basil/projects/context-bonsai-agents/context-bonsai-kilo/kilocode/packages/plugin/src/index.ts`, `/home/basil/projects/context-bonsai-agents/context-bonsai-kilo/kilocode/packages/opencode/src/session/llm.ts`, `/home/basil/projects/context-bonsai-agents/context-bonsai-kilo/kilocode/packages/opencode/src/session/prompt.ts`, `/home/basil/projects/context-bonsai-agents/context-bonsai-kilo/kilocode/packages/opencode/src/session/compaction.ts`
- Overlaps Found: `none`
- Escalation Status: `none`
- Decision Citation: `none`

## Plan Approval and Commit Status

- Approval Status: `pending`
- Approval Citation: `none`
- Plan Commit Hash: `none`
- Ready-for-Orchestration: `no`

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
