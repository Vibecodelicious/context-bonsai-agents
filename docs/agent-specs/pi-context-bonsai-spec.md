# Pi Context Bonsai Spec

## Purpose

This document specializes the shared Context Bonsai contract for Pi.
Pi is an unusually strong fit for a first-party extension implementation because its `ExtensionAPI` already exposes model-facing tools, context transforms, system-prompt mutation, custom session entries, usage data, and session lifecycle events. The main implementation constraint is not host capability; it is preserving Pi's in-tree extension architecture and accounting for the fact that LLM messages do not carry stable message ids.

## User Model

### User Gamut

- Pi terminal users running long coding sessions through print mode, TUI mode, or RPC automation
- Pi maintainers reviewing an opt-in first-party workspace extension
- extension authors using bonsai as an example of context transforms plus custom session state
- release-gate reviewers who need model-visible evidence rather than UI-only status

### User-Needs Gamut

- surgical context reclamation without losing recoverability
- durable archive state across reload, resume, and process restart
- pattern matching over text and tool-call structures, not text-only transcripts
- gauge signals delivered in-band to the model, including headless/print-mode runs
- minimal or no Pi core changes while preserving deterministic fail-closed behavior

### Ambiguities From User Model

- Whether Pi should intentionally diverge from the shared same-step retrieve guard. Pi intentionally keeps the simpler same-turn prune+retrieve no-op behavior.
- Whether bonsai should integrate with Pi's built-in compaction strategy. This spec leaves that out of scope; bonsai remains an opt-in surgical pruning extension.

## Capability Evidence Matrix

| Area | Status | Notes |
|---|---|---|
| Persistent transcript | Verified | SessionManager stores append-only JSONL/tree entries with custom entries |
| Tool execution layer | Verified | `ExtensionAPI.registerTool` supports TypeBox parameters and per-tool execution mode |
| Context transform hook | Verified | The `context` event rewrites outgoing `AgentMessage[]` before model invocation |
| System guidance path | Verified | `before_agent_start` can replace or extend the effective system prompt |
| Archive persistence | Verified | `pi.appendEntry(customType, data)` persists extension-owned custom session state |
| Token/context tracking | Verified | `ctx.getContextUsage()` exposes tokens, context window, and percent when available |
| Stable message ids | Partial | LLM messages have timestamps but no ids; archive ids must use `SessionEntry.id` plus correlation metadata |

## Verified Host Primitives

- Extension factories and `ExtensionAPI` are defined in [types.ts](/home/basil/projects/context-bonsai-agents/pi/packages/coding-agent/src/core/extensions/types.ts).
- Tool registration is exposed through `registerTool` in [types.ts](/home/basil/projects/context-bonsai-agents/pi/packages/coding-agent/src/core/extensions/types.ts) and wired by [loader.ts](/home/basil/projects/context-bonsai-agents/pi/packages/coding-agent/src/core/extensions/loader.ts).
- Tool execution can be forced sequential through `executionMode`, with default parallel execution in [agent.ts](/home/basil/projects/context-bonsai-agents/pi/packages/agent/src/agent.ts) and selection logic in [agent-loop.ts](/home/basil/projects/context-bonsai-agents/pi/packages/agent/src/agent-loop.ts).
- The outgoing transcript transform path is `transformContext` in [agent-loop.ts](/home/basil/projects/context-bonsai-agents/pi/packages/agent/src/agent-loop.ts), surfaced to extensions as the `context` event in [runner.ts](/home/basil/projects/context-bonsai-agents/pi/packages/coding-agent/src/core/extensions/runner.ts).
- System guidance can be appended through `before_agent_start`, defined in [types.ts](/home/basil/projects/context-bonsai-agents/pi/packages/coding-agent/src/core/extensions/types.ts) and chained in [runner.ts](/home/basil/projects/context-bonsai-agents/pi/packages/coding-agent/src/core/extensions/runner.ts).
- Archive state can persist through `pi.appendEntry`, backed by `SessionManager.appendCustomEntry` and append-only session persistence in [session-manager.ts](/home/basil/projects/context-bonsai-agents/pi/packages/coding-agent/src/core/session-manager.ts).
- Session lifecycle includes startup, reload, resume, new, and fork reasons in [types.ts](/home/basil/projects/context-bonsai-agents/pi/packages/coding-agent/src/core/extensions/types.ts), with reload/resume paths in [agent-session.ts](/home/basil/projects/context-bonsai-agents/pi/packages/coding-agent/src/core/agent-session.ts) and [agent-session-runtime.ts](/home/basil/projects/context-bonsai-agents/pi/packages/coding-agent/src/core/agent-session-runtime.ts).
- Usage data for the gauge is exposed by `ctx.getContextUsage()` in [types.ts](/home/basil/projects/context-bonsai-agents/pi/packages/coding-agent/src/core/extensions/types.ts) and implemented in [agent-session.ts](/home/basil/projects/context-bonsai-agents/pi/packages/coding-agent/src/core/agent-session.ts).
- Pi LLM messages carry role/content/timestamp but no stable message id in [types.ts](/home/basil/projects/context-bonsai-agents/pi/packages/ai/src/types.ts). Session entries provide ids in [session-manager.ts](/home/basil/projects/context-bonsai-agents/pi/packages/coding-agent/src/core/session-manager.ts).

