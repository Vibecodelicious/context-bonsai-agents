# Story: Cline prune-wrapper filter

> **Revisions required (2026-04-25).** Spec changed after this draft was written: commits `cb61f00` (prune-wrapper filter clause), `4d87eb9` (per-agent mirror), and `9f1ca61` (Pattern Matching Contract bullet 1 SHOULD → MUST on tool-call name/input/output). Cline's `extractMessageText` renders `tool_use` as `[tool_use:NAME]` and drops `input` arguments entirely; image/document/thinking blocks within `tool_result.content` are also silently dropped. Story scope must expand to include text-extraction remediation before the wrapper-filter has any effect. Rescope before orchestration.

**Epic:** Context Bonsai Prune-Wrapper Filter
**Size:** Small
**Dependencies:** None

## Story Description

Implement the cross-agent spec's prune-wrapper filter rule for the Cline port. When `resolvePattern` finds multiple candidates on the ambiguity path, it MUST exclude messages whose canonical content is a prior `context-bonsai-prune` tool-use wrapper before returning the existing `pattern_ambiguous` error.

Cline's resolver is already generic-with-callback (`extractText: ExtractTextFn<Message>`), so the natural extension is a sibling optional callback `isPruneWrapper?: (m: Message) => boolean`. The side repo provides a content-block predicate helper for Anthropic-shaped messages; the agent repo's `ContextBonsaiApplier` callsite passes that helper to the resolver.

## User Model

### User Gamut
- VS Code users running long Cline tasks who retry a prune after first-attempt ambiguity
- Users on resumed tasks where prior failed prune-call wrappers persist in `apiConversationHistory`
- Maintainers preserving the existing generic callback pattern in `resolvePattern`

### User-Needs Gamut
- Retry stability after first-attempt ambiguity
- No silent boundary selection
- Generic resolver design preserved (no Anthropic shape leaks into side-repo guards.ts)

### Design Implications
- Side repo: resolver gains an optional second callback. The Anthropic-shaped helper is a separate exported function.
- Agent repo: `ContextBonsaiApplier.ts` callsite passes the helper. No other agent-repo files touched.
- Detection: scan the `content` array of the ClineStorageMessage for a `tool_use` block with `name` equal to `context-bonsai-prune` or `mcp__context-bonsai__context-bonsai-prune`.

## Acceptance Criteria

- [ ] `cline_context_bonsai/src/guards.ts` `resolvePattern` accepts an optional `isPruneWrapper?: (m: Message) => boolean` callback parameter.
- [ ] When `isPruneWrapper` is omitted, `resolvePattern` behavior is identical to the v1 implementation (regression-safe default).
- [ ] When `isPruneWrapper` is provided and `hits.length > 1`, the resolver filters wrappers BEFORE returning the `pattern_ambiguous` error. If exactly one non-wrapper candidate remains, return it; otherwise the existing error fires unchanged.
- [ ] `cline_context_bonsai/src/guards.ts` (or a sibling pure module re-exported from `index.ts`) exports a content-block helper, e.g. `isPruneToolUseInContent(content: unknown): boolean`, that returns true iff the Anthropic content array contains a `{ type: "tool_use", name: <native or MCP-prefixed prune name> }` block. Both names listed explicitly.
- [ ] `cline/src/core/task/ContextBonsaiApplier.ts` callsite (around `:202-205`) passes the content-block helper as `isPruneWrapper: (m) => isPruneToolUseInContent(m.content)`.
- [ ] Single-match path untouched.
- [ ] Zero-match path untouched.
- [ ] Tests in `cline_context_bonsai/test/guards.test.ts` cover all four outcomes (filter-then-1, filter-then-0, filter-then-many, single-match-untouched). Use a fixture that includes a `kind: "tool_use_open"` style label so the test reads as "this is a prune wrapper".
- [ ] Predicate helper has dedicated tests covering both accepted tool names + non-prune tool name + plain string content + empty array.
- [ ] All existing tests pass: side-repo 42 mocha tests, agent-repo `npm run test:unit` (1435 tests), `test:webview` (150).

## Context References

