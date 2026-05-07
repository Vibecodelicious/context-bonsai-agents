# Story: Prune tool + archive store + context transform

**Epic:** Port context-bonsai to Pi as a first-party extension
**Size:** Large
**Dependencies:** Story 1 (package scaffold must exist)

## Story Description

Add the core value of context-bonsai: archive a contiguous range of messages so subsequent LLM calls see a compact placeholder instead.

This story:
1. Ports `prune-pattern.ts` + `prune-pattern-matcher.ts` from OpenCode (pure logic, no Pi deps).
2. Defines an archive schema + in-memory archive store, persisted via `pi.appendEntry("context-bonsai:archive", ...)` and rebuilt on `session_start` by scanning `sessionManager.getEntries()` for that `customType`.
3. Registers `context-bonsai-prune` as an LLM-callable tool. Tool execution resolves `from_pattern`/`to_pattern` against entries on the current branch, validates the range, and writes an archive record that includes **both** the entry ids and the `(role, timestamp)` pairs of the anchor and range-end messages so later correlation is robust to compaction.
4. Registers a `"context"` event handler that locates each active archive's anchor inside `event.messages` by matching `(role, timestamp)` — **not** by positional zip. `buildSessionContext` (`session-manager.ts:376-419`) prepends a synthetic compaction-summary message when a `CompactionEntry` is on the branch, drops entries before `firstKeptEntryId`, and injects synthetics for `branch_summary` / `custom_message` entries, so a naive `getBranch().filter(e => e.type === "message")` zip is **wrong**. Once located, the handler replaces the anchor's content with the placeholder text (same format as OpenCode: `[PRUNED: <anchorEntryId> to <rangeEndEntryId>]\nSummary: …\nIndex: …`), and elides followers up to the matched range-end position.

The gauge does **not** go in this story — Story 4 adds the gauge into the same `"context"` handler.

## User Model

### User Gamut
- Operator in a multi-hour session who wants a pruning tool the model can call autonomously.
- Reviewer inspecting a session file after the fact to understand what was archived and why.
- Downstream extension author whose `"context"` handler runs after this one and must tolerate rewritten messages.

### User-Needs Gamut
- After a prune call, the next LLM turn must see fewer tokens (placeholder replaces range).
- After `/reload` or a session resume, the pruned range must still render as a placeholder.
- Forking to a different branch that doesn't include the anchor entry must quietly drop that archive (anchor is no longer "on the current branch").
- The tool must refuse pattern matches that produce ambiguous or malformed ranges with an explicit error (pattern-boundary validation).

### Design Implications
- Keep archive state off the wire-message object — use a separate Map keyed by `SessionEntry.id`. This is the structural concession because `@mariozechner/pi-ai` `Message` has no id field (`node_modules/@mariozechner/pi-ai/dist/types.d.ts:107-132`).
- Correlation between `AgentMessage[]` (event input) and archive anchors uses `(role, timestamp)` lookup inside `event.messages`, NOT positional zip against the branch. `buildSessionContext` can inject synthetic messages (compaction summary at index 0, branch-summary messages) and drop entries before `firstKeptEntryId`, so the only reliable identifier shared between the session file and the outgoing transcript is the message's own `timestamp` combined with its `role`.
- If either the anchor or the range-end message cannot be located by `(role, timestamp)` in a given `"context"` event, the archive is silently skipped for that turn (it was compacted away or the branch changed). The archive record stays persisted — it becomes active again if the branch changes back.

### What we are NOT porting from OpenCode (and why)

OpenCode's plugin carries three pieces of machinery that exist only to compensate for OpenCode's runtime shape or to guard scenarios that are benign in Pi. Do not port them.

