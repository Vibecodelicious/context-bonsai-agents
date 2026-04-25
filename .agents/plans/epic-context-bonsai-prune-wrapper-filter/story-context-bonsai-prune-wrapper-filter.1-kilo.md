# Story: Kilo prune-wrapper filter

> **Revisions required (2026-04-25).** Spec changed after this draft was written: commits `cb61f00` (prune-wrapper filter clause), `4d87eb9` (per-agent mirror), and `9f1ca61` (Pattern Matching Contract bullet 1 SHOULD → MUST on tool-call name/input/output). Kilo's `getText` skips ALL non-text parts; tool-call content is unreachable by pattern. Story scope must expand to include text-extraction remediation before the wrapper-filter has any effect. Rescope before orchestration.

**Epic:** Context Bonsai Prune-Wrapper Filter
**Size:** Small
**Dependencies:** None

## Story Description

Implement the cross-agent spec's prune-wrapper filter rule for the Kilo port. When `resolvePattern` finds multiple candidates on the ambiguity path, it MUST exclude messages whose canonical content is a prior `context-bonsai-prune` tool-use wrapper before returning the existing ambiguity error. If exactly one non-wrapper candidate remains, return it; otherwise return the existing error unchanged.

This is a pure side-repo change. Kilo's resolver already takes a flattened `MessageText[]` shape, and the flatten step lives in the side repo (`factory.ts`), so no agent-repo edits are needed.

## User Model

### User Gamut
- Kilo CLI users in long sessions who retry a prune after a first-attempt ambiguity error
- VS Code users on the bundled Kilo runtime
- Maintainers reviewing side-repo behavior in isolation

### User-Needs Gamut
- Retry stability after first-attempt ambiguity
- No silent boundary selection
- No regression in single-match or zero-match paths

### Design Implications
- Add `isPruneWrapper?: boolean` to the existing `MessageText` shape so the resolver stays shape-agnostic.
- Detection of a prune-wrapper inspects `Part[]` for `type: "tool"` blocks with `tool` (or equivalent name field) equal to either `context-bonsai-prune` or `mcp__context-bonsai__context-bonsai-prune`.

## Acceptance Criteria

- [ ] `kilo_context_bonsai/src/guards.ts` `MessageText` type carries an optional `isPruneWrapper?: boolean` field.
- [ ] `kilo_context_bonsai/src/guards.ts` exports a pure helper (e.g. `isPruneToolWrapper(parts: Part[]): boolean`) that returns true iff any part is a tool-use block naming `context-bonsai-prune` or `mcp__context-bonsai__context-bonsai-prune`. Both names are explicitly listed in the helper's body so future tool-name changes update both deliberately.
- [ ] `kilo_context_bonsai/src/factory.ts` flatten step populates `isPruneWrapper` for each `MessageText` it produces.
- [ ] `resolvePattern` ambiguity branch (`guards.ts:28-30`) filters out wrappers BEFORE returning the existing ambiguous error. If exactly one non-wrapper candidate remains, return it; otherwise the existing error fires unchanged.
- [ ] Single-match (`hits.length === 1`) path is untouched.
- [ ] Zero-match path is untouched.
- [ ] Tests in `kilo_context_bonsai/test/guards.test.ts` cover all four outcomes:
  - filter-then-1: pattern matches multiple candidates including wrappers; exactly one non-wrapper survives → returns it
  - filter-then-0: pattern matches only wrappers → existing ambiguity error
  - filter-then-many: pattern matches multiple non-wrappers (with or without wrappers mixed in) → existing ambiguity error
  - single-match-untouched: pattern matches exactly one wrapper-only message → returns it without filtering
- [ ] Predicate has its own dedicated tests covering both accepted tool names + the non-prune negative case.
- [ ] All existing 39+ side-repo tests still pass.
- [ ] No agent-repo (`context-bonsai-kilo/kilocode/`) changes; verify by `git status` after edits.

## Context References