### Relevant Codebase Files (must read)
- `/home/basil/projects/context-bonsai-agents/cline_context_bonsai/src/guards.ts:68-106` — `resolvePattern<Message>` signature + ambiguity branch (`:96-104`)
- `/home/basil/projects/context-bonsai-agents/cline_context_bonsai/src/index.ts` — public re-exports
- `/home/basil/projects/context-bonsai-agents/cline_context_bonsai/test/guards.test.ts:1-35` — existing test conventions (mocha + should.js, inline `Msg` fixture)
- `/home/basil/projects/context-bonsai-agents/cline/src/core/task/ContextBonsaiApplier.ts:131-154` — existing `extractMessageText` pattern (helper that traverses `content` array)
- `/home/basil/projects/context-bonsai-agents/cline/src/core/task/ContextBonsaiApplier.ts:202-205` — `resolvePattern` callsite (target for new callback wiring)

### Reference Implementation
- `/home/basil/projects/opencode_context_bonsai_plugin/src/prune-pattern.ts:85-107`
- `/home/basil/projects/the_observer/.agents/plans/story-context-bonsai-v2-prune-call-filtering.md`

### Relevant Documentation
- `/home/basil/projects/context-bonsai-agents/docs/context-bonsai-agent-spec.md` (commit `cb61f00`)
- `/home/basil/projects/context-bonsai-agents/docs/agent-specs/cline-context-bonsai-spec.md` (commit `4d87eb9`)

### Anthropic content-block shape
- A `tool_use` block has shape `{ type: "tool_use", id: string, name: string, input: Record<string, unknown> }`.
- A `tool_result` block has shape `{ type: "tool_result", tool_use_id: string, content: string | ContentBlockParam[] }`.
- Detection scope: tool-USE blocks only. Tool-result blocks do not echo the `from_pattern` / `to_pattern` arguments (matches the_observer story's narrowing).

## Implementation Plan

### Phase 1: Side-repo callback parameter
- Add `isPruneWrapper?: (m: Message) => boolean` to `resolvePattern`. When undefined or absent, preserve existing behavior bit-for-bit.

### Phase 2: Side-repo filter integration
- In `resolvePattern` ambiguity branch (`:96-104`), if `isPruneWrapper` is defined and `hits.length > 1`, compute `nonWrappers = hits.filter(i => !isPruneWrapper(messages[i]!))`. If `nonWrappers.length === 1` return that index; otherwise return existing error unchanged.

### Phase 3: Side-repo content-block helper
- Export `isPruneToolUseInContent(content: unknown): boolean`. Defensive narrowing of `unknown` to `ContentBlockParam[]` before scan. Scan for `type === "tool_use"` blocks naming either accepted name.

### Phase 4: Agent-repo callsite
- Update `ContextBonsaiApplier.ts:202-205` to pass `isPruneWrapper: (m) => isPruneToolUseInContent(m.content)` for both `resolvePattern` calls (`from_pattern` and `to_pattern`).

### Phase 5: Tests
- Side-repo: predicate unit tests + four resolver outcome tests (with and without the callback to confirm regression safety).
- No new agent-repo tests required because the callback is a thin adapter; existing applier tests confirm the resolver produces the expected outputs end-to-end.

## Step-by-Step Tasks

1. Read all five files above to confirm symbols and shapes.
2. Add the optional callback parameter to `resolvePattern`.
3. Add the content-block predicate helper.
4. Add filter logic in the ambiguity branch.
5. Update the applier callsite to pass the helper.
6. Add side-repo tests.
7. Run validation; fix type errors.

## Testing Strategy

Side-repo mocha + should.js for the resolver / predicate. Agent-repo behavior is exercised end-to-end by existing applier tests; one of those tests can be lightly extended (or a new one added) if you want explicit ambiguity-with-wrappers coverage at the applier layer.

## Validation Commands

- `cd /home/basil/projects/context-bonsai-agents/cline_context_bonsai && npm test`
- `cd /home/basil/projects/context-bonsai-agents/cline_context_bonsai && npm run typecheck`
- `cd /home/basil/projects/context-bonsai-agents/cline && npm run check-types`
- `cd /home/basil/projects/context-bonsai-agents/cline && npm run test:unit`

## Worktree Artifact Check

- Checked At: 2026-04-24
- Planned Target Files:
  - `cline_context_bonsai/src/guards.ts`
  - `cline_context_bonsai/src/index.ts` (re-export)
  - `cline_context_bonsai/test/guards.test.ts`
  - `cline/src/core/task/ContextBonsaiApplier.ts`
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
