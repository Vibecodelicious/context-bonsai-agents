# Story: Cline tool_use blocks include input arguments in search text

## Goal

Bring Cline's text extractor into compliance with the cross-agent spec's Pattern Matching Contract bullet 1 (MUST, since commit `9f1ca61`): tool-call name AND input must be reachable by `from_pattern`/`to_pattern`. Today `extractMessageText` at `cline/src/core/task/ContextBonsaiApplier.ts:131-153` renders an Anthropic `tool_use` block as `[tool_use:${name}]` only — the `input` arguments are dropped entirely, so a pattern matching a tool argument value cannot resolve.

Source issue: `.agents/issues/cline-issues.md` Issue C1 (verified, evidence-backed).

## Dependencies

- **Must land with C2 (`story-cline-non-text-content-blocks.md`) and C3 (`story-cline-prune-wrapper-filter.md`).** All three modify `extractMessageText` (C1, C2) or its consumers (C3); landing them together avoids multiple passes over the same function. C3 is the load-bearing mitigation for the self-poisoning that C1 enables (failed-prune `input` JSON in retry corpus).

## User Model

### User Gamut
- VS Code Cline users trying to prune by tool argument value (e.g. a file path passed to `read_file`, a search query passed to `web_search`)
- Maintainers reviewing parity against the OpenCode reference

### User-Needs Gamut
- Tool-call messages reachable by pattern via name AND input arguments
- Stable representation (deterministic key order)
- Backward compatibility for callers that match on the existing `[tool_use:${name}]` token (the leading prefix is preserved)

