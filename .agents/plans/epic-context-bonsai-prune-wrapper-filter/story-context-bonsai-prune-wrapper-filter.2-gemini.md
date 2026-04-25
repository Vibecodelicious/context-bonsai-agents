# Story: Gemini prune-wrapper filter

> **Revisions required (2026-04-25).** Spec changed after this draft was written: commits `cb61f00` (prune-wrapper filter clause), `4d87eb9` (per-agent mirror), and `9f1ca61` (Pattern Matching Contract bullet 1 SHOULD → MUST on tool-call name/input/output). Gemini's `flattenMessageText` walks only `.text` properties of `content`; `MessageRecord.toolCalls[]` and `functionResponse` parts are never searched. Story scope must expand to include text-extraction remediation in `snapshotTranscriptForResolution` before the wrapper-filter has any effect. Rescope before orchestration.

**Epic:** Context Bonsai Prune-Wrapper Filter
**Size:** Small
**Dependencies:** None

## Story Description

Implement the cross-agent spec's prune-wrapper filter rule for the Gemini CLI port. When `resolveBoundary` finds multiple candidates on the `from_pattern` or `to_pattern` ambiguity path, it MUST exclude messages whose canonical content is a prior `context-bonsai-prune` tool-use wrapper before returning the existing ambiguity error.

The side repo (`gemini-cli_context_bonsai`) extends `TranscriptMessage` and adds the predicate / filter logic. The agent repo (`gemini-cli`) updates `snapshotTranscriptForResolution` to populate the wrapper flag from raw conversation message content (the `chatRecordingService` exposes the underlying message shape with tool-call parts; `searchText` alone is the flattened-text view that loses tool-name structure).

## User Model

### User Gamut
- Gemini CLI users in long terminal sessions who retry after first-attempt ambiguity
- Operators using ACP / non-interactive runs
- Maintainers reviewing how the agent-side bootstrap feeds the side-repo resolver

### User-Needs Gamut
- Retry stability after first-attempt ambiguity
- No silent boundary selection
- The flag survives across resumed conversations because `chatRecordingService` history is durable

### Design Implications
- Side repo owns the predicate and the type extension; agent repo owns the snapshot population.
- The predicate inspects raw `chatRecordingService` message content for tool-call parts naming `context-bonsai-prune` or `mcp__context-bonsai__context-bonsai-prune`. Gemini uses the MCP-prefixed form because the prune tool ships via the bonsai MCP server.

## Acceptance Criteria

- [ ] `gemini-cli_context_bonsai/src/guards.ts` `TranscriptMessage` type carries an optional `isPruneWrapper?: boolean`.
- [ ] `gemini-cli_context_bonsai/src/guards.ts` exports a pure helper (e.g. `isPruneToolWrapperContent(content: unknown): boolean`) that detects a `context-bonsai-prune` (native or MCP-prefixed) tool-call inside the raw content shape `chatRecordingService` produces. Both names listed explicitly.
- [ ] `gemini-cli/packages/cli/src/utils/contextBonsaiBootstrap.ts` `snapshotTranscriptForResolution` (around `:476-487`) populates `isPruneWrapper` from each conversation message's raw content using the side-repo helper.
- [ ] `resolveBoundary` ambiguity branches (`guards.ts:114-120` for `from_pattern`, `:128-135` for `to_pattern`) filter wrappers BEFORE returning the existing ambiguity error. If exactly one non-wrapper candidate remains for that side, use it; otherwise return the existing error unchanged.
- [ ] Single-match path untouched.
- [ ] Zero-match path untouched.
- [ ] Tests in `gemini-cli_context_bonsai/test/guards.test.ts` cover all four outcomes per side (`from_pattern` filter-then-1, filter-then-0, filter-then-many, single-match-untouched).
- [ ] Predicate has dedicated unit tests (native name, MCP-prefixed name, non-prune tool, plain string content).
- [ ] One agent-repo test in `gemini-cli/packages/cli/src/utils/contextBonsaiBootstrap.test.ts` confirms `snapshotTranscriptForResolution` populates `isPruneWrapper` correctly when the raw conversation message contains a prune tool-call.
- [ ] All existing tests still pass: side-repo 67 vitest tests, agent-repo CLI subset (291), agent-repo core subset (179).

## Context References

