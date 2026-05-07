# Story: Context gauge (system-reminder injection)

**Epic:** Port context-bonsai to Pi as a first-party extension
**Size:** Medium
**Dependencies:** Story 2 (shares the `"context"` handler and `state` module)

## Story Description

Add the context-usage gauge: a `<system-reminder>…</system-reminder>` text block appended to the last user message on a cadence (every N turns), telling the LLM its current token usage as a percentage of the usable budget. This is the signal that drives the model to autonomously call `context-bonsai-prune` — it **must** land in the LLM's own context, never only in a human-visible footer.

The gauge text uses the shared spec's four locked severity bands: `<30%`, `30-60%`, `61-80%`, and `>80%` with explicit `PRUNE NOW` language in the urgent band.

Optional secondary UX: mirror the current gauge to `ctx.ui.setStatus("bonsai", ...)` for operators running the TUI. This is additive only; the system-reminder injection is non-negotiable.

## User Model

### User Gamut
- Operator who wants the model to self-manage context without manual intervention.
- RPC/print-mode user who has no TUI; the system-reminder is their only path to the gauge (footer status is irrelevant).
- Maintainer evaluating whether the gauge noise is acceptable (cadence control matters).

### User-Needs Gamut
- Gauge must appear in the LLM's own context, attached to the last user message, wrapped in `<system-reminder>` tags.
- Cadence must be tunable via the same extension-level constants as OpenCode (start with hardcoded parity; no new Pi surface needed).
- Gauge must go quiet when token info or model-limit info is unavailable (no spurious reminders).
- On turns between firings, the `"context"` handler's output must be unchanged except for archive transforms (no gauge appended).

### Design Implications
- Token totals come from `ctx.getContextUsage()` (`extensions/types.ts:276-282, 316`) — no need to re-sum usage from messages. Pi already tracks this.
- The handler attaches the gauge *after* archive placeholders are applied, to match OpenCode's `messages.transform` ordering.
- Since the `"context"` handler must still function before any archives exist, this work extends the existing handler from Story 2 rather than adding a second one.

## Acceptance Criteria

- [ ] `packages/context-bonsai/src/gauge.ts` exports:
  - `formatGaugeText(used: number, usableBudget: number, percent: number): string` — implements the shared spec's four locked severity bands.
  - `maybeInjectGauge(messages: AgentMessage[], state, usage: ContextUsage): AgentMessage[]` — pure function that returns a transcript with the gauge appended to the last user message iff cadence fires and usage is known.