1. **`runtime-compat.ts` / `updateMessageAtomic` / `LOAD_MESSAGES_COMPAT_ERROR` / `UPDATE_MESSAGE_COMPAT_ERROR`.** OpenCode uses `client.session.updateMessageAtomic(ctx, id, mutate)` (`opencode_context_bonsai_plugin/src/runtime-compat.ts:68-78`) to mutate `msg.info.metadata` in place with locking because OpenCode's session can be shared and mutated concurrently. Pi has no such surface: archive state is appended via `pi.appendEntry(customType, data)`, which resolves to `SessionManager._persist` → `appendFileSync` (`packages/coding-agent/src/core/session-manager.ts:801-819`) in a single-process agent. Each write is atomic by virtue of the filesystem call. The entire `runtime-compat` abstraction is dead weight in Pi. Do not add any equivalent. Do not introduce a mutex, lock file, or "atomic update" wrapper.
2. **`idVisibility` state + the text-part ID-prefixing transform** (`opencode_context_bonsai_plugin/src/state.ts:10,20-21`; applied in `index.ts:79-104`). OpenCode's placeholder does not carry the anchor id, so the plugin prefixes every text part with `[msg:<id>]` at transform time, gated by a flag. Pi's placeholder `[PRUNED: <anchorEntryId> to <rangeEndEntryId>]` already contains the id, so the model reads it directly and passes it back to `context-bonsai-retrieve`. No prefixing, no visibility flag, no `setIdVisibility`.
3. **`sameStepPrunes` + the same-step retrieve guard** (`opencode_context_bonsai_plugin/src/state.ts:11,23-24,29-31`; checked in `retrieve.ts:41-44`). OpenCode errors when the model tries to retrieve an archive it just created in the same turn. The stated intent is "prevent wasted round-trips" but the guard is cost-positive: the prune has already executed (the archive entry is written), so rejecting the retrieve just forces the model into *another* turn of reasoning plus a retry. Net effect with the guard: more tokens burnt. Net effect without the guard: archive entry and tombstone entry both land in the session file (audit-clean), and the `"context"` handler's tombstone-wins hydration in Story 2 produces exactly the undo the model asked for. Drop the guard, drop the state, drop the error string. Prune+retrieve in the same turn is a supported no-op.

### Same-turn race that IS real in Pi (and the fix)

Pi's tool-execution mode defaults to `"parallel"` (`packages/agent/src/types.ts:36-47`). If the model emits two `context-bonsai-prune` calls in one assistant message, both `execute` bodies run concurrently: each captures `ctx.sessionManager.getBranch()` and its own archive validation before the other's `pi.appendEntry` lands, so two overlapping archives can end up in the session file. The fix is to set `executionMode: "sequential"` on the prune `ToolDefinition` (per `packages/coding-agent/src/core/extensions/types.ts:443-447`). This serialises the tool's own calls without affecting anything else. Story 2's acceptance criteria below require this flag; Story 3 does the same for retrieve for symmetry.

## Acceptance Criteria