### Relevant Codebase Files (must read)
- `/home/basil/projects/context-bonsai-agents/gemini-cli_context_bonsai/src/guards.ts:18-32` — `TranscriptMessage` interface
- `/home/basil/projects/context-bonsai-agents/gemini-cli_context_bonsai/src/guards.ts:95-98` — `resolveBoundary` signature
- `/home/basil/projects/context-bonsai-agents/gemini-cli_context_bonsai/src/guards.ts:114-135` — both ambiguity branches
- `/home/basil/projects/context-bonsai-agents/gemini-cli/packages/cli/src/utils/contextBonsaiBootstrap.ts:476-487` — `snapshotTranscriptForResolution` (target for population)
- `/home/basil/projects/context-bonsai-agents/gemini-cli/packages/cli/src/utils/contextBonsaiBootstrap.ts:521-535` — `flattenMessageText` (sibling helper for content traversal)
- `/home/basil/projects/context-bonsai-agents/gemini-cli_context_bonsai/test/guards.test.ts` — existing test conventions (vitest, `tmsg` fixture helper)
- `/home/basil/projects/context-bonsai-agents/gemini-cli/packages/cli/src/utils/contextBonsaiBootstrap.test.ts` — existing CLI-side test conventions

### Reference Implementation
- `/home/basil/projects/opencode_context_bonsai_plugin/src/prune-pattern.ts:85-107`
- `/home/basil/projects/the_observer/.agents/plans/story-context-bonsai-v2-prune-call-filtering.md`

### Relevant Documentation
- `/home/basil/projects/context-bonsai-agents/docs/context-bonsai-agent-spec.md` (commit `cb61f00`)
- `/home/basil/projects/context-bonsai-agents/docs/agent-specs/gemini-cli-context-bonsai-spec.md` (commit `4d87eb9`)

## Implementation Plan

### Phase 1: Side-repo predicate + type extension
- Add `isPruneToolWrapperContent(content: unknown): boolean` to side-repo (defensive: handle string / array / unknown shapes).
- Extend `TranscriptMessage` with `isPruneWrapper?: boolean`.

### Phase 2: Side-repo filter integration
- In `resolveBoundary`, modify both ambiguity branches: filter wrappers before returning the existing ambiguity error. Mirror the pattern at `from` and `to` sides identically.

### Phase 3: Agent-repo population
- Update `snapshotTranscriptForResolution` to call `isPruneToolWrapperContent(m.content)` and set the new field on each `TranscriptMessage`.

### Phase 4: Tests
- Side-repo: predicate unit tests + four resolver outcome tests per side.
- Agent-repo: one bootstrap test confirming population from realistic raw content.

## Step-by-Step Tasks

1. Read the four files above to confirm symbols and shapes.
2. Add the side-repo predicate.
3. Extend `TranscriptMessage`.
4. Add filter logic in `resolveBoundary` ambiguity branches.
5. Update `snapshotTranscriptForResolution` to populate the flag.
6. Add side-repo tests + one agent-repo test.
7. Run validation commands; fix type errors and lint.

## Testing Strategy

Side-repo vitest covers the resolver, predicate, and outcome matrix. Agent-repo vitest covers the population seam end-to-end on a synthetic conversation message with a prune tool-call.

## Validation Commands

- `cd /home/basil/projects/context-bonsai-agents/gemini-cli_context_bonsai && npm test`
- `cd /home/basil/projects/context-bonsai-agents/gemini-cli_context_bonsai && npm run typecheck`
- `cd /home/basil/projects/context-bonsai-agents/gemini-cli && npm run test --workspace @google/gemini-cli -- src/utils/contextBonsaiBootstrap.test.ts`
- `cd /home/basil/projects/context-bonsai-agents/gemini-cli && npm run typecheck`

## Worktree Artifact Check

- Checked At: 2026-04-24
- Planned Target Files:
  - `gemini-cli_context_bonsai/src/guards.ts`
  - `gemini-cli_context_bonsai/test/guards.test.ts`
  - `gemini-cli/packages/cli/src/utils/contextBonsaiBootstrap.ts`
  - `gemini-cli/packages/cli/src/utils/contextBonsaiBootstrap.test.ts`
- Overlaps Found: pending (planner re-checks before commit)
- Escalation Status: none
- Decision Citation: n/a

## Plan Approval and Commit Status

- Approval Status: pending
- Approval Citation: none
- Plan Commit Hash: pending-next-commit
- Ready-for-Orchestration: no

## Validation Loop Results

- Missing details check: pending
- Ambiguity check: pending
- Worktree artifact risk check: pending
- Plan-commit status check: pending
- Iterations run: 1

## Completion Checklist

- [ ] All acceptance criteria met
- [ ] Validation commands pass
- [ ] Plan approved and committed before orchestration begins
