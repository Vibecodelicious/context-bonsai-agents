# Story: Gemini snapshotTranscriptForResolution surfaces tool-call structure

## Goal

Bring Gemini's transcript snapshot into compliance with the cross-agent spec's Pattern Matching Contract bullet 1 (MUST, since commit `9f1ca61`). Today `snapshotTranscriptForResolution` at `gemini-cli/packages/cli/src/utils/contextBonsaiBootstrap.ts:476-487` builds `TranscriptMessage.searchText` via `flattenMessageText(m.content)`, which walks only `.text` properties. `MessageRecord.toolCalls[]` (separate field on `'gemini'`-typed messages) is never read; `functionResponse` parts in user content also have no `.text` and are silently dropped. Tool-call name, args, and result are entirely unsearchable.

Source issue: `.agents/issues/gemini-issues.md` Issue G1 (verified, evidence-backed).

## Dependencies

- **Must land with G2 (`story-gemini-prune-wrapper-filter.md`).** G1 alone re-introduces self-poisoning across the entire prune history. G2 is the load-bearing mitigation. Ship together.

## User Model

### User Gamut
- Gemini CLI users running long terminal sessions trying to prune by tool name (e.g. MCP-prefixed `mcp_context-bonsai_context-bonsai-prune` or the underlying tool name)
- Users trying to prune by tool argument value (e.g. a file path passed to `read_file`)
- Users trying to prune by tool result content
- Operators using ACP / non-interactive Gemini runs
- Maintainers reviewing parity against OpenCode and other ports

### User-Needs Gamut
- Tool-call name + args + result reachable by pattern
- Stable representation (deterministic key order)
- Compatibility with G2's wrapper filter (this story populates the data G2 reads)
- Backward compatibility for existing patterns that target plain text (no regression)

### Ambiguities From User Model
- **`flattenMessageText` extension vs. new helper:** add a sibling `flattenPartListForSearch` that handles `functionCall`, `functionResponse`, and recurses into nested objects. Resolved: new sibling helper to avoid breaking existing `flattenMessageText` callers (currently only `snapshotTranscriptForResolution`, but the function name implies "text only").
- **Where to house the stable-JSON helper:** new file `gemini-cli_context_bonsai/src/stable-json.ts` (sharable across ports — same approach used in K1 and C1).

## Context References

- `gemini-cli/packages/cli/src/utils/contextBonsaiBootstrap.ts:476-487` — `snapshotTranscriptForResolution`, the function to extend.
- `gemini-cli/packages/cli/src/utils/contextBonsaiBootstrap.ts:521-535` — `flattenMessageText`, currently `.text`-only walker.
- `gemini-cli/packages/core/src/services/chatRecordingTypes.ts:31-69` — `BaseMessageRecord` and `MessageRecord` shapes; `'gemini'` variant carries `toolCalls?: ToolCallRecord[]` separately.
- `gemini-cli/packages/core/src/services/chatRecordingTypes.ts:41-54` — `ToolCallRecord = { id; name; args: Record<string, unknown>; result?: PartListUnion | null; status; timestamp; ... }`.
- `gemini-cli/packages/core/src/services/chatRecordingService.ts:552-621` — `recordToolCalls` populates `lastMsg.toolCalls`, NOT `m.content`.
- `gemini-cli/packages/core/src/tools/mcp-tool.ts:30,181-183,591-597` — MCP tool name format is `mcp_${serverName}_${serverToolName}` with `_` separator and hyphens preserved. For our prune tool: `mcp_context-bonsai_context-bonsai-prune`.
- `@google/genai` `Part` types — `Part.functionCall` (`name`, `args`), `Part.functionResponse` (`name`, `response: Record<string, unknown>`).
- `gemini-cli_context_bonsai/src/guards.ts:18-32` — `TranscriptMessage` interface (no change required by this story; G2 will add `isPruneWrapper`).
- `gemini-cli/packages/cli/src/utils/contextBonsaiBootstrap.test.ts` — existing CLI test file (101 lines today, no transcript-shape assertions).
- `opencode_context_bonsai_plugin/src/prune-pattern.ts:6-51` — `stableSerialize` / `normalizeForStableJson` reference to port verbatim.
- `docs/context-bonsai-agent-spec.md` Pattern Matching Contract — spec authority.
- `docs/agent-specs/gemini-cli-context-bonsai-spec.md` — Gemini's mirror.

