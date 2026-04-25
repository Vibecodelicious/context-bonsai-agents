# Story: Cline prune-wrapper filter on the ambiguity path

## Goal

Implement the cross-agent spec's prune-wrapper filter (commit `cb61f00`, MUST) for the Cline port. When `resolvePattern` finds multiple matches on the ambiguity path, it MUST exclude messages whose canonical content is a prior `context-bonsai-prune` tool-use wrapper before returning the existing `pattern_ambiguous` error.

This is load-bearing once C1 lands: with `tool_use.input` in search text, failed-prune `from_pattern`/`to_pattern`/`summary` will collide with retry patterns. The filter prevents the self-poisoning loop.

Source issue: `.agents/issues/cline-issues.md` Issue C3 (verified, evidence-backed).

## Dependencies

- **Must land with C1 (`story-cline-tool-use-input-args.md`) and C2 (`story-cline-non-text-content-blocks.md`).** C1 makes failed-prune args searchable, which re-introduces self-poisoning. C3 is the mitigation. Without C1, C3 is a no-op (today's failed-prune args don't reach search text). Without C3, C1 ships in a self-poisoning state.

## User Model

### User Gamut
- VS Code Cline users who hit `pattern_ambiguous` on the first prune and retry with a refined pattern
- Maintainers reviewing the filter behavior in isolation

### User-Needs Gamut
- Retry stability after first-attempt ambiguity
- No silent boundary selection when multiple non-wrapper candidates remain
- No regression in single-match or zero-match paths
- Backward-compatible side-repo API (existing callers pass 4 args; the new callback is optional)

### Ambiguities From User Model
- **Where to detect wrapper-ness:** in the resolver (would need raw `Message[]`) OR via a callback. Resolved: callback. Cline's `resolvePattern` is already generic-with-callback (`extractText: ExtractTextFn<Message>`) — adding a sibling `isPruneWrapper?: (m: Message) => boolean` callback fits the existing design.
- **Tool name match:** Cline's prune tool is native (no MCP prefix; `cline/src/shared/tools.ts:36` defines `CONTEXT_BONSAI_PRUNE = "context-bonsai-prune"`). Resolved: filter on the literal `"context-bonsai-prune"` only.

## Context References

- `cline_context_bonsai/src/guards.ts:68-106` — `resolvePattern<Message>` with the `extractText` callback design. Ambiguity branch at `:96-104`.
- `cline_context_bonsai/src/index.ts` — public re-exports.
- `cline/src/core/task/ContextBonsaiApplier.ts:202-205` — both `resolvePattern` callsites (`from_pattern` and `to_pattern`).
- `cline/src/core/task/ContextBonsaiApplier.ts:131-153` — `extractMessageText` (consumer of the same canonical content shape the predicate will scan).
- `cline/src/shared/tools.ts:36` — `CONTEXT_BONSAI_PRUNE = "context-bonsai-prune"`.
- `cline/src/core/task/tools/handlers/ContextBonsaiPruneHandler.ts:18-19` — confirms the tool name registration.
- `opencode_context_bonsai_plugin/src/prune-pattern.ts:85-107` — reference filter behavior on ambiguity branch only.
- Anthropic SDK — `tool_use` block shape: `{ type: "tool_use", id: string, name: string, input: unknown }`.
- `docs/context-bonsai-agent-spec.md` Pattern Matching Contract — spec authority.
- `docs/agent-specs/cline-context-bonsai-spec.md` — Cline's mirror.

## Acceptance Criteria

- [ ] `cline_context_bonsai/src/guards.ts` `resolvePattern<Message>` gains an optional 5th parameter `isPruneWrapper?: (m: Message) => boolean`.
- [ ] When `isPruneWrapper` is omitted, `resolvePattern` behavior is byte-identical to v1 (regression-safe default for any existing external caller).
- [ ] When `isPruneWrapper` is provided AND `hits.length > 1`, the resolver computes `survivors = hits.filter(h => !isPruneWrapper(messages[h.index]))`. If `survivors.length === 1`, return that single survivor with `ok: true`. Otherwise fall through to the existing `pattern_ambiguous` error (count parameter unchanged: report the original `hits.length`).
- [ ] Single-match path (`hits.length === 1`) is untouched.
- [ ] Zero-match path is untouched.
- [ ] A new module `cline_context_bonsai/src/content.ts` exports `isPruneToolUseInContent(content: unknown): boolean`. Returns true iff the input is an array containing any block with `block?.type === "tool_use"` AND `block?.name === "context-bonsai-prune"`. Defensively handles `unknown`: returns false for non-arrays, strings, null, undefined, empty arrays.
- [ ] The helper does NOT check `state?.status === 'completed'` (Anthropic `tool_use` blocks have no status field; presence in the transcript implies the call was made).
- [ ] `cline_context_bonsai/src/index.ts` re-exports `isPruneToolUseInContent`.
- [ ] `cline/src/core/task/ContextBonsaiApplier.ts:202-205` callsites pass `isPruneWrapper: (m: Anthropic.MessageParam) => isPruneToolUseInContent(m.content)` to BOTH `resolvePattern` calls (from + to).
- [ ] Tests in `cline_context_bonsai/test/guards.test.ts`:
  1. **filter→1**: two hits, one wrapper + one real → returns the real index, `ok: true`.
  2. **filter→0**: two hits, both wrappers → existing `pattern_ambiguous` error.
  3. **filter→>1**: three hits, two non-wrappers + one wrapper → existing error.
  4. **single-match-untouched**: one hit (a wrapper) → returns the wrapper index without filtering.
  5. **callback omitted**: explicit test confirming v1 byte-identical behavior with no `isPruneWrapper` argument.