## Unverified Or Weak Areas

- Message correlation must bridge two shapes: durable `SessionEntry.id` in session state and id-less `AgentMessage[]` in the context transform. The plan resolves this by storing entry ids plus `(role, timestamp)` for anchor and range end.
- `buildSessionContext` can inject synthetic compaction summaries, branch summaries, and custom messages, and can drop entries before `firstKeptEntryId`. Positional zipping between branch entries and outgoing messages is unsafe.
- `getContextUsage()` may be unavailable or may return null token/percent values after compaction until new assistant usage is recorded. Gauge injection must remain silent in those states.
- Tool execution defaults to parallel. Bonsai prune and retrieve tools must opt into sequential execution to avoid overlapping archive mutations.

## Integration Posture

### Required architecture stance

- Pi Context Bonsai MUST be implemented as an in-tree first-party extension package at `pi/packages/context-bonsai/`.
- The side repo `pi_context_bonsai` remains a standards/spec holder unless future shared scaffolding is needed outside `pi-mono`.
- Pi core changes SHOULD NOT be required for the approved plan; any future core change must identify the missing extension primitive and be narrowly scoped.
- The implementation MUST use Pi-native session custom entries for archive records and tombstones rather than an external shadow store as the authority.

### Prune and retrieve contract

- The model-facing tools MUST be `context-bonsai-prune` and `context-bonsai-retrieve`.
- The prune tool MUST use pattern boundaries with required `from_pattern`, `to_pattern`, `summary`, and `index_terms`, plus optional `reason`.
- Pattern matching MUST include stable searchable representations of normal message text, completed assistant `toolCall` names and input arguments, and corresponding `toolResult` names and output content/details.
- Per shared spec Pattern Matching Contract, ambiguous pattern handling MUST apply the prior prune-wrapper filter before returning ambiguity, so retry attempts are not poisoned by echoed `from_pattern` / `to_pattern` text.
- Archive records MUST include anchor/range-end `SessionEntry.id`, summary, index terms, optional reason, and enough correlation metadata to find those messages in later outgoing `AgentMessage[]` transforms. For Pi, that means at least role and message timestamp for both boundaries.
- Retrieve in Pi intentionally supports same-turn prune+retrieve as a no-op: prune writes archive state, retrieve writes tombstone state, and tombstone precedence makes the range visible again immediately.
- Prune and retrieve tools MUST set `executionMode: "sequential"`.

### Transcript mutation path

- Placeholder rendering and follower-message elision MUST happen through the extension `context` event.
- The transform MUST correlate archive anchors by `(role, timestamp)` inside the outgoing `AgentMessage[]`, not by positional zip with `getBranch()`.
- If an archive's anchor or range end cannot be located in a given outgoing transcript, the transform SHOULD skip that archive for the turn without deleting persisted state.
- The placeholder MUST retain the canonical information: anchor id, range-end id, summary, and index terms.

### System guidance path

- Bonsai guidance SHOULD be appended through `before_agent_start` by extending the effective system prompt.
- Guidance semantics MUST remain aligned with the shared spec: protected context, ranking, drift, non-destructive pruning, and retrieval rules must be model-visible.

