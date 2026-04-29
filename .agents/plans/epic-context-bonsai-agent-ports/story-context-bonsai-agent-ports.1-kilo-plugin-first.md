# Story: Kilo/OpenCode plugin-first implementation plan

**Epic:** Context Bonsai Agent Ports
**Size:** Large
**Dependencies:** None

## Story Description

Port Context Bonsai to Kilo CLI with the least possible shared-core drift.

The bulk of the port lives in the `kilo_context_bonsai` side-project submodule. Kilo's agent repo only receives narrow capability-enabling seams:

- plugin activation in `.opencode/opencode.jsonc` pointing at the side-project artifact
- optional gauge-telemetry fields on `experimental.chat.messages.transform` and `experimental.chat.system.transform` inputs so the plugin can render the in-band gauge (the one shared-core capability seam, marked with `kilocode_change`)
- a minimal seam integration test under `packages/opencode/test/kilocode/`

Plugin logic (prune, retrieve, placeholder rendering, gauge severity bands, guards, archive store) lives in `kilo_context_bonsai/src/*`. Side-repo tests run under `bun:test` without touching the Kilo runtime.

Archive persistence for v1 remains plugin-managed sidecar storage keyed by `sessionID`. The plugin reads `sessionID` from `output.messages[*].info.sessionID` inside message transform, so no session-identity seam is required.

The implementation should target full bonsai parity:
- `context-bonsai-prune`
- `context-bonsai-retrieve`
- placeholder rendering in the model-facing message transform
- in-band gauge injection
- system guidance injection
- persisted archive state compatible with session reload

## Architecture Split

- **Side repo (`kilo_context_bonsai`)**: plugin source, guards, archive store, gauge, placeholder, all tests that do not require the Kilo runtime. Authoritative coding standards: `kilo_context_bonsai/STANDARDS.md`.
- **Agent repo (`kilo`)**: `.opencode/opencode.jsonc` plugin entry, the gauge-telemetry hook-input seam in shared OpenCode files (each touched file marked with `kilocode_change` per `AGENTS.md`), and a single seam integration test. Authoritative coding standards: `kilocode/AGENTS.md`.
- **Feature branch**: all agent-repo commits land on `feat/context-bonsai-port` inside the `kilo` submodule; side-repo commits land on `feat/context-bonsai-port` inside `kilo_context_bonsai`. The parent planning repo's submodule pointers are not advanced by this story.

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
- `/home/basil/projects/context-bonsai-agents/kilo/packages/plugin/src/index.ts` - plugin hook and tool contract
- `/home/basil/projects/context-bonsai-agents/kilo/packages/opencode/src/session/prompt.ts` - message transform application point
- `/home/basil/projects/context-bonsai-agents/kilo/packages/opencode/src/session/llm.ts` - system transform application point
- `/home/basil/projects/context-bonsai-agents/kilo/packages/opencode/src/session/compaction.ts` - existing compaction flow
- `/home/basil/projects/context-bonsai-agents/kilo/packages/opencode/src/session/message-v2.ts` - message info shape including `sessionID`
- `/home/basil/projects/context-bonsai-agents/kilo/packages/opencode/src/session/overflow.ts` - usable-budget logic for gauge data
- `/home/basil/projects/context-bonsai-agents/kilo/packages/opencode/src/tool/registry.ts` - tool registration and execution path
- `/home/basil/projects/context-bonsai-agents/kilo/AGENTS.md` - upstream-minimization and Kilo-marking rules

