# Story: Retrieve tool

**Epic:** Port context-bonsai to Pi as a first-party extension
**Size:** Small
**Dependencies:** Story 2 (requires `ArchiveStore`, `state`, and the `"context"` handler wired in)

## Story Description

Add `context-bonsai-retrieve`: an LLM-callable tool that clears a previously-written archive so the next `"context"` event no longer elides that range. Persistence is via a tombstone custom entry (`customType: "context-bonsai:archive-clear"`) so a reload still reflects the retrieval.

**No same-step guard.** OpenCode errors when the model tries to retrieve an archive it just created in the same turn. Pi deliberately drops this. A same-turn prune+retrieve pair produces an archive entry followed by a tombstone entry in the session JSONL; the next `"context"` hydration applies tombstone-wins precedence (from Story 2's `ArchiveStore.hydrateFromEntries`) and the model sees the original transcript — exactly the undo it requested. Rejecting retrieve in this case forces the model into another turn of reasoning plus a retry, burning more tokens than just letting the call succeed. The `state.sameStepPrunes` field does not exist in Pi's state module.

As with prune, the retrieve tool is registered with `executionMode: "sequential"` (`extensions/types.ts:443-447`) so two parallel retrieves against the same anchor cannot race each other's "archive exists?" check. Pi does NOT port OpenCode's `runtime-compat.ts` / `updateMessageAtomic` abstraction — `pi.appendEntry` is the atomic primitive.

## User Model

### User Gamut
- Operator whose agent pruned too aggressively and wants the original content back mid-session.
- Session-history auditor who wants the session file to record both the archive and its subsequent retrieval.
- Model that prunes and then immediately realises it needs the content — a same-turn retrieve should just work.

### User-Needs Gamut
- After a successful retrieve, the next LLM turn must show the original messages.
- Retrieval must survive reload (tombstone persisted).
- Prune+retrieve in one assistant message must be a supported no-op, not an error.

### Design Implications
- Tombstone semantics are cleaner than "delete the archive custom entry" because the session file is append-only; both entries stay on record for audit.
- `ArchiveStore.hydrateFromEntries` (Story 2) already honours tombstone precedence — this story just writes the tombstone.

## Acceptance Criteria

- [ ] `packages/context-bonsai/src/retrieve.ts` exports `createRetrieveTool(store)` returning a `ToolDefinition` with name `context-bonsai-retrieve`, description and args identical to OpenCode's `retrieve.ts`, **and `executionMode: "sequential"`** for parity with prune. Signature takes the store only — there is no `state` parameter because no same-step guard exists.
- [ ] Execution:
  - Look up `anchor_id` in `ArchiveStore`. Return an `Error: No archive found for message ...` string if absent.
  - Persist tombstone: `pi.appendEntry("context-bonsai:archive-clear", { anchorEntryId })`. No atomic-update wrapper, no lock — `appendFileSync` is the atomic unit.
  - Remove from in-memory store.
  - Return the success string: `Restored N messages from range <anchor> to <rangeEnd>. Original content is now visible.`
- [ ] `src/index.ts` registers the new tool: `pi.registerTool(createRetrieveTool(store))`.
- [ ] Unit test: archive found → tombstone written + store cleared; archive absent → error string.
- [ ] Unit test: same-turn prune+retrieve produces two custom entries and a hydrated store where the archive is absent (tombstone wins). No error.
- [ ] Integration test `packages/coding-agent/test/suite/context-bonsai/03-retrieve.test.ts`:
  - Prime the session with an existing archive (call prune on turn N, then user+assistant on turn N+1, then retrieve).
  - Assert the `"context"` event after retrieve delivers the original un-elided transcript.
  - Reload the session and assert the tombstone sticks (archive stays cleared).
- [ ] Integration test `packages/coding-agent/test/suite/context-bonsai/03b-same-turn-prune-retrieve.test.ts`:
  - Faux provider emits one assistant message that calls prune then retrieve with the same `anchor_id` in the same tool-call batch.
  - Assert both tool results are success.
  - Assert the session file has one `context-bonsai:archive` entry and one `context-bonsai:archive-clear` entry.
  - Assert the next `"context"` event delivers the original un-elided transcript.
- [ ] `npm run check` passes.

## Context References

### Relevant Codebase Files (must read)
- `packages/context-bonsai/src/archive-store.ts` (from Story 2) — API used here. Tombstone-wins precedence is already implemented in `hydrateFromEntries`.
- `packages/coding-agent/src/core/session-manager.ts:98-102` — `CustomEntry` format for tombstones.
- `/home/basil/projects/opencode_context_bonsai_plugin/src/retrieve.ts` — reference port. **Do not port the same-step guard** (lines 41-44 in the source); see Story 2's "What we are NOT porting from OpenCode" section.

### New Files to Create
- `packages/context-bonsai/src/retrieve.ts`
- `packages/context-bonsai/test/retrieve.test.ts`
- `packages/coding-agent/test/suite/context-bonsai/03-retrieve.test.ts`
- `packages/coding-agent/test/suite/context-bonsai/03b-same-turn-prune-retrieve.test.ts`

### Files Modified
- `packages/context-bonsai/src/index.ts` — register retrieve tool.

## Implementation Plan

### Phase 1: Tool
- Implement `createRetrieveTool(store)`.
- `execute` reads from store, writes tombstone, mutates store, returns string. Set `executionMode: "sequential"`.

### Phase 2: Wire-up
- Update `src/index.ts` factory to `pi.registerTool(createRetrieveTool(store))`.

### Phase 3: Tests
- Unit test covering archive-found and archive-absent paths.
- Unit test covering same-turn prune+retrieve tombstone precedence.
- Integration test covering full prune→turn→retrieve→next turn flow, plus reload persistence.
- Integration test covering same-turn prune+retrieve (one assistant message, both tool calls succeed, next context is un-elided).

### Phase 4: Gates
- `npm run check`, package tests, named integration test pass.

## Step-by-Step Tasks

1. Read `/home/basil/projects/opencode_context_bonsai_plugin/src/retrieve.ts`.
2. Implement `src/retrieve.ts`.
3. Add registration in `src/index.ts`.
4. Write unit test `test/retrieve.test.ts`.
5. Write integration test `test/suite/context-bonsai/03-retrieve.test.ts`.
6. Run validation commands; fix issues.
7. Commit as `[Story 1.3] context-bonsai retrieve tool`.

## Testing Strategy

- **Unit**: same-step guard, tombstone write path.
- **Integration**: full round-trip incl. reload persistence of tombstone.

## Validation Commands

Per `AGENTS.md`: use the vitest CLI form for named tests.

- `cd /home/basil/projects/context-bonsai-pi && npm run check`
- `cd /home/basil/projects/context-bonsai-pi/packages/context-bonsai && npx tsx ../../node_modules/vitest/dist/cli.js --run test/retrieve.test.ts`
- `cd /home/basil/projects/context-bonsai-pi/packages/coding-agent && npx tsx ../../node_modules/vitest/dist/cli.js --run test/suite/context-bonsai/03-retrieve.test.ts`

## Worktree Artifact Check

- Checked At: 2026-04-23
- Planned Target Files: `packages/context-bonsai/src/retrieve.ts`, `packages/context-bonsai/src/index.ts` (modified), `packages/context-bonsai/test/retrieve.test.ts`, `packages/coding-agent/test/suite/context-bonsai/03-retrieve.test.ts`, `packages/coding-agent/test/suite/context-bonsai/03b-same-turn-prune-retrieve.test.ts`
- Overlaps Found: `packages/context-bonsai/src/index.ts` will again be modified from prior story output (in-epic).
- Escalation Status: none
- Decision Citation: n/a

## Plan Approval and Commit Status

- Approval Status: approved
- Approval Citation: user message 2026-04-23 "Do commit the plan" (auto mode)
- Plan Commit Hash: 45df8a33 (`docs: approved plans for context-bonsai port epic`)
- Ready-for-Orchestration: yes (orchestration deferred per user instruction in same exchange)

## Completion Checklist

- [ ] All acceptance criteria met
- [ ] Validation commands pass
- [ ] Plan approved and committed before orchestration begins
- [ ] User-model ambiguities resolved or escalated
- [ ] Worktree artifact overlaps resolved (approved direction or explicit deferral)