### Gauge path

- Gauge delivery MUST be in-band, appended to the last user message in a `<system-reminder>` style wrapper during the context transform.
- The gauge MUST use the shared spec's four locked bands: `<30%`, `30-60%`, `61-80%`, and `>80%` with `PRUNE NOW` in the urgent band.
- Gauge cadence SHOULD be every 5 turns by default.
- If `ctx.getContextUsage()` is unavailable, or token/percent data is null, the gauge MUST remain silent.
- Human-visible TUI status may be added but cannot substitute for the model-visible gauge.

## Fail-Closed Requirements

- If `sessionManager.getBranch`, `sessionManager.getEntries`, `pi.appendEntry`, or the `context` transform path is unavailable or incompatible, prune/retrieve MUST fail closed with explicit deterministic compatibility errors.
- Failed prune or retrieve calls MUST leave archive state and model-visible transcript state unchanged.
- Runtime hook or shape changes MUST not silently no-op while reporting success.
- Gauge capability gaps may degrade to partial parity, but prune/retrieve capability gaps must be explicit errors.

## Parity Gaps Against Shared Spec

- Host capability gaps are minimal; Pi exposes the required primitives through first-party extension APIs.
- The main parity risk is message identity: Pi requires archive records to bridge `SessionEntry.id` and id-less outgoing messages through role/timestamp correlation.
- The second risk is transcript shape fidelity: tool calls and tool results must be included in pattern-matching text extraction, not just visible text blocks.
- The third risk is interaction with built-in compaction and branch summaries; transform tests must cover synthetic context entries.

## Specified Implementation Direction

- Preferred: direct first-party extension at `packages/context-bonsai/`, owning prompt guidance, tools, archive store, context transform, gauge, and tests.
- Acceptable: narrow Pi core seam only if a required primitive becomes unavailable or proves insufficient, with the missing capability documented before implementation.
- Not acceptable: an external sidecar-only implementation that cannot rewrite the actual outgoing transcript, a text-only matcher that ignores tool structures, or a UI-only gauge.

## E2E Priorities

- extension load and tool registration through Pi's extension discovery
- prune success with persisted `context-bonsai:archive` custom entry and model-visible placeholder on the next turn
- retrieve success with persisted `context-bonsai:archive-clear` tombstone and restored visible transcript
- reload/resume persistence across a new Pi process
- gauge cadence and four-band severity text in the outgoing model-visible transcript
- same-turn prune+retrieve no-op behavior
- secret/sensitive-content prune oracle proving active context no longer contains pruned content

## Key References

- [epic-port-context-bonsai.md](/home/basil/projects/context-bonsai-agents/.agents/plans/epic-pi-port/epic-port-context-bonsai.md)
- [story-port-context-bonsai.2-prune-and-context-transform.md](/home/basil/projects/context-bonsai-agents/.agents/plans/epic-pi-port/story-port-context-bonsai.2-prune-and-context-transform.md)
- [story-port-context-bonsai.3-retrieve.md](/home/basil/projects/context-bonsai-agents/.agents/plans/epic-pi-port/story-port-context-bonsai.3-retrieve.md)
- [story-port-context-bonsai.4-context-gauge.md](/home/basil/projects/context-bonsai-agents/.agents/plans/epic-pi-port/story-port-context-bonsai.4-context-gauge.md)
- [story-port-context-bonsai.5-e2e-test-fix-loop.md](/home/basil/projects/context-bonsai-agents/.agents/plans/epic-pi-port/story-port-context-bonsai.5-e2e-test-fix-loop.md)
- [types.ts](/home/basil/projects/context-bonsai-agents/pi/packages/coding-agent/src/core/extensions/types.ts)
- [runner.ts](/home/basil/projects/context-bonsai-agents/pi/packages/coding-agent/src/core/extensions/runner.ts)
- [session-manager.ts](/home/basil/projects/context-bonsai-agents/pi/packages/coding-agent/src/core/session-manager.ts)
- [agent-loop.ts](/home/basil/projects/context-bonsai-agents/pi/packages/agent/src/agent-loop.ts)
- [ai types.ts](/home/basil/projects/context-bonsai-agents/pi/packages/ai/src/types.ts)
