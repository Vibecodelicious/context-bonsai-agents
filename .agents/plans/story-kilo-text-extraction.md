# Story: Kilo text-extraction surfaces tool-call structure

## Goal

Bring Kilo's plugin-side text extractor into compliance with the cross-agent spec's Pattern Matching Contract bullet 1 (MUST, since commit `9f1ca61`): tool-call name, input, and output must be reachable by `from_pattern`/`to_pattern`. Today `getText` in `kilo_context_bonsai/src/factory.ts:147-156` does `if (p.type !== "text") continue` and drops all tool parts, so an assistant message that is only a tool call yields empty search text and is unreachable.

Source issue: `.agents/issues/kilo-issues.md` Issue K1 (verified, evidence-backed).

## Dependencies

- **Must land with K2 (prune-wrapper filter).** This story alone makes failed-prune `from_pattern`/`to_pattern`/`summary` text searchable, which re-introduces the self-poisoning bug across the entire prune history. K2 (story `story-kilo-prune-wrapper-filter.md`) MUST land in the same change set as this story or strictly before it. Reviewers must reject a K1-only PR.

## User Model

### User Gamut
- Kilo CLI users in long sessions trying to prune a range whose boundary message is identified by a tool-call name (e.g. `read_file`)
- Kilo CLI users trying to prune by a tool argument value (e.g. a file path passed as a tool input)
- Kilo CLI users trying to prune by tool output content (e.g. text returned from a `bash` shell call)
- Maintainers porting Kilo Bonsai logic forward — the Kilo extractor sets the bar for parity with the OpenCode reference

### User-Needs Gamut
- Tool-call messages reachable by pattern via name, args, and output
- Stable representation that does not drift between sessions or rebuilds (deterministic JSON)
- Backward compatibility for existing patterns that target plain text (no regression)
- Compatibility with the prune-wrapper filter rule that ships in the same change

### Ambiguities From User Model
- **Format choice for stable args representation:** could be canonical JSON (current OpenCode reference shape) or a flatter `key=value` line-oriented form. Resolved: use canonical JSON via the OpenCode `stableSerialize`/`normalizeForStableJson` helpers ported verbatim. Rationale: same wire format across all four ports lets agents migrate patterns between hosts; the OpenCode reference is the model the cross-agent spec already cites.
- **Whether to include incomplete tool calls** (status `pending`/`running`): no, these have no settled `state.output` and a range ending on them is already rejected by `detectToolCut`. Searchable text for incomplete tool calls would be unstable across re-renders.

## Context References

- `kilo_context_bonsai/src/factory.ts:147-156` — `getText`, the extractor to extend.
- `kilo_context_bonsai/src/factory.ts:158-160` — `buildMessageTexts`, the flatten loop that calls `getText`.
- `kilo_context_bonsai/src/factory.ts:34-52` — `Part` / `OtherPart` / `TextPart` shapes.
- `context-bonsai-kilo/kilocode/packages/opencode/src/session/message-v2.ts:344-353` — runtime `ToolPart` shape: `type: "tool"`, `tool: string`, `state: ToolState` with `state.input`, `state.output`, `state.error`, `state.status`.
- `context-bonsai-kilo/kilocode/packages/opencode/src/session/processor.ts:270-337` and `.../prompt.ts:562-579` — tool-part construction sites confirming field names.
- `kilo_context_bonsai/src/factory.ts:412-429` — `detectToolCut` (already gates on `p.type === "tool"` with `state.status`); rejects ranges ending on incomplete tool calls.
- `opencode_context_bonsai_plugin/src/prune-pattern.ts:6-51` — reference `stableSerialize` / `normalizeForStableJson` to port verbatim.
- `opencode_context_bonsai_plugin/src/prune-pattern.ts:53-83` — reference `buildMessageSearchCorpus` showing the per-part shape: `tool:${tool}\ninput:${stableSerialize(input)}\noutput:${stableSerialize(output)}` joined by `\n<bonsai-part>\n`.
- `kilo_context_bonsai/test/plugin.test.ts:26-33` — existing test convention (`bun:test`, inline `msg()` helper, `describe`/`test`).
- `docs/context-bonsai-agent-spec.md` Pattern Matching Contract — spec authority (commit `9f1ca61`).
- `docs/agent-specs/kilo-context-bonsai-spec.md` — Kilo's mirror of the rule (commit `4d87eb9`).

## Acceptance Criteria

- [ ] `getText` is extended in place (no sibling extractor) and emits a stable text representation for every `type: "tool"` part with `state.status === "completed"` containing: tool name, canonical-JSON input, and output text.
- [ ] Tool parts with `state.status === "error"` emit name + canonical-JSON input + error text. (Note: `detectToolCut` at `factory.ts:412-429` rejects ranges ending on `pending`/`running` only — `error`-status tools ARE valid at range boundaries and must be searchable.)
- [ ] Tool parts with `state.status === "pending"` or `"running"` emit no text (already excluded from valid prune ranges by `detectToolCut`).
- [ ] Per-part segments are joined by `\n<bonsai-part>\n` (verified to match the OpenCode reference exactly at `opencode_context_bonsai_plugin/src/prune-pattern.ts:4`) so a pattern cannot accidentally bridge two parts.
- [ ] Each segment carries explicit prefixes (`text:`, `tool:`, `input:`, `output:`, `error:`) so users can target specifically. The `text:` prefix is added to existing text-only segments too — verified safe because `plugin.test.ts:26-33` does not assert exact corpus strings and pattern resolution uses substring matching.
- [ ] A new file `kilo_context_bonsai/src/stable-json.ts` exports `stableSerialize` / `normalizeForStableJson` with byte-equivalent behavior to the OpenCode reference at `prune-pattern.ts:6-51`.
- [ ] `state.output` and `state.error` are NOT wrapped in `stableSerialize` — Kilo runtime stores these as plain strings (per `message-v2.ts:344-353`). Only `state.input` (a `Record<string, unknown>`) gets canonical-JSON treatment.
- [ ] Existing pure-text resolution behavior is unchanged: tests at `kilo_context_bonsai/test/plugin.test.ts` continue to pass with no fixture rewrites.
- [ ] New tests live in `kilo_context_bonsai/test/plugin.test.ts` (extend the existing file; do NOT create a sibling `factory.test.ts`) and cover: tool-only message reachable by tool-name pattern; reachable by input-value pattern; reachable by output-substring pattern; pending/running tool parts NOT reachable; error-status tool parts reachable by `error:` substring pattern; key-order-independent serialization (same input object reordered yields identical text); mixed text+tool message remains reachable by either subsegment.
- [ ] `bun test` and `bun run typecheck` both pass.
- [ ] No agent-repo (`context-bonsai-kilo/kilocode/`) edits required.

