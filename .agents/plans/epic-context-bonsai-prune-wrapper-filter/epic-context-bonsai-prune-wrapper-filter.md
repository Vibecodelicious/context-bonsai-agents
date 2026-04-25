# Epic: Context Bonsai Prune-Wrapper Filter

> **Revisions required (2026-04-25).** This draft was written before the cross-agent spec was tightened. Three commits expand the scope:
>
> - [`cb61f00`](../../../docs/context-bonsai-agent-spec.md) — Pattern Matching Contract gains the prune-wrapper filter clause
> - [`4d87eb9`](../../../docs/agent-specs/) — per-agent specs mirror the rule
> - [`9f1ca61`](../../../docs/context-bonsai-agent-spec.md) — Pattern Matching Contract bullet 1 upgraded SHOULD → MUST: matching MUST operate on tool-call name, input, AND output
>
> Consequence: three of four ports (Kilo, Cline, Gemini) must first remediate their text-extraction layers to surface tool-call structure before the wrapper-filter work is meaningful. Codex partially complies (`FunctionCall.arguments` is searchable) but emits empty for 11 of 13 `ResponseItem` variants. This epic needs full rescope before orchestration begins — see issues docs at `.agents/issues/<agent>-issues.md` once created.

**Goal:** Implement the cross-agent spec rule that prune-call wrappers must be filtered out of the candidate set on the ambiguity path of pattern resolution, so retry sequences after a first-attempt ambiguity error stop self-poisoning.

**Depends on:**
- Cross-agent spec update at commit `cb61f00` (Pattern Matching Contract addition)
- Per-agent spec updates at commit `4d87eb9`
- All four v1 ports closed: Kilo (`8684602`), Gemini (`fd38ad7`), Cline (`1a44e64`), Codex (`31bbc92`)

**Parallel with:** None
**Complexity:** Low (small, surgical change per port; design pattern shared)

## User Model

### User Gamut
- Operators of any of the four ports who hit an ambiguity error on the first prune attempt and retry with a refined pattern
- Agents that generate boundary patterns programmatically without full visibility into prior failed prune-call content

### User-Needs Gamut
- Retry stability: a corrected boundary pattern resolves to the real message, not collides with the prior failed prune wrapper
- Correctness: ambiguity errors fire only when genuinely ambiguous (multiple real candidates), not when prior prune calls echo similar text in the searchable transcript
- Safety: never silently select the wrong boundary message

### Ambiguities From User Model
- None. Cross-agent spec is unambiguous.

## Shared Design Pattern

All four ports use the same shape:

1. **Predicate** lives in the side repo: a pure helper that returns true for a content block (or message) that is a prior `context-bonsai-prune` tool-use wrapper. Predicate accepts both `context-bonsai-prune` (native) and `mcp__context-bonsai__context-bonsai-prune` (MCP-prefixed) tool names.
2. **Wrapper-flag carrier** is the message-projection shape the resolver already operates on. Each port adds a single boolean field or callback to that shape:
   - Kilo `MessageText`: add `isPruneWrapper?: boolean`
   - Gemini `TranscriptMessage`: add `isPruneWrapper?: boolean`
   - Codex `MessageForMatching`: add `is_prune_wrapper: bool` (default false; serde-defaultable)
   - Cline `resolvePattern<Message>`: add optional `isPruneWrapper?: (m: Message) => boolean` callback
3. **Populator** runs at the existing projection seam in each port:
   - Kilo: `factory.ts` flatten loop (side repo)
   - Gemini: `snapshotTranscriptForResolution` in `contextBonsaiBootstrap.ts` (agent repo, ~3 line touch)
   - Codex: `project_message_for_matching` in `core/src/context_bonsai.rs` (agent repo, ~5 line touch)
   - Cline: `ContextBonsaiApplier.ts` callsite passes the predicate (agent repo, ~2 line touch)
4. **Filter site** is the resolver's ambiguity branch. Before returning the existing ambiguity error, filter out wrappers; if exactly one survivor remains, return it; otherwise return the existing error unchanged.

The single-match path is untouched in every port.

## Stories

### Story 1: Kilo prune-wrapper filter
**Size:** Small
**Description:** Pure side-repo change in `kilo_context_bonsai`. Extend `MessageText`, add predicate, populate during `PluginMessage → MessageText` flatten in `factory.ts`, filter on ambiguity branch in `guards.ts::resolvePattern`.
**Implementation Plan:** `.agents/plans/epic-context-bonsai-prune-wrapper-filter/story-context-bonsai-prune-wrapper-filter.1-kilo.md`

### Story 2: Gemini prune-wrapper filter
**Size:** Small
**Description:** Side repo (`gemini-cli_context_bonsai`) extends `TranscriptMessage` and adds the predicate / filter logic. Agent repo (`gemini-cli`) updates `snapshotTranscriptForResolution` to populate the flag from raw conversation message content.
**Implementation Plan:** `.agents/plans/epic-context-bonsai-prune-wrapper-filter/story-context-bonsai-prune-wrapper-filter.2-gemini.md`

### Story 3: Codex prune-wrapper filter
**Size:** Small
**Description:** Side crate (`codex_context_bonsai`) extends `MessageForMatching` with `is_prune_wrapper: bool`, adds the predicate as a `ResponseItem`-shaped helper, and filters on ambiguity branch in `resolve_pattern`. Agent repo (`codex`) updates `project_message_for_matching` to populate the flag.
**Implementation Plan:** `.agents/plans/epic-context-bonsai-prune-wrapper-filter/story-context-bonsai-prune-wrapper-filter.3-codex.md`

### Story 4: Cline prune-wrapper filter
**Size:** Small
**Description:** Side repo (`cline_context_bonsai`) adds an optional `isPruneWrapper` callback parameter to `resolvePattern` and exposes a content-block predicate helper. Agent repo (`cline`) callsite in `ContextBonsaiApplier.ts` passes the helper.
**Implementation Plan:** `.agents/plans/epic-context-bonsai-prune-wrapper-filter/story-context-bonsai-prune-wrapper-filter.4-cline.md`

## Parallelism Rule

- All four stories operate on independent submodules with no shared files; they can run fully in parallel.

## Dependencies and Integration

- Prerequisites:
  - Shared spec (`docs/context-bonsai-agent-spec.md` at commit `cb61f00`)
  - Per-agent specs (commit `4d87eb9`)
  - Each port's `feat/context-bonsai-port` branches inside its agent + side submodule
- Enables: retry stability after ambiguity errors across all four ports; closes the cross-agent self-poisoning gap surfaced by `the_observer` / `tweakcc`.

## Worktree Artifact Check (epic-level rollup)

- Checked At: 2026-04-24
- Planned Target Files: see story plans
- Overlaps Found: pending — story-level checks required before implementation
- Escalation Status: none
- Decision Citation: n/a

## Validation Loop Results

- Missing details check: pending (sub-agent)
- Ambiguity check: pending (sub-agent)
- Worktree artifact risk check: pending
- Plan-commit status check: pending
- Iterations run: 1