## Acceptance Criteria

- [ ] A new file `gemini-cli_context_bonsai/src/stable-json.ts` exports `stableSerialize` and `normalizeForStableJson`, byte-equivalent to the OpenCode reference at `prune-pattern.ts:6-51`. Re-exported from `gemini-cli_context_bonsai/src/index.ts`.
- [ ] A new helper `flattenPartListForSearch(parts: unknown): string` is added to `contextBonsaiBootstrap.ts` (kept colocated; the function is small and `contextBonsaiBootstrap.ts` is the only consumer). Behavior:
  - String → return as-is.
  - Array → recurse, join with `\n`.
  - Object with `.text: string` → return text.
  - Object with `.functionCall: { name, args }` → return `tool:${name}\nargs:${stableSerialize(args)}`.
  - Object with `.functionResponse: { name, response }` → return `tool-response:${name ?? ''}\n${stableSerialize(response)}`.
  - Other objects → return empty string. Do NOT recurse into arbitrary object fields (would dump `inlineData.data` base64 etc. into search text). New `Part` variants that need to be searchable must be added explicitly.
  - null/undefined → empty string.
- [ ] The agent-repo file imports `stableSerialize` from the side repo via `import { stableSerialize } from "gemini-cli-context-bonsai";` (the existing alias used elsewhere in the file).
- [ ] `snapshotTranscriptForResolution` (`contextBonsaiBootstrap.ts:476-487`) extends each `TranscriptMessage.searchText` to include:
  - The existing content text via `flattenPartListForSearch(m.content)` (replaces `flattenMessageText(m.content)`).
  - For `m.type === 'gemini'` and each `tc` in `m.toolCalls ?? []`: append `tool:${tc.name}\nargs:${stableSerialize(tc.args)}\nresult:${flattenPartListForSearch(tc.result)}` joined with `\n`.
  - Skip empty segments before joining.
- [ ] `flattenMessageText` is deleted. Verified no callers other than `snapshotTranscriptForResolution` (single in-file call at line 485). The new `flattenPartListForSearch` replaces it.
- [ ] No agent-repo regression: existing `contextBonsaiBootstrap.test.ts` cases continue to pass (verified to have no transcript-shape assertions).
- [ ] New tests in `gemini-cli/packages/cli/src/utils/contextBonsaiBootstrap.test.ts`:
  1. `'gemini'` message with `toolCalls: [{ name: 'read_file', args: { absolute_path: '/x' }, result: [{ text: 'content' }] }]` produces `searchText` containing `tool:read_file`, `"absolute_path":"/x"`, and `content`.
  2. MCP tool call with `name: 'mcp_context-bonsai_context-bonsai-prune'` is searchable by that exact string.
  3. User `functionResponse` part with body `{ output: 'err: bad pattern' }` is searchable by `bad pattern`.
  4. `result === null` and `result === undefined` produce no crash and an empty result segment.
  5. Key-order independence — two `args` objects with same keys in different order produce identical `searchText`.
- [ ] New tests in `gemini-cli_context_bonsai/test/stable-json.test.ts`: same coverage as K1/C1 — key sorting, nested objects, arrays containing `undefined`, `bigint`, `toJSON`, null/empty-object inputs, top-level fallback to `'null'`.
- [ ] Side-repo `npm test` and `npm run typecheck` pass.
- [ ] Agent-repo `npm run typecheck` passes; CLI test slice passes.

## Implementation Tasks