- [ ] `packages/context-bonsai/src/prune-pattern.ts` and `prune-pattern-matcher.ts` ported from OpenCode with unit-test parity (port the existing tests too, adapted to Pi's `SessionEntry` shape where they previously used OpenCode message shape).
- [ ] `packages/context-bonsai/src/archive-store.ts` exposes:
  - `type Archive = { anchorEntryId: string; anchorRole: "user"|"assistant"|"toolResult"; anchorTimestamp: number; rangeEndEntryId: string; rangeEndRole: "user"|"assistant"|"toolResult"; rangeEndTimestamp: number; summary: string; indexTerms: string[]; reason?: string; createdInTurn: number }`
  - `class ArchiveStore` with `get(anchorEntryId)`, `set(archive)`, `clear(anchorEntryId)`, `listActive(branchEntryIds: Set<string>): Archive[]`, `hydrateFromEntries(entries: SessionEntry[])`.
  - `hydrateFromEntries` honours tombstone precedence: later `customType === "context-bonsai:archive-clear"` entries (Story 3) override earlier archives for the same `anchorEntryId`.
- [ ] `packages/context-bonsai/src/state.ts` exposes per-session state: just `turnCount: number` (used by Story 4's gauge cadence). **Does NOT include** `sameStepPrunes`, `idVisibility`, `tokenCache`, or `modelLimitCache` — all omitted deliberately, see "What we are NOT porting from OpenCode".
- [ ] `packages/context-bonsai/src/prune.ts` exports a `ToolDefinition` registered via `pi.registerTool` with the OpenCode name `context-bonsai-prune` and identical `description`/`parameters`. **Sets `executionMode: "sequential"`** (`extensions/types.ts:443-447`) to serialise the model's own concurrent calls — this is the one real same-turn race, and sequential mode fixes it without any locking infrastructure. Execution body:
  - Loads branch via `ctx.sessionManager.getBranch()`, filters `SessionMessageEntry`.
  - Resolves `from_pattern` and `to_pattern` to entry ids using ported matcher logic.
  - Validates: non-empty summary/index_terms, from precedes to, neither within an already-pruned range, no incomplete tool calls in range.
  - Captures `(role, timestamp)` from both message entries' wrapped `message` object.
  - Persists archive via `pi.appendEntry("context-bonsai:archive", archive)` — record includes the `(role, timestamp)` pairs alongside the entry ids. No `updateMessageAtomic`-style wrapper; the append is the atomic unit.
  - Updates `ArchiveStore` (no `sameStepPrunes` — that state doesn't exist in Pi's port).
  - Returns the same success string as OpenCode (`Archived N messages from pattern "X" ...`).
  - Does NOT call `setIdVisibility`: the placeholder carries the id already.
- [ ] `packages/context-bonsai/src/context-transform.ts` exports `createContextHandler(store, state)` wired via `pi.on("context", handler)` that:
  - Does **not** positional-zip against the branch. Instead:
    1. Builds a `branchEntryIds: Set<string>` from `ctx.sessionManager.getBranch()` so it can filter `store.listActive(branchEntryIds)` to archives whose anchor entry is still on the current branch.
    2. For each active archive, locates the anchor inside `event.messages` by scanning for the first message where `message.role === anchorRole && message.timestamp === anchorTimestamp`.
    3. Locates the range-end the same way, searching from the anchor index forward.
    4. If either match fails (anchor compacted away, branch switched), silently skip that archive — do NOT throw.
    5. Replaces the anchor message with a shallow-cloned user-role message whose `content` is a single `TextContent` with the placeholder text `[PRUNED: <anchorEntryId> to <rangeEndEntryId>]\nSummary: …\nIndex: …`, preserving the original `timestamp` so re-lookup on later turns still works.
    6. Removes messages between anchor-index+1 and range-end-index inclusive.
  - Returns `{ messages }` with the rewrites applied. Multiple archives on the same transcript are applied in document order.
- [ ] `pi.on("session_start", ...)` rebuilds the store from `sessionManager.getEntries()` scanning for `type === "custom" && customType === "context-bonsai:archive"`. Later `customType === "context-bonsai:archive-clear"` entries override earlier archives for the same `anchorEntryId` (tombstone semantics — Story 3 writes these).
- [ ] Unit tests cover: pattern resolution (port existing OpenCode tests), archive store hydrate/clear, validation errors.
- [ ] Integration test `packages/coding-agent/test/suite/context-bonsai/02-prune.test.ts`:
  - Faux-provider transcript with ~8 messages (mixed user/assistant/toolResult).
  - Model calls `context-bonsai-prune` with patterns covering messages 2..5.
  - Assert the transcript sent to the next LLM call contains the placeholder at the anchor position and has the 3..5 range elided (assert via inspecting messages delivered to the faux provider, or via a test-only extension that records its own `"context"` handler output downstream of ours).
  - Force a reload (re-instantiate `SessionManager` from the same session file + re-run `session_start`) and assert the transform still produces the same output.
- [ ] Integration test `packages/coding-agent/test/suite/context-bonsai/02b-prune-with-compaction.test.ts`:
  - Seed a session that contains a `CompactionEntry` on the branch plus a `BranchSummaryEntry` (use `SessionManager` APIs directly in the test setup).
  - Prune a range after both synthetics, then assert the `"context"` event's delivered transcript has the placeholder in the right position and the synthetics are undisturbed.
  - This test is the regression guard for the buildSessionContext divergence described in the Story Description.
- [ ] `npm run check` passes.

## Context References

### Relevant Codebase Files (must read)
- `packages/coding-agent/src/core/session-manager.ts:44-148` — SessionEntry shapes and CustomEntry semantics.
- `packages/coding-agent/src/core/session-manager.ts:370-422` — **`buildSessionContext`**, the function that produces the `AgentMessage[]` the `"context"` handler receives. Read this carefully; it explains the compaction-summary synthetic, the `firstKeptEntryId` window, and the `custom_message` / `branch_summary` synthetic injection that make positional zip unsafe.
- `packages/coding-agent/src/core/session-manager.ts` — `getBranch`, `getEntries`, `getLeafId`, `appendEntry` path.
- `packages/coding-agent/src/core/extensions/runner.ts:809-839` — how `emitContext` calls the handler and consumes `ContextEventResult.messages` (note `structuredClone` at line 811 — identity-based matching is not safe).
- `packages/coding-agent/src/core/extensions/types.ts:420-484` — `ToolDefinition` contract and `defineTool`.
- `packages/coding-agent/src/core/extensions/types.ts:1173-1175` — `pi.appendEntry(customType, data)`.
- `packages/coding-agent/test/suite/harness.ts` and `test/utilities.ts:180-205` — integration test plumbing.
- `/home/basil/projects/opencode_context_bonsai_plugin/src/prune.ts`
- `/home/basil/projects/opencode_context_bonsai_plugin/src/prune-pattern.ts`
- `/home/basil/projects/opencode_context_bonsai_plugin/src/prune-pattern-matcher.ts`
- `/home/basil/projects/opencode_context_bonsai_plugin/src/prune-pattern.test.ts`
- `/home/basil/projects/opencode_context_bonsai_plugin/src/prune.test.ts`
- `/home/basil/projects/opencode_context_bonsai_plugin/src/schema.ts` — archive metadata shape to port.
- `/home/basil/projects/opencode_context_bonsai_plugin/src/state.ts` — per-session state module to port.

### New Files to Create
- `packages/context-bonsai/src/prune-pattern.ts`
- `packages/context-bonsai/src/prune-pattern-matcher.ts`
- `packages/context-bonsai/src/archive-store.ts`
- `packages/context-bonsai/src/state.ts`
- `packages/context-bonsai/src/schema.ts`
- `packages/context-bonsai/src/prune.ts`
- `packages/context-bonsai/src/context-transform.ts`
- `packages/context-bonsai/test/prune-pattern.test.ts` (port)
- `packages/context-bonsai/test/archive-store.test.ts`
- `packages/context-bonsai/test/prune-validation.test.ts`
- `packages/context-bonsai/test/context-transform.test.ts` — unit tests for the `(role, timestamp)` lookup algorithm against a hand-built `event.messages` array (no harness needed).
- `packages/coding-agent/test/suite/context-bonsai/02-prune.test.ts`
- `packages/coding-agent/test/suite/context-bonsai/02b-prune-with-compaction.test.ts` — buildSessionContext-divergence regression guard.

### Files Modified
- `packages/context-bonsai/src/index.ts` — factory now registers prune tool, session_start handler, and context handler (in addition to before_agent_start from Story 1).

### Relevant Documentation
- `AGENTS.md` — test placement and naming rules.

## Implementation Plan

### Phase 1: Pure-logic modules (no Pi deps)
- Port `prune-pattern.ts`, `prune-pattern-matcher.ts`, `schema.ts` verbatim where the shape allows. Rewrite the `WithParts`-based helpers in `prune.ts` against Pi's `SessionMessageEntry` + `AgentMessage`.
- Port `state.ts` **selectively**: keep `turnCount` only. Drop `sameStepPrunes`, `idVisibility`, `tokenCache`, `modelLimitCache` (Pi has `ctx.getContextUsage()`, covered in Story 4).
- Do NOT port `runtime-compat.ts`. Pi's `pi.appendEntry` is the atomic write primitive.
- Implement `ArchiveStore` + `hydrateFromEntries`.
- Port the matching unit tests.

### Phase 2: Prune tool
- Implement `createPruneTool(store, state)` returning a `ToolDefinition`. Use `typebox` for the parameter schema (see existing Pi tools like `packages/coding-agent/src/core/tools/edit.ts` for the pattern).
- Execution reads `ctx.sessionManager.getBranch()`, runs matcher, validates, persists via `pi.appendEntry`, updates state.

### Phase 3: Context transform
- Implement `createContextHandler(store, state)` using the `(role, timestamp)` lookup algorithm. Do NOT positional-zip. Do NOT throw on match failure — silently skip.
- Apply archives in document order to avoid index shifting before all lookups complete (strategy: compute all `(anchorIdx, rangeEndIdx)` pairs up-front on the unmodified array, then build a new array in one pass).

### Phase 4: Wire into factory
- Update `src/index.ts` to:
  ```ts
  const store = new ArchiveStore();
  const state = createState();
  pi.on("session_start", (e, ctx) => store.hydrateFromEntries(ctx.sessionManager.getEntries()));
  pi.registerTool(createPruneTool(store, state));
  pi.on("context", createContextHandler(store, state));
  ```

### Phase 5: Tests
- Unit tests for matcher, validation, store hydration + tombstone precedence.
- Integration test 02-prune.test.ts.

### Phase 6: Gates
- `npm run check` and named-test runs must all pass before commit.

## Step-by-Step Tasks

1. Re-read all OpenCode source files listed in Context References.
2. Port `prune-pattern.ts` + matcher + their tests into `packages/context-bonsai/`. Make matcher operate on `SessionEntry[]` rather than OpenCode's `WithParts`.
3. Port `schema.ts`, `state.ts`.
4. Implement `archive-store.ts` with `hydrateFromEntries` that honours tombstones (Story 3 will write them; implement the precedence here).
5. Implement `prune.ts` tool factory.
6. Implement `context-transform.ts`.
7. Wire all of the above into `src/index.ts`.
8. Write unit tests for pattern matcher (ported), archive store, and prune validation.
9. Write integration test `02-prune.test.ts` including the reload scenario.
10. Run validation commands; fix failures; commit as `[Story 1.2] context-bonsai prune tool + archive store + context transform`.

## Testing Strategy

- **Unit**: pattern-matcher parity with ported OpenCode tests; archive-store hydration incl. tombstone precedence; prune-validation error paths.
- **Integration**: faux-provider session, prune call, assert next `"context"` event delivers placeholder + elided range; reload persists.

## Validation Commands

Per `AGENTS.md`: use the vitest CLI form for named tests.

- `cd /home/basil/projects/context-bonsai-pi && npm run check`
- `cd /home/basil/projects/context-bonsai-pi/packages/context-bonsai && npx tsx ../../node_modules/vitest/dist/cli.js --run test/`
- `cd /home/basil/projects/context-bonsai-pi/packages/coding-agent && npx tsx ../../node_modules/vitest/dist/cli.js --run test/suite/context-bonsai/02-prune.test.ts test/suite/context-bonsai/02b-prune-with-compaction.test.ts`

## Worktree Artifact Check

- Checked At: 2026-04-23
- Planned Target Files: `packages/context-bonsai/src/prune-pattern.ts`, `packages/context-bonsai/src/prune-pattern-matcher.ts`, `packages/context-bonsai/src/archive-store.ts`, `packages/context-bonsai/src/state.ts`, `packages/context-bonsai/src/schema.ts`, `packages/context-bonsai/src/prune.ts`, `packages/context-bonsai/src/context-transform.ts`, `packages/context-bonsai/src/index.ts` (modified), `packages/context-bonsai/test/prune-pattern.test.ts`, `packages/context-bonsai/test/archive-store.test.ts`, `packages/context-bonsai/test/prune-validation.test.ts`, `packages/context-bonsai/test/context-transform.test.ts`, `packages/coding-agent/test/suite/context-bonsai/02-prune.test.ts`, `packages/coding-agent/test/suite/context-bonsai/02b-prune-with-compaction.test.ts`
- Overlaps Found: `packages/context-bonsai/src/index.ts` → will be `tracked-dirty` relative to Story 1's commit by design (this is an expected in-epic modification, not a pre-existing dirty artifact). All other paths are absent at the start of the epic.
- Escalation Status: none (in-epic modification of Story 1's output is not an escalation trigger).
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