### Relevant Codebase Files (must read)
- `/home/basil/projects/context-bonsai-agents/kilo_context_bonsai/src/guards.ts:17` — `resolvePattern(messages: MessageText[], pattern: string): ResolveResult`
- `/home/basil/projects/context-bonsai-agents/kilo_context_bonsai/src/guards.ts:28-30` — current ambiguity branch (target for filter insertion)
- `/home/basil/projects/context-bonsai-agents/kilo_context_bonsai/src/factory.ts:54-64` — `PluginMessage` / `Part` types
- `/home/basil/projects/context-bonsai-agents/kilo_context_bonsai/src/factory.ts` — flatten loop that builds `MessageText[]` (target for populator)
- `/home/basil/projects/context-bonsai-agents/kilo_context_bonsai/test/guards.test.ts` — existing test conventions (`bun:test`, `describe`/`test`, `.ok` discrimination)

### Reference Implementation
- `/home/basil/projects/opencode_context_bonsai_plugin/src/prune-pattern.ts:85-107` — `isPruneCandidate` filter (note: opencode also checks `state?.status === 'completed'`; this story drops that check per cross-agent spec to avoid host-shape coupling)
- `/home/basil/projects/the_observer/.agents/plans/story-context-bonsai-v2-prune-call-filtering.md` — sister story with the rationale for accepting both tool names

### Relevant Documentation
- `/home/basil/projects/context-bonsai-agents/docs/context-bonsai-agent-spec.md` — Pattern Matching Contract section (commit `cb61f00`)
- `/home/basil/projects/context-bonsai-agents/docs/agent-specs/kilo-context-bonsai-spec.md` — Prune and retrieve contract section (commit `4d87eb9`)

## Implementation Plan

### Phase 1: Predicate
- Add `isPruneToolWrapper(parts: Part[]): boolean` to `guards.ts` (or a sibling pure module). Inspect `Part[]` for `type === "tool"` with `tool` matching either accepted name. Defensive: tolerate missing/extra fields per Kilo's polymorphic `OtherPart` shape.

### Phase 2: Type extension and population
- Extend `MessageText` with `isPruneWrapper?: boolean`.
- In `factory.ts`'s flatten loop (where `PluginMessage[] → MessageText[]` happens), set `isPruneWrapper: isPruneToolWrapper(message.parts)`.

### Phase 3: Filter integration
- In `resolvePattern` ambiguity branch (`guards.ts:28-30`), before returning the existing error, compute `nonWrappers = hits.filter(i => !messages[i]?.isPruneWrapper)`. If `nonWrappers.length === 1`, return `{ ok: true, index: nonWrappers[0]! }`. Otherwise fall through to the existing ambiguity error unchanged.

### Phase 4: Tests
- Predicate tests (positive: native name, MCP-prefixed name; negative: non-prune tool, text-only message).
- Resolver tests (the four ambiguity outcomes listed in ACs).

## Step-by-Step Tasks

1. Read `guards.ts` and `factory.ts` to confirm the exact symbols I expect to find.
2. Add `isPruneToolWrapper` predicate.
3. Extend `MessageText` and populate via the flatten loop.
4. Add the filter logic in the resolver's ambiguity branch.
5. Add the predicate + resolver tests.
6. Run `bun test` and `bun run typecheck`; fix any type errors.

## Testing Strategy

Side-repo `bun:test` only. Use inline `MessageText[]` fixtures with `isPruneWrapper` flags set by hand for resolver tests; use small `Part[]` fixtures for predicate tests.

## Validation Commands

- `cd /home/basil/projects/context-bonsai-agents/kilo_context_bonsai && bun test`
- `cd /home/basil/projects/context-bonsai-agents/kilo_context_bonsai && bun run typecheck`

## Worktree Artifact Check

- Checked At: 2026-04-24
- Planned Target Files:
  - `kilo_context_bonsai/src/guards.ts`
  - `kilo_context_bonsai/src/factory.ts`
  - `kilo_context_bonsai/test/guards.test.ts`
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
