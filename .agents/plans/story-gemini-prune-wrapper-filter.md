# Story: Gemini prune-wrapper filter on the ambiguity path

## Goal

Implement the cross-agent spec's prune-wrapper filter (commit `cb61f00`, MUST) for the Gemini CLI port. When `resolveBoundary` finds multiple candidates on either ambiguity path (`from_pattern` at `gemini-cli_context_bonsai/src/guards.ts:114-120`, `to_pattern` at `:128-135`), it MUST exclude messages whose canonical content is a prior `mcp_context-bonsai_context-bonsai-prune` tool-use wrapper before returning the existing ambiguity error.

This is load-bearing once G1 lands: with `toolCalls[]` and `functionResponse` content in `searchText`, failed-prune `from_pattern`/`to_pattern` text will collide with retry patterns. The filter prevents the self-poisoning loop.

Source issue: `.agents/issues/gemini-issues.md` Issue G2 (verified, evidence-backed).

## Dependencies

- **Must land with G1 (`story-gemini-tool-call-structure-search.md`).** G1 makes failed-prune args searchable; G2 prevents the resulting collisions. G2 alone is a no-op (today's failed-prune args don't reach `searchText`). G1 alone ships in self-poisoning state.

## User Model

### User Gamut
- Gemini CLI users who hit `from_pattern is ambiguous` or `to_pattern is ambiguous` on the first prune and retry with a refined pattern
- Maintainers reviewing the filter behavior in isolation

### User-Needs Gamut
- Retry stability after first-attempt ambiguity (both `from` and `to` sides)
- No silent boundary selection when multiple non-wrapper candidates remain
- No regression in single-match or zero-match paths
- Filter applies symmetrically to both `from_pattern` and `to_pattern` ambiguity branches