1. Port `stableSerialize` / `normalizeForStableJson` verbatim from `opencode_context_bonsai_plugin/src/prune-pattern.ts:6-51` into `gemini-cli_context_bonsai/src/stable-json.ts`. Re-export from `gemini-cli_context_bonsai/src/index.ts`.
2. Add `flattenPartListForSearch` to `contextBonsaiBootstrap.ts` (or an extracted helper file). Defensive `unknown` handling per ACs.
3. Modify `snapshotTranscriptForResolution` (`contextBonsaiBootstrap.ts:476-487`) to include both content-flatten and toolCalls-flatten in `searchText`. For `'gemini'`-typed messages, iterate `toolCalls`. For all messages, traverse `content` via `flattenPartListForSearch`.
4. Decide on `flattenMessageText` fate: delegate to the new helper, delete, or preserve as a thin wrapper. Recommend delete if the only caller is now updated.
5. Add `stable-json.test.ts` to `gemini-cli_context_bonsai/test/` with the cases listed in ACs.
6. Add the five `snapshotTranscriptForResolution` cases to `gemini-cli/packages/cli/src/utils/contextBonsaiBootstrap.test.ts`. Export the function for testing or add a thin internal export.
7. Run side-repo `npm test` and `npm run typecheck`.
8. Run agent-repo `cd gemini-cli && npm run typecheck` and the CLI test slice (`npm run test --workspace @google/gemini-cli` or whatever the package script is — verify by reading `package.json`).

## Testing Strategy

Side-repo vitest for `stable-json.ts`. Agent-repo vitest for `snapshotTranscriptForResolution` end-to-end coverage. The dedicated stable-JSON tests prove deterministic serialization; the snapshot tests prove the full extraction chain reaches the search text.

## Validation Commands

- `cd /home/basil/projects/context-bonsai-agents/gemini-cli_context_bonsai && npm test`
- `cd /home/basil/projects/context-bonsai-agents/gemini-cli_context_bonsai && npm run typecheck`
- `cd /home/basil/projects/context-bonsai-agents/gemini-cli_context_bonsai && npm run build` (must rebuild side-repo `dist/` before agent-repo type-checks against new `stableSerialize` export)
- `cd /home/basil/projects/context-bonsai-agents/gemini-cli && npm run typecheck --workspace @google/gemini-cli`
- `cd /home/basil/projects/context-bonsai-agents/gemini-cli && npm run test --workspace @google/gemini-cli`

## Worktree Artifact Check

- Checked At: 2026-04-25
- Planned Target Files:
  - `gemini-cli_context_bonsai/src/stable-json.ts` (new)
  - `gemini-cli_context_bonsai/src/index.ts`
  - `gemini-cli_context_bonsai/test/stable-json.test.ts` (new)
  - `gemini-cli/packages/cli/src/utils/contextBonsaiBootstrap.ts`
  - `gemini-cli/packages/cli/src/utils/contextBonsaiBootstrap.test.ts`
- Overlaps Found (path + class): none. Both `gemini-cli/` and `gemini-cli_context_bonsai/` clean per `git status --short`.
- Escalation Status: none
- Decision Citation: n/a

## Plan Approval and Commit Status

- Approval Status: llm-agent-approved
- Approval Citation: validation loop iteration 2 cleared all findings (typecheck command corrected to `--workspace @google/gemini-cli`; `flattenMessageText` resolved to delete; helper colocation locked in `contextBonsaiBootstrap.ts`; "no recursion" rule for unknown object types committed; `stableSerialize` import path made explicit; side-repo rebuild step added).
- Plan Commit Hash: b243a03
- Ready-for-Orchestration: yes

## Validation Loop Results

- Missing details check: pass (iteration 2). Iter-1 findings: (1) root-level `typecheck` script doesn't exist — corrected to workspace-scoped; (2) caller graph for `flattenMessageText` confirmed (single internal caller); (3) side-repo build/d.ts emit verified; (4) test conventions confirmed vitest.
- Ambiguity check: pass (iteration 2). Iter-1 findings: (1) `flattenMessageText` fate — committed to delete; (2) helper colocation — committed to `contextBonsaiBootstrap.ts`; (3) recursion behavior on unknown objects — committed to "no recursion, empty string."
- Worktree artifact risk check: pass. Both submodules clean.
- Plan-commit status check: pending until commit.
- Iterations run: 2