### New Files to Create (side repo: `kilo_context_bonsai/`)
- `/home/basil/projects/context-bonsai-agents/kilo_context_bonsai/package.json` - side-repo package manifest, `bun:test` dev dep, oxlint config reference
- `/home/basil/projects/context-bonsai-agents/kilo_context_bonsai/tsconfig.json` - side-repo TS config
- `/home/basil/projects/context-bonsai-agents/kilo_context_bonsai/src/plugin.ts` - default-exported plugin entry consumed by Kilo's `.opencode/opencode.jsonc`
- `/home/basil/projects/context-bonsai-agents/kilo_context_bonsai/src/guards.ts` - pattern resolution, boundary and same-step prune/retrieve guards (pure)
- `/home/basil/projects/context-bonsai-agents/kilo_context_bonsai/src/archive-store.ts` - plugin-managed archive persistence keyed by `sessionID`
- `/home/basil/projects/context-bonsai-agents/kilo_context_bonsai/src/gauge.ts` - severity-band logic from `usedTokens` / `usableBudget`
- `/home/basil/projects/context-bonsai-agents/kilo_context_bonsai/src/placeholder.ts` - placeholder rendering (anchor id, range end, summary, index terms)
- `/home/basil/projects/context-bonsai-agents/kilo_context_bonsai/test/plugin.test.ts` - plugin-level parity tests
- `/home/basil/projects/context-bonsai-agents/kilo_context_bonsai/test/guards.test.ts` - guard-path tests (unresolved/ambiguous boundary, same-step retrieve)
- `/home/basil/projects/context-bonsai-agents/kilo_context_bonsai/test/gauge.test.ts` - gauge band coverage
- `/home/basil/projects/context-bonsai-agents/kilo_context_bonsai/docs/story.md` - pointer to parent story plan

### New Files to Create (agent repo: `kilo/`)
- `/home/basil/projects/context-bonsai-agents/kilo/packages/opencode/test/kilocode/context-bonsai.test.ts` - seam integration test confirming gauge telemetry reaches the plugin

### Runtime-Created Files
- `.opencode/context-bonsai/<session-id>.json` inside the worktree where Kilo runs - plugin-managed archive metadata store

### Files Modified (agent repo: `kilo/`)
- `/home/basil/projects/context-bonsai-agents/kilo/.opencode/opencode.jsonc` - add a `plugin` entry pointing at the side-repo artifact. Kilo resolves plugin specs relative to the config file's directory (`kilocode/.opencode/`), so the correct relative path up to the planning repo root is THREE parent segments: `../../../kilo_context_bonsai/src/plugin.ts`. Validate the resolved path exists as part of the seam test.
- `/home/basil/projects/context-bonsai-agents/kilo/packages/plugin/src/index.ts` - extend `experimental.chat.messages.transform` input shape with optional gauge telemetry fields (`kilocode_change`)
- `/home/basil/projects/context-bonsai-agents/kilo/packages/opencode/src/session/llm.ts` - extend `experimental.chat.system.transform` input with the same optional gauge telemetry fields (`kilocode_change`)
- `/home/basil/projects/context-bonsai-agents/kilo/packages/opencode/src/agent/agent.ts` - extend the second `experimental.chat.system.transform` callsite with the same optional telemetry fields (`kilocode_change`)
- `/home/basil/projects/context-bonsai-agents/kilo/packages/opencode/src/session/prompt.ts` - pass gauge telemetry into plugin message-transform input (`kilocode_change`)
- `/home/basil/projects/context-bonsai-agents/kilo/packages/opencode/src/session/compaction.ts` - keep compaction-time transform invocation aligned with the same input shape (`kilocode_change`)

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

- `cd /home/basil/projects/context-bonsai-agents/kilo_context_bonsai && bun test`
- `cd /home/basil/projects/context-bonsai-agents/kilo_context_bonsai && bun run typecheck` (if tsconfig/typecheck script is defined)
- `cd /home/basil/projects/context-bonsai-agents/kilo && bun run --cwd packages/opencode test test/kilocode/context-bonsai.test.ts`
- `cd /home/basil/projects/context-bonsai-agents/kilo && bun run --cwd packages/opencode typecheck`
- `cd /home/basil/projects/context-bonsai-agents/kilo && bun turbo typecheck`

## Worktree Artifact Check

- Checked At: `2026-04-23`
- Planned Target Files: `/home/basil/projects/context-bonsai-agents/kilo/.opencode/plugins/context-bonsai.ts`, `/home/basil/projects/context-bonsai-agents/kilo/packages/opencode/test/kilocode/context-bonsai.test.ts`, `/home/basil/projects/context-bonsai-agents/kilo/.opencode/opencode.jsonc`, `/home/basil/projects/context-bonsai-agents/kilo/packages/plugin/src/index.ts`, `/home/basil/projects/context-bonsai-agents/kilo/packages/opencode/src/session/llm.ts`, `/home/basil/projects/context-bonsai-agents/kilo/packages/opencode/src/session/prompt.ts`, `/home/basil/projects/context-bonsai-agents/kilo/packages/opencode/src/session/compaction.ts`
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