- [ ] The context handler from Story 2 calls `maybeInjectGauge(...)` after archive placeholders are applied.
- [ ] Cadence: every `GAUGE_CADENCE` turns (5, same constant name/value as OpenCode). Turn count lives in `state`, incremented by the handler itself (same as OpenCode's `setTurnCount` flow).
- [ ] Gauge text is wrapped in `<system-reminder>\n…\n</system-reminder>` and appended as a new `TextContent` part to the last user message. If that message's `content` is a string, normalise to array form first.
- [ ] If `ctx.getContextUsage()` returns undefined or `tokens === null`, no gauge is injected.
- [ ] `pi.on("model_select", ...)` is NOT required — `ctx.getContextUsage()` already incorporates the current model. Only `state.turnCount` bookkeeping is needed.
- [ ] Unit tests:
  - `formatGaugeText` tier boundaries for `<30%`, `30-60%`, `61-80%`, and `>80%`, including `PRUNE NOW` in the urgent band.
  - `maybeInjectGauge` no-ops when cadence not fired.
  - `maybeInjectGauge` no-ops when usage is undefined.
  - `maybeInjectGauge` injects correctly to array-form and string-form user content.
- [ ] Integration test `packages/coding-agent/test/suite/context-bonsai/04-gauge.test.ts`:
  - Faux-provider session with controlled token usage.
  - Run 5 turns; assert exactly one turn's `"context"` event carries the gauge in the last user message (turn N where `turnCount % 5 === 0`).
  - Assert gauge text format matches `/^<system-reminder>\n\[CONTEXT GAUGE: .* tokens \(\d+%\)\]/`.
- [ ] `npm run check` passes.

## Context References

### Relevant Codebase Files (must read)
- `packages/coding-agent/src/core/extensions/types.ts:276-282` — `ContextUsage` shape.
- `packages/coding-agent/src/core/extensions/types.ts:316-317` — `ctx.getContextUsage()`.
- `packages/context-bonsai/src/context-transform.ts` (from Story 2) — where gauge injection hooks in.
- `packages/context-bonsai/src/state.ts` (from Story 2).
- `/home/basil/projects/opencode_context_bonsai_plugin/src/gauge.ts`
- `/home/basil/projects/opencode_context_bonsai_plugin/src/gauge.test.ts`

### New Files to Create
- `packages/context-bonsai/src/gauge.ts`
- `packages/context-bonsai/test/gauge.test.ts`
- `packages/coding-agent/test/suite/context-bonsai/04-gauge.test.ts`

### Files Modified
- `packages/context-bonsai/src/context-transform.ts` — calls `maybeInjectGauge` after archive transforms.
- `packages/context-bonsai/src/state.ts` — add/export `turnCount` getter/setter if not already present from Story 2.

## Implementation Plan

### Phase 1: Pure gauge module
- Implement `formatGaugeText` from the shared spec's four locked severity bands. This string is behaviourally load-bearing; do not introduce Pi-only bands.
- Implement `maybeInjectGauge` as a pure function taking `(messages, state, usage)` and returning a new array.

### Phase 2: Wire into context handler
- In `context-transform.ts`, after archive transform runs, call `maybeInjectGauge(messages, state, ctx.getContextUsage())`. Return the resulting messages.
- Increment `state.turnCount` inside `maybeInjectGauge` to match OpenCode's semantics (every call advances the counter; every 5th call fires).

### Phase 3: Tests
- Unit tests for `formatGaugeText` tier boundaries and `maybeInjectGauge` behaviour.
- Integration test asserts one-in-five-turns firing pattern and format.

### Phase 4: Gates
- `npm run check`, package tests, named integration test pass.

## Step-by-Step Tasks

1. Re-read `gauge.ts` and `gauge.test.ts` in the OpenCode plugin, then adapt only where needed to satisfy the shared spec's four locked bands.
2. Implement `src/gauge.ts`.
3. Modify `src/context-transform.ts` to call `maybeInjectGauge` after archive transforms.
4. Write unit tests (port + new).
5. Write integration test.
6. Run validation commands; fix issues.
7. Commit as `[Story 1.4] context-bonsai gauge system-reminder injection`.

## Testing Strategy

- **Unit**: four-band severity text, cadence gating, no-op on missing usage, both user-content shapes (string vs array).
- **Integration**: five-turn faux session asserting exact firing cadence and format.

## Validation Commands

Per `AGENTS.md`: use the vitest CLI form for named tests.

- `cd /home/basil/projects/context-bonsai-pi && npm run check`
- `cd /home/basil/projects/context-bonsai-pi/packages/context-bonsai && npx tsx ../../node_modules/vitest/dist/cli.js --run test/gauge.test.ts`
- `cd /home/basil/projects/context-bonsai-pi/packages/coding-agent && npx tsx ../../node_modules/vitest/dist/cli.js --run test/suite/context-bonsai/04-gauge.test.ts`

## Worktree Artifact Check

- Checked At: 2026-05-06
- Planned Target Files: `packages/context-bonsai/src/gauge.ts`, `packages/context-bonsai/src/context-transform.ts` (modified), `packages/context-bonsai/src/state.ts` (possibly modified), `packages/context-bonsai/test/gauge.test.ts`, `packages/coding-agent/test/suite/context-bonsai/04-gauge.test.ts`
- Overlaps Found: `packages/context-bonsai/src/context-transform.ts` and `state.ts` will be modified relative to Story 2's commit (in-epic).
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
