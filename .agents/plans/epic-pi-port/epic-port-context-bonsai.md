# Epic: Port context-bonsai to Pi as a first-party extension

**Goal:** Bring OpenCode's context-bonsai surgical-pruning capability to Pi as an opt-in extension package (`packages/context-bonsai/`), delivering the four hooks (prune tool, retrieve tool, context transform with archive placeholders, system-reminder gauge, system-prompt guidance) via Pi's existing `ExtensionAPI`.
**Depends on:** None (Pi already exposes the full surface area needed — `pi.registerTool`, `pi.on("context")`, `pi.on("before_agent_start")`, `pi.appendEntry`, `ctx.sessionManager`, `ctx.getContextUsage`).
**Parallel with:** None — the stories are sequential because each depends on the scaffold produced by the previous.
**Complexity:** Medium

## Strategic Context

The OpenCode plugin lives at `/home/basil/projects/opencode_context_bonsai_plugin/src/` and is the reference implementation. The port is straightforward in logic terms; the one structural change is that Pi's wire messages (`@mariozechner/pi-ai` `Message`) do not carry per-message ids, so archive state is keyed on Pi's `SessionEntry.id` (uuidv7 at `packages/coding-agent/src/core/session-manager.ts:46`) rather than on a message id baked into the message itself.

Archive persistence uses `pi.appendEntry("context-bonsai:archive", {...})` (a `CustomEntry` in the session file); on `session_start` the extension rebuilds its in-memory map by scanning `ctx.sessionManager.getEntries()` for that customType.

The `"context"` event (emitted in `packages/coding-agent/src/core/extensions/runner.ts:809 emitContext`) is the exact primitive that corresponds to OpenCode's `experimental.chat.messages.transform`. It receives `AgentMessage[]`, gets a structuredClone, and the returned `{ messages }` replaces the outgoing transcript.

**Critical correlation invariant.** The `AgentMessage[]` delivered to `"context"` is produced by `sessionManager.buildSessionContext()` (`session-manager.ts:376-419`), which is **not** a 1:1 projection of `getBranch().filter(e => e.type === "message")`. It may prepend a synthetic compaction-summary message, drop entries before `firstKeptEntryId`, and inject synthetics for `branch_summary` / `custom_message` entries. The extension therefore locates archived anchors in the outgoing transcript by matching on `(role, timestamp)` rather than by position. The archive record stores both fields for both the anchor and the range end; if a match is not found (e.g. the anchor was compacted away or the branch changed), the archive is silently skipped for that turn.