## Implementation Tasks

1. Port `stableSerialize` and `normalizeForStableJson` from `opencode_context_bonsai_plugin/src/prune-pattern.ts:6-51` verbatim into a new file `kilo_context_bonsai/src/stable-json.ts`. Re-export from `kilo_context_bonsai/src/index.ts`.
2. Extend `getText` in place at `kilo_context_bonsai/src/factory.ts:147-156` (do not introduce a sibling extractor):
   - Continue handling `type === "text"` exactly as today (synthetic/ignored stripped), but emit each chunk prefixed with `text:`.
   - Add a branch for `type === "tool"`: read `(p as OtherPart).tool` and `(p as OtherPart).state`. If `state.status === "completed"`, append `tool:${tool}\ninput:${stableSerialize(state.input)}\noutput:${state.output ?? ""}`. If `state.status === "error"`, append `tool:${tool}\ninput:${stableSerialize(state.input)}\nerror:${state.error ?? ""}`. Otherwise emit nothing. Do NOT wrap `state.output` / `state.error` in `stableSerialize` — they are plain strings on the Kilo runtime (per `message-v2.ts:344-353`).
   - Replace the join from `\n` to `\n<bonsai-part>\n` between segments so a substring cannot bridge two parts.
3. Add tests by extending `kilo_context_bonsai/test/plugin.test.ts` (do NOT create a sibling test file):
   - Tool-only message (completed): `from_pattern: "read_file"` resolves; `from_pattern: "/etc/hosts"` (an input value) resolves; `from_pattern: substring(state.output)` resolves.
   - Mixed text + tool: both subsegments resolve independently.
   - Pending tool: no resolution (returns `pattern not found`).
   - Running tool: no resolution.
   - Error-status tool: `from_pattern: substring(state.error)` resolves; output-substring patterns do NOT (no `output:` segment was emitted).
   - Stable serialization: two `state.input` objects with identical contents but different key insertion orders produce identical search text.
4. Add a `toolMsg()` helper in the test file alongside the existing `msg()` so future tests can build tool-only messages cleanly.
5. Run `bun test` and verify zero regressions.
6. Run `bun run typecheck` and fix any errors.

## Testing Strategy

Side-repo `bun:test` only. No agent-repo changes. Existing pattern resolution tests cover the regression-safety. New tests prove the spec-bullet-1 compliance for tool-call name, input, and output in all three states (`completed`, `error`, `pending`/`running`).

## Validation Commands

- `cd /home/basil/projects/context-bonsai-agents/kilo_context_bonsai && bun test`
- `cd /home/basil/projects/context-bonsai-agents/kilo_context_bonsai && bun run typecheck`

## Worktree Artifact Check

- Checked At: 2026-04-25
- Planned Target Files:
  - `kilo_context_bonsai/src/factory.ts`
  - `kilo_context_bonsai/src/stable-json.ts` (new)
  - `kilo_context_bonsai/src/index.ts`
  - `kilo_context_bonsai/test/plugin.test.ts` (extend)
- Overlaps Found (path + class): none. Verified by `git status --short` in `kilo_context_bonsai/` — submodule clean.
- Escalation Status: none
- Decision Citation: n/a

## Plan Approval and Commit Status

- Approval Status: llm-agent-approved
- Approval Citation: validation loop iteration 2 cleared all blocking findings (4 missing details + 4 high-impact ambiguities resolved); see Validation Loop Results below.
- Plan Commit Hash: pending-next-commit
- Ready-for-Orchestration: yes (after this plan is committed and the Plan Commit Hash field is updated)

## Validation Loop Results

- Missing details check: pass (iteration 2). Iter-1 findings: (1) deviation from OpenCode reference on `state.output`/`state.error` serialization — addressed in ACs and Task 2; (2) `detectToolCut` does not exclude `error`-status — clarified in ACs; (3) test file location ambiguous — committed to `plugin.test.ts`; (4) K2 coupling not surfaced — added Dependencies section.
- Ambiguity check: pass (iteration 2). Iter-1 findings: (1) "extend or sibling" — committed to extend in place; (2) `text:` prefix optional gate — committed to YES; (3) `stable-json.ts` "(or equivalent name)" — committed to that exact filename; (4) test file ambiguity — committed to `plugin.test.ts`.
- Worktree artifact risk check: pass. `git status --short` in `kilo_context_bonsai` is empty; submodule clean; planned targets do not overlap any tracked-dirty or existing-untracked file.
- Plan-commit status check: pending until this file is committed (will be filled in by post-commit update).
- Iterations run: 2