### Ambiguities From User Model
- **Where to detect wrapper-ness:** in the resolver (would need raw `MessageRecord`/`toolCalls`) OR via a flag on `TranscriptMessage`. Resolved: flag on `TranscriptMessage`. Keeps the resolver shape-agnostic, populated during snapshot building (G1's territory).
- **Tool name match:** Gemini surfaces the prune tool via MCP only. The MCP qualified name is `mcp_context-bonsai_context-bonsai-prune` (verified via `mcp-tool.ts:30,181-183,591-597` — single underscores, hyphens preserved). No native non-MCP path exists. Resolved: filter on the MCP-qualified name only.
- **Decomposition:** Gemini does NOT decompose MCP tools (verified by `grep` on `decompos|DecomposedTool|isDecomposable` — zero hits). Single canonical name applies.

## Context References

- `gemini-cli_context_bonsai/src/guards.ts:18-32` — `TranscriptMessage` interface (one new optional field added).
- `gemini-cli_context_bonsai/src/guards.ts:95-98` — `resolveBoundary` signature.
- `gemini-cli_context_bonsai/src/guards.ts:114-120` — `from_pattern` ambiguity branch.
- `gemini-cli_context_bonsai/src/guards.ts:128-135` — `to_pattern` ambiguity branch.
- `gemini-cli/packages/cli/src/utils/contextBonsaiBootstrap.ts:476-487` — `snapshotTranscriptForResolution` (where the new flag gets populated).
- `gemini-cli/packages/core/src/services/chatRecordingTypes.ts:31-69` — `MessageRecord` shape; `toolCalls?: ToolCallRecord[]` is on `'gemini'`-typed messages.
- `gemini-cli/packages/core/src/tools/mcp-tool.ts:30,181-183,591-597` — MCP-qualified-name format.
- `opencode_context_bonsai_plugin/src/prune-pattern.ts:85-107` — reference filter behavior.
- `docs/context-bonsai-agent-spec.md` Pattern Matching Contract — spec authority.
- `docs/agent-specs/gemini-cli-context-bonsai-spec.md` — Gemini's mirror.

## Acceptance Criteria

- [ ] `TranscriptMessage` (`gemini-cli_context_bonsai/src/guards.ts:18-32`) gains optional `readonly isPruneWrapper?: boolean` (placed after `isIncompleteToolCall`, with a doc-comment: "true if this message is a prior `mcp_context-bonsai_context-bonsai-prune` tool-use wrapper; resolver MUST exclude these from ambiguous match counts").
- [ ] A new exported helper `isPruneToolWrapperRecord(record: { toolCalls?: readonly ToolCallRecord[] }): boolean` is added to `gemini-cli_context_bonsai/src/guards.ts`. Returns true iff any `tc.name === 'mcp_context-bonsai_context-bonsai-prune'`. Tolerates missing `toolCalls` (returns false). Define `ToolCallRecord` minimally as `{ readonly name: string }` to avoid coupling to the agent repo's full type.
- [ ] `resolveBoundary` (`guards.ts:95-98`) ambiguity branches at `:114-120` (from) AND `:128-135` (to) both apply the filter:
  - Compute `survivors = matches.filter(i => !transcript[i]?.isPruneWrapper)`.
  - If `survivors.length === 1`, treat as the resolved match for that side (use `survivors[0]` as the index).
  - If `survivors.length === 0` or `> 1`, return the existing ambiguity error verbatim (`matches.length` reported unchanged).
  - The two ambiguity branches must be modified symmetrically.
- [ ] Single-match path (`matches.length === 1`) is untouched on both sides.
- [ ] Zero-match path is untouched on both sides.
- [ ] `snapshotTranscriptForResolution` (`gemini-cli/packages/cli/src/utils/contextBonsaiBootstrap.ts:476-487`) populates `isPruneWrapper` for each `TranscriptMessage` by calling the new helper on the source `MessageRecord`. (G1's snapshot rewrite is the natural insertion point; G2's change here is one extra line per row.)
- [ ] Tests in `gemini-cli_context_bonsai/test/guards.test.ts`:
  1. **from filter→1**: from_pattern ambiguous between wrapper + real msg → resolves to real msg.
  2. **to filter→1**: to_pattern ambiguous between wrapper + real msg → resolves to real msg.
  3. **from filter→>1**: two real msgs match → still ambiguous.
  4. **to filter→>1**: two real msgs match → still ambiguous.
  5. **from filter→0**: only wrappers match → still ambiguous.
  6. **to filter→0**: only wrappers match → still ambiguous.
  7. **single-match-untouched on either side**: one match (wrapper) → resolves to it.
- [ ] Predicate tests in `gemini-cli_context_bonsai/test/guards.test.ts` (alongside resolver tests): wrapper name match (true); non-prune tool (false); empty `toolCalls` (false); missing `toolCalls` (false); array with mixed names (true if any matches).
- [ ] Agent-repo tests in `gemini-cli/packages/cli/src/utils/contextBonsaiBootstrap.test.ts`: synthesized `MessageRecord` with a `mcp_context-bonsai_context-bonsai-prune` tool-use part is correctly flagged with `isPruneWrapper: true`.
- [ ] Side-repo `npm test` and `npm run typecheck` pass.
- [ ] Agent-repo `npm run typecheck --workspace @google/gemini-cli` and `npm run test --workspace @google/gemini-cli` pass.

## Implementation Tasks

1. Add `readonly isPruneWrapper?: boolean` to `TranscriptMessage` at `gemini-cli_context_bonsai/src/guards.ts:18-32`.
2. Add `isPruneToolWrapperRecord(record: { toolCalls?: readonly ToolCallRecord[] }): boolean` to `gemini-cli_context_bonsai/src/guards.ts`. Define a minimal `ToolCallRecord = { readonly name: string }` interface either in `guards.ts` or a sibling type file. Re-export from `gemini-cli_context_bonsai/src/index.ts`.
3. Modify `resolveBoundary`'s `from_pattern` ambiguity branch (`guards.ts:114-120`) to filter wrappers before returning the error.
4. Apply the SAME filter logic to the `to_pattern` ambiguity branch (`:128-135`). The two branches must be modified symmetrically.
5. Update `snapshotTranscriptForResolution` (G1's territory; coordinate with G1's edits in the same PR) to populate `isPruneWrapper` per `TranscriptMessage`.
6. Add the resolver outcome tests + predicate tests to `gemini-cli_context_bonsai/test/guards.test.ts`.
7. Add the agent-repo test to `gemini-cli/packages/cli/src/utils/contextBonsaiBootstrap.test.ts`.
8. Run all four validation commands.

## Testing Strategy

Side-repo vitest for resolver outcomes (both `from` and `to` sides) + predicate. Agent-repo vitest for the snapshot-populator test verifying real `MessageRecord` shapes flow correctly into `isPruneWrapper`.

## Validation Commands

- `cd /home/basil/projects/context-bonsai-agents/gemini-cli_context_bonsai && npm test`
- `cd /home/basil/projects/context-bonsai-agents/gemini-cli_context_bonsai && npm run typecheck`
- `cd /home/basil/projects/context-bonsai-agents/gemini-cli_context_bonsai && npm run build` (rebuild before agent typecheck)
- `cd /home/basil/projects/context-bonsai-agents/gemini-cli && npm run typecheck --workspace @google/gemini-cli`
- `cd /home/basil/projects/context-bonsai-agents/gemini-cli && npm run test --workspace @google/gemini-cli`

## Worktree Artifact Check

- Checked At: 2026-04-25
- Planned Target Files:
  - `gemini-cli_context_bonsai/src/guards.ts`
  - `gemini-cli_context_bonsai/src/index.ts`
  - `gemini-cli_context_bonsai/test/guards.test.ts`
  - `gemini-cli/packages/cli/src/utils/contextBonsaiBootstrap.ts` (small touch — populate flag)
  - `gemini-cli/packages/cli/src/utils/contextBonsaiBootstrap.test.ts`
- Overlaps Found (path + class): none. Both submodules clean per `git status --short`. G1 also touches `contextBonsaiBootstrap.ts` (rewrites `snapshotTranscriptForResolution`) and `contextBonsaiBootstrap.test.ts`. Same files but disjoint regions; safe to land in same PR — coordinate the snapshot-rewrite + flag-population in one edit.
- Escalation Status: none
- Decision Citation: n/a

## Plan Approval and Commit Status

- Approval Status: llm-agent-approved
- Approval Citation: validation loop iteration 1 found no blocking gaps (`ToolCallRecord` minimal-shape passes structural typing; both ambiguity branches return `number[]` indexable by `transcript[i]`; single-match and zero-match paths confirmed untouched; cite ranges verified accurate).
- Plan Commit Hash: b243a03
- Ready-for-Orchestration: yes

## Validation Loop Results

- Missing details check: pass (iteration 1).
- Ambiguity check: pass (iteration 1). Structural-subtype reasoning for `ToolCallRecord`; symmetric branch modification confirmed.
- Worktree artifact risk check: pass. Both submodules clean.
- Plan-commit status check: pending until commit.
- Iterations run: 1