**Concurrency model — do not port OpenCode's race-prevention plumbing, and drop its cost-positive semantic guard.** OpenCode's plugin carries three pieces of machinery Pi does not need: (a) the `runtime-compat.ts` atomic-update abstraction (OpenCode mutates shared message objects in place under locking), (b) the `idVisibility` text-prefixing mechanism (OpenCode's placeholder does not carry the anchor id), and (c) the `sameStepPrunes` guard that errors on same-turn prune+retrieve (intended to prevent "wasted round-trips" but is itself net-negative on tokens — see Story 2). Pi replaces all three with: `pi.appendEntry` → `appendFileSync` (atomic per call) for writes; an id-bearing placeholder for retrieve lookup; and tombstone-wins hydration in `ArchiveStore.hydrateFromEntries` so same-turn prune+retrieve is a supported no-op. The one real same-turn race — two parallel `context-bonsai-prune` calls in one assistant message — is handled by setting `executionMode: "sequential"` on the prune and retrieve tool definitions (`extensions/types.ts:443-447`), one line per tool.

## User Model

### User Gamut
- Pi maintainer integrating an opt-in context-management extension; cares about surface-area cost, test coverage, and whether behaviour survives session reloads.
- Heavy-use Pi operator running multi-hour coding/debugging sessions who keeps hitting Pi's built-in compaction; wants surgical pruning with the ability to restore.
- Extension author reading this code as an exemplar of how to combine the `"context"` event with persisted archive state.
- CI / headless-RPC user (print mode, no TUI); any footer-only UX must not be the sole signal.
- Downstream tool authors whose tools might conflict with pruning (e.g. tools that depend on prior tool-call ids staying visible).

### User-Needs Gamut
- Reclaim context tokens without losing the ability to restore content.
- See the gauge in the LLM's own context so pruning decisions happen autonomously (human-visible UI is a nice-to-have, not a substitute).
- Survive `/reload` and process restarts: on session load, archived ranges must still render as placeholders.
- Not break Pi's built-in compaction or tool-result flows when the extension is disabled or absent.
- Clear, auditable state: the session file should let someone reconstruct why a range was pruned.

### Ambiguities From User Model
- Whether the extension should also intercept `session_before_compact` to offer bonsai as a compaction strategy. **Resolution:** out-of-scope for this epic; treat bonsai as orthogonal to built-in compaction. Can be added later without breaking the plugin.
- Whether to expose `/prune` and `/retrieve` slash commands in addition to the LLM-callable tools. **Resolution:** out-of-scope for this epic; tools-only parity with OpenCode first. Reassess after the port lands.
- Whether the gauge text should be fully identical to OpenCode's or adapted to Pi's prompt style. **Resolution:** identical to start — behaviour parity is more valuable than stylistic harmonisation. Can diverge later.

## Stories

### Story 1: Package scaffold + extension entry point + system-prompt guidance
**Size:** Small
**Description:** Create `packages/context-bonsai/` as a workspace package with a minimal extension factory that registers nothing but appends bonsai's system-prompt guidance via `before_agent_start`. Proves the loading, build, and test plumbing end-to-end before any business logic lands.
**Implementation Plan:** `.agents/plans/epic-port-context-bonsai/story-port-context-bonsai.1-package-scaffold.md`

### Story 2: Prune tool + archive store + context transform
**Size:** Large
**Description:** Port `prune-pattern.ts`, `prune-pattern-matcher.ts`, archive schema, and per-session state module. Register `context-bonsai-prune` tool that resolves `from_pattern`/`to_pattern` to `SessionEntry.id` pairs, persists the archive via `pi.appendEntry("context-bonsai:archive", ...)`, and updates in-memory state. Implement the `"context"` handler that walks the branch to correlate messages to entry ids, replaces each archive anchor with a placeholder text, and elides followers. Rebuild state on `session_start`.
**Implementation Plan:** `.agents/plans/epic-port-context-bonsai/story-port-context-bonsai.2-prune-and-context-transform.md`

### Story 3: Retrieve tool
**Size:** Small
**Description:** Register `context-bonsai-retrieve`. On call, look up the anchor in the archive store, reject if the archive was created in the current step (same-step guard), then persist a `context-bonsai:archive-clear` custom entry (tombstone) and remove from the in-memory map. The context transform from Story 2 then no longer elides that range.
**Implementation Plan:** `.agents/plans/epic-port-context-bonsai/story-port-context-bonsai.3-retrieve.md`

### Story 4: Context gauge (system-reminder injection)
**Size:** Medium
**Description:** Track running token totals via `message_end`/`turn_end` + `ctx.getContextUsage()`. In the same `"context"` handler as Story 2, after archive placeholders are applied, append a `<system-reminder>…</system-reminder>` text block to the last user message on a cadence (every N turns). Gauge text is the five-tier string from OpenCode's `gauge.ts:formatGaugeText`. Optionally mirror status to `ctx.ui.setStatus("bonsai", ...)` as an additional human-visible indicator, but never as a substitute.
**Implementation Plan:** `.agents/plans/epic-port-context-bonsai/story-port-context-bonsai.4-context-gauge.md`

### Story 5: End-to-end test→fix→test validation loop
**Size:** Medium
**Description:** Write a Pi-native end-to-end validation protocol (`packages/context-bonsai/docs/e2e-testing.md`) and automation harness (`test/e2e/run-e2e.sh` + `assert.mjs`) built on the prerequisite research document `.agents/research/pi-e2e-interaction-baseline.md`. Run the resulting suite in a test→diagnose→fix→re-test loop covering six scenarios (extension load, prune, retrieve, reload persistence, gauge cadence, same-step guard). Every fix applied during the loop is accompanied by a regression test backfilled into Stories 1–4's unit/integration suite. Story complete when `run-e2e.sh --all` exits 0 against the pinned provider/model.
**Implementation Plan:** `.agents/plans/epic-port-context-bonsai/story-port-context-bonsai.5-e2e-test-fix-loop.md`

## Dependencies and Integration

- Prerequisites: none — all Pi surface area required is already present (confirmed by reading `packages/coding-agent/src/core/extensions/types.ts` and `runner.ts:809-839`).
- Enables: future stories for slash-command shortcuts, footer gauge widget, bonsai-as-compaction-strategy.
- Integration points:
  - New workspace package: `packages/context-bonsai/`.
  - Consumed via Pi's extension discovery: local (`.pi/extensions/`), global (`~/.pi/extensions/`), or explicit path (see `packages/coding-agent/src/core/extensions/loader.ts:560 discoverAndLoadExtensions`). No change to Pi core is required to use it.
  - Root `package.json` workspace globs already match `packages/*`; no root change needed for the package to be discovered by npm install.
  - Tests co-located in `packages/context-bonsai/test/` (unit) and `packages/coding-agent/test/suite/context-bonsai/` (integration, using `createTestExtensionsResult` from `test/utilities.ts:185`).

## Risks and Mitigations

- **Risk:** `AgentMessage[]` received by the `"context"` handler is produced by `buildSessionContext` (`session-manager.ts:376-419`), which diverges from the raw branch when compaction, branch-summary, or custom-message entries are present. Naive positional zip with `getBranch()` would break.
  **Mitigation:** Archive records store `(anchorEntryId, anchorRole, anchorTimestamp, rangeEndEntryId, rangeEndRole, rangeEndTimestamp)`. The `"context"` handler locates anchors by `(role, timestamp)` inside `event.messages` directly — independent of branch geometry. Story 2 includes an integration test with a `CompactionEntry` + a `BranchSummaryEntry` on the branch to prove the correlation survives both. Correlation logic lives in one module so a future Pi change is a one-file swap.
- **Risk:** Archives persisted as custom entries survive reloads, but if the user forks the session tree the anchor entry may no longer be on the current branch. Pruning stale archives.
  **Mitigation:** On `session_start`, only load archives whose anchor `entryId` resolves inside `sessionManager.getBranch()`. Others are ignored (not deleted — they become live again if the branch changes back).
- **Risk:** Gauge injection that always fires on `"context"` would add noise between prune cycles.
  **Mitigation:** Port the turn-cadence gate exactly from `gauge.ts` (every N turns).
- **Risk:** The `structuredClone` in `emitContext` (runner.ts:811) means returned messages are accepted verbatim; a bug that duplicates or drops a message silently corrupts the LLM transcript.
  **Mitigation:** Integration tests assert exact message counts and ordering pre/post transform.

## Worktree Artifact Check (epic-level rollup)

- Checked At: 2026-04-23
- Planned Target Files: none of the planned source paths (`packages/context-bonsai/**`, `packages/coding-agent/test/suite/context-bonsai/**`) currently exist. `git status` is clean at the start of the epic. The prerequisite research document at `.agents/research/pi-e2e-interaction-baseline.md` was produced during planning and will be committed alongside the plan artifacts.
- Overlaps Found: none.
- Escalation Status: none.
- Decision Citation: n/a.

Re-check is still required per-story by the implementer immediately before edits.