### Ambiguities From User Model
- **Output format:** could be a single-line `[tool_use:${name} ${stableJson(input)}]` or split lines with prefixes like the Kilo K1 format. Resolved: single-line bracketed form so existing `parts.join("\n")` boundaries don't shift; preserves the leading `[tool_use:${name}` so any caller that string-checks for the prior format still finds the prefix.
- **Where the stable-JSON helper lives:** could be repeated per port or shared. Resolved: new file `cline_context_bonsai/src/stable-json.ts` modeled on the OpenCode reference. The same helper will be ported per-port (mirroring K1's plan) — there's no cross-port sharing infrastructure today.

## Context References

- `cline/src/core/task/ContextBonsaiApplier.ts:131-153` — `extractMessageText`, the function to extend.
- `cline/src/core/task/ContextBonsaiApplier.ts:139-140` — current `tool_use` rendering: `parts.push(\`[tool_use:${(block as Anthropic.ToolUseBlockParam).name}]\`)`.
- `cline/src/core/task/ContextBonsaiApplier.ts:203-205` — both `resolvePattern` callsites.
- `cline_context_bonsai/src/guards.ts:68-106` — `resolvePattern` (consumer of `extractText`).
- Anthropic SDK `cline/node_modules/@anthropic-ai/sdk/resources/messages/messages.d.ts` — `ToolUseBlockParam = { type: "tool_use"; id: string; name: string; input: unknown }`.
- `opencode_context_bonsai_plugin/src/prune-pattern.ts:6-51` — `stableSerialize` / `normalizeForStableJson` reference to port verbatim.
- `cline/src/core/task/__tests__/ContextBonsaiApplier.test.ts` — existing applier test conventions.
- `cline_context_bonsai/test/guards.test.ts` — side-repo test conventions (mocha + should.js).
- `docs/context-bonsai-agent-spec.md` Pattern Matching Contract — spec authority.
- `docs/agent-specs/cline-context-bonsai-spec.md` — Cline's mirror of the rule.

## Acceptance Criteria

- [ ] A new file `cline_context_bonsai/src/stable-json.ts` exports `stableSerialize` and `normalizeForStableJson`, byte-equivalent to `opencode_context_bonsai_plugin/src/prune-pattern.ts:6-51`. Re-exported from `cline_context_bonsai/src/index.ts`.
- [ ] `extractMessageText` (`ContextBonsaiApplier.ts:131-153`) `tool_use` branch (`:139-140`) renders blocks as `[tool_use:${block.name} ${stableSerialize(block.input)}]` (single line). The leading `[tool_use:${name}` substring is preserved so any existing caller that string-checks for the prior format still matches.
- [ ] Behavior is sane and deterministic for empty/missing input: empty `{}` produces `[tool_use:${name} {}]`; `null` produces `[tool_use:${name} null]`; `undefined` produces `[tool_use:${name} null]` (top-level `undefined` falls back to `'null'` per the OpenCode reference's `stableSerialize` behavior). All three cases are exercised by tests.
- [ ] No agent-repo regression: existing `ContextBonsaiApplier.test.ts` cases (`:116, 199-200, 260` — all text-only) continue to pass with no fixture rewrites.
- [ ] New tests in `cline/src/core/task/__tests__/ContextBonsaiApplier.test.ts`:
  - `extractMessageText` returns `[tool_use:${name} ${stableJson}]` for a `tool_use` block.
  - End-to-end prune where `from_pattern` matches a string nested inside `input` (e.g. `path: "/etc/hosts"`) succeeds.
  - Deterministic-output check: same `input` object built with reversed key insertion order yields identical extracted string.
  - Empty/undefined/null `input` cases produce sensible output.
- [ ] New tests in `cline_context_bonsai/test/stable-json.test.ts`: key sorting, nested objects, arrays containing `undefined`, `bigint`, `toJSON` honoring, null/empty-object inputs, top-level `null`/`undefined`/function/symbol fallback to `'null'`.
- [ ] Side-repo `npm test` and `npm run typecheck` pass.
- [ ] Agent-repo `npm run check-types` passes; full agent-repo test suite passes for at least the `core/task/__tests__/` slice.
- [ ] No other consumers of `extractMessageText`'s output assume the old `[tool_use:${name}]` exact format. Verified by grep across `cline/src/`.

## Implementation Tasks

1. Port `stableSerialize` and `normalizeForStableJson` verbatim from `opencode_context_bonsai_plugin/src/prune-pattern.ts:6-51` into `cline_context_bonsai/src/stable-json.ts`. Re-export from `cline_context_bonsai/src/index.ts`.
2. Modify `extractMessageText` `tool_use` branch (`ContextBonsaiApplier.ts:139-140`):
   ```ts
   } else if ((block as Anthropic.ToolUseBlockParam).type === "tool_use") {
     const tu = block as Anthropic.ToolUseBlockParam
     parts.push(`[tool_use:${tu.name} ${stableSerialize(tu.input)}]`)
   }
   ```
3. Add `stable-json.test.ts` to `cline_context_bonsai/test/` with the cases listed in ACs.
4. Add the four `extractMessageText` cases to `cline/src/core/task/__tests__/ContextBonsaiApplier.test.ts`.
5. Run `cd cline_context_bonsai && npm test && npm run typecheck`.
6. Run `cd cline && npm run check-types && npm run test:unit -- --grep ContextBonsai` (or the equivalent narrow pattern) to confirm the applier slice; full `npm run test:unit` if narrower invocations are unsupported.
7. Verify by `grep -rn "\[tool_use:" cline/src` that no other consumer string-matches on the closing `]` immediately after `${name}`.

## Testing Strategy

Side-repo `mocha` + `should.js` for `stable-json.ts` (matches existing `cline_context_bonsai/test/guards.test.ts` convention). Agent-repo `mocha` + `should.js` for `extractMessageText` and end-to-end prune coverage (matches existing `cline/src/core/task/__tests__/ContextBonsaiApplier.test.ts` convention — both use mocha+should, not vitest).

## Validation Commands

- `cd /home/basil/projects/context-bonsai-agents/cline_context_bonsai && npm test`
- `cd /home/basil/projects/context-bonsai-agents/cline_context_bonsai && npm run typecheck`
- `cd /home/basil/projects/context-bonsai-agents/cline && npm run check-types`
- `cd /home/basil/projects/context-bonsai-agents/cline && npm run test:unit`

## Worktree Artifact Check

- Checked At: 2026-04-25
- Planned Target Files:
  - `cline_context_bonsai/src/stable-json.ts` (new)
  - `cline_context_bonsai/src/index.ts`
  - `cline_context_bonsai/test/stable-json.test.ts` (new)
  - `cline/src/core/task/ContextBonsaiApplier.ts`
  - `cline/src/core/task/__tests__/ContextBonsaiApplier.test.ts`
- Overlaps Found (path + class): none. Verified by `git status --short` in both `cline/` and `cline_context_bonsai/` — both clean, no overlap with planned targets.
- Escalation Status: none
- Decision Citation: n/a

## Plan Approval and Commit Status

- Approval Status: llm-agent-approved
- Approval Citation: validation loop iteration 2 cleared all findings (testing-framework wording corrected from vitest→mocha to match actual repo convention; null/undefined input behavior added to ACs).
- Plan Commit Hash: b243a03
- Ready-for-Orchestration: yes

## Validation Loop Results

- Missing details check: pass (iteration 2). Iter-1 findings: (1) agent-repo test convention is mocha+should, not vitest — corrected; (2) null/undefined input rendering added to ACs.
- Ambiguity check: pass (iteration 2). Iter-1 found no structural format ambiguity (`String#includes` matching is reliable on the bracketed form regardless of inner JSON characters).
- Worktree artifact risk check: pass. Both `cline/` and `cline_context_bonsai/` clean per `git status --short`.
- Plan-commit status check: pending until commit.
- Iterations run: 2