- [ ] Predicate tests in `cline_context_bonsai/test/content.test.ts` (new) or appended to `guards.test.ts`:
  - True for `[{ type: "tool_use", name: "context-bonsai-prune", id, input }]`.
  - False for plain string content.
  - False for `tool_use` block with a different name.
  - False for `tool_result` blocks.
  - False for `undefined`, `null`, non-array.
  - False for empty array.
- [ ] Side-repo `npm test` and `npm run typecheck` pass.
- [ ] Agent-repo `npm run check-types` passes; `npm run test:unit` passes.

## Implementation Tasks

1. Add `isPruneToolUseInContent` to `cline_context_bonsai/src/content.ts` (new file). Re-export from `cline_context_bonsai/src/index.ts`.
2. Modify `resolvePattern<Message>` signature in `cline_context_bonsai/src/guards.ts:68-73` to accept an optional 5th parameter `isPruneWrapper?: (m: Message) => boolean`.
3. In the ambiguity branch (`:96-104`), if `isPruneWrapper` is defined and `hits.length > 1`, compute `survivors = hits.filter(...)`; if `survivors.length === 1`, return `{ ok: true, value: survivors[0].index }`; otherwise return the existing error with `hits.length` as the count.
4. Update `cline/src/core/task/ContextBonsaiApplier.ts:202-205` to pass the predicate as the 5th argument to both `resolvePattern` calls.
5. Add the resolver outcome tests + the regression test for callback omitted to `cline_context_bonsai/test/guards.test.ts`.
6. Add the predicate tests to `cline_context_bonsai/test/content.test.ts` (new — mirrors the source split).
7. Run side-repo `npm test` and `npm run typecheck`.
8. Run agent-repo `npm run check-types` and `npm run test:unit`.

## Testing Strategy

Side-repo mocha + should.js for the resolver and predicate. The predicate is exercised via callback in resolver tests using a synthetic `isPruneWrapper: (m) => m.id.startsWith("wrapper-")` shorthand for the inline cases; the dedicated predicate tests cover the actual content-block shape detection.

## Validation Commands

- `cd /home/basil/projects/context-bonsai-agents/cline_context_bonsai && npm test`
- `cd /home/basil/projects/context-bonsai-agents/cline_context_bonsai && npm run typecheck`
- `cd /home/basil/projects/context-bonsai-agents/cline && npm run check-types`
- `cd /home/basil/projects/context-bonsai-agents/cline && npm run test:unit`

## Worktree Artifact Check

- Checked At: 2026-04-25
- Planned Target Files:
  - `cline_context_bonsai/src/content.ts` (new)
  - `cline_context_bonsai/src/guards.ts`
  - `cline_context_bonsai/src/index.ts`
  - `cline_context_bonsai/test/content.test.ts` (new)
  - `cline_context_bonsai/test/guards.test.ts` (extend with resolver outcome tests)
  - `cline/src/core/task/ContextBonsaiApplier.ts` (callsites at `:203` and `:205`)
- Overlaps Found (path + class): none. Both `cline/` and `cline_context_bonsai/` clean per `git status --short`. C1 modifies `ContextBonsaiApplier.ts:139-140`; C3 modifies `:202-205`. Same file but disjoint regions; safe to land in same PR.
- Escalation Status: none
- Decision Citation: n/a

## Plan Approval and Commit Status

- Approval Status: llm-agent-approved
- Approval Citation: validation loop iteration 2 cleared all findings (resolved predicate-location ambiguity to `content.ts`; resolved test-file ambiguity to `content.test.ts`; tightened callsite citations to `:203`/`:205`).
- Plan Commit Hash: pending-next-commit
- Ready-for-Orchestration: yes (after this plan is committed and the Plan Commit Hash field is updated)

## Validation Loop Results

- Missing details check: pass (iteration 2). Iter-1 confirmed: signature accuracy, ambiguity-branch quote accuracy, return-type `value: number`, `hits` data structure (`PatternMatchCandidate[]`).
- Ambiguity check: pass (iteration 2). Iter-1 findings: (1) predicate location — committed to `content.ts`; (2) predicate test file — committed to `content.test.ts`; (3) callsite line numbers tightened.
- Worktree artifact risk check: pass. Both submodules clean.
- Plan-commit status check: pending until commit.
- Iterations run: 2
