# Story: Kilo prune-wrapper filter on the ambiguity path

## Goal

Implement the cross-agent spec's prune-wrapper filter (commit `cb61f00`, MUST) for the Kilo port. When `resolvePattern` finds multiple matches on the ambiguity path, it MUST exclude messages whose canonical content is a prior `context-bonsai-prune` tool-use wrapper before returning the existing ambiguity error. If exactly one non-wrapper candidate remains, return it; otherwise the existing error fires unchanged.

This story ships in the same change as K1 (`story-kilo-text-extraction.md`). K1 makes tool-call args searchable, which re-introduces the self-poisoning bug across all prior prune messages. K2 is the load-bearing mitigation.

Source issue: `.agents/issues/kilo-issues.md` Issue K2 (verified, evidence-backed).

## User Model

### User Gamut
- Kilo CLI users who hit a `pattern ambiguous` error on the first prune attempt and retry with a refined pattern
- Maintainers reviewing the filter behavior in isolation against the OpenCode reference

### User-Needs Gamut
- Retry stability after first-attempt ambiguity
- No silent boundary selection when multiple non-wrapper candidates exist
- No regression in the single-match (`hits.length === 1`) or zero-match paths

### Ambiguities From User Model
- **Where to detect wrapper-ness:** in the resolver (would need `PluginMessage[]` in addition to `MessageText[]`) OR in the flatten step (add a flag to `MessageText`). Resolved: flag on `MessageText` populated during `buildMessageTexts`. Keeps the resolver shape-agnostic.
- **Whether to also accept an MCP-prefixed name:** Kilo registers the prune tool as a native plugin tool with literal name `context-bonsai-prune` (`factory.ts:381`). No MCP-prefixed form will appear. Resolved: filter on `context-bonsai-prune` only.

## Dependencies

- **Must land with K1 (`story-kilo-text-extraction.md`).** K1 alone re-introduces self-poisoning. K2 alone is a no-op (today's `getText` already excludes tool args). They MUST ship in the same change set.

## Context References

- `kilo_context_bonsai/src/guards.ts:8-11` — `MessageText` type (`{ id: string; text: string }`); the new flag is added here.
- `kilo_context_bonsai/src/guards.ts:17-32` — `resolvePattern` signature and ambiguity branch at `:28-30`.
- `kilo_context_bonsai/src/factory.ts:158-160` — `buildMessageTexts` flatten loop where the flag is populated.
- `kilo_context_bonsai/src/factory.ts:412-426` — `detectToolCut` reference for accessing `(p as OtherPart).state.status`.
- `kilo_context_bonsai/src/factory.ts:381` — confirmed tool-name registration `context-bonsai-prune` (no MCP prefix).
- `opencode_context_bonsai_plugin/src/prune-pattern.ts:90-91` — reference predicate:
  ```ts
  const isPruneCandidate = (message: WithParts): boolean =>
    message.parts.some(part => part.type === 'tool' && part.tool === 'context-bonsai-prune' && part.state?.status === 'completed')
  ```
- `opencode_context_bonsai_plugin/src/prune-pattern.ts:97-103` — reference filter usage on the ambiguity branch only.
- `docs/context-bonsai-agent-spec.md` Pattern Matching Contract — spec authority.
- `docs/agent-specs/kilo-context-bonsai-spec.md` — Kilo's mirror of the rule.

## Acceptance Criteria

- [ ] `MessageText` (`kilo_context_bonsai/src/guards.ts:8-11`) gains an optional `isPruneWrapper?: boolean` field.
- [ ] A new pure helper `isPruneToolWrapper(parts: Part[]): boolean` is added to `kilo_context_bonsai/src/factory.ts` (the predicate lives there to avoid exporting `OtherPart` from a separate module — `OtherPart` is only declared in `factory.ts`). Returns true iff any part has `type === "tool"`, `(p as OtherPart).tool === "context-bonsai-prune"`, AND `(p as OtherPart).state?.status === "completed"` OR `"error"` (see note below; this aligns with K1 AC requiring `error`-status tool parts to be searchable).
- [ ] `buildMessageTexts` (`factory.ts:158-160`) populates `isPruneWrapper` for each `MessageText` it produces by calling the predicate.
- [ ] `resolvePattern` (`guards.ts:17`) ambiguity branch (`:28-30`) is modified: if `hits.length > 1`, compute `nonWrapperHits = hits.filter(i => !messages[i]?.isPruneWrapper)`; if `nonWrapperHits.length === 1`, return `{ ok: true, index: nonWrapperHits[0]! }`; otherwise return the existing ambiguity error verbatim.
- [ ] Single-match path (`hits.length === 1`) is untouched (filter never runs on this path).
- [ ] Zero-match path is untouched.
- [ ] `resolveRange` (`guards.ts:51-53`) does not require changes — it consumes `resolvePattern`'s result.
- [ ] Tests in `kilo_context_bonsai/test/plugin.test.ts` cover the four outcomes:
  1. **filter→1**: two hits, one wrapper + one real → returns the real index, `ok: true`.
  2. **filter→0**: two hits, both wrappers → existing ambiguity error fires verbatim.
  3. **filter→>1**: three hits, two non-wrappers + one wrapper → existing ambiguity error.
  4. **single-match-untouched**: one hit (a wrapper) → returns the wrapper index without filtering.
- [ ] Integration test on `buildMessageTexts`: a `PluginMessage[]` containing a `type: "tool"`, `tool: "context-bonsai-prune"`, `state.status: "completed"` part produces a `MessageText` with `isPruneWrapper: true`.
- [ ] Predicate unit tests cover: completed prune wrapper (true); error-status prune wrapper (true if accepted, see note); pending/running prune wrapper (false); non-prune tool with completed state (false); plain text-only message (false).
- [ ] `bun test` and `bun run typecheck` both pass.
- [ ] No agent-repo edits required.

**Note on `state.status`:** the OpenCode reference predicate accepts only `"completed"`. For Kilo, also accept `"error"` because failed prune calls (which is exactly what the wrapper filter exists to handle on retry) carry `state.status === "error"` — a "completed"-only filter would miss them. Pending/running are rejected (no settled args yet, no retry-loop concern).

## Implementation Tasks

1. Add `isPruneWrapper?: boolean` to the `MessageText` type at `kilo_context_bonsai/src/guards.ts:8-11`.
2. Add the predicate `isPruneToolWrapper(parts: Part[]): boolean` in `factory.ts` (near `detectToolCut`). Body: `parts.some(p => p.type === "tool" && (p as OtherPart).tool === "context-bonsai-prune" && ((p as OtherPart).state?.status === "completed" || (p as OtherPart).state?.status === "error"))`. Document the rationale for accepting `"error"`.
3. Update `buildMessageTexts` (`factory.ts:158-160`) to call the predicate and set `isPruneWrapper`.
4. Modify `resolvePattern`'s ambiguity branch (`guards.ts:28-30`):
   ```ts
   if (hits.length > 1) {
     const nonWrapperHits = hits.filter(i => !messages[i]?.isPruneWrapper)
     if (nonWrapperHits.length === 1) return { ok: true, index: nonWrapperHits[0]! }
     return { ok: false, error: `pattern ambiguous: ${pattern} matched ${hits.length} messages` }
   }
   ```
5. Add the resolver outcome tests + predicate unit tests + integration test in `kilo_context_bonsai/test/plugin.test.ts`. Reuse the `toolMsg()` helper introduced by K1 for any tests that build `PluginMessage[]` with tool parts (e.g. the integration test).
6. Run `bun test` and verify zero regressions.
7. Run `bun run typecheck` and fix any errors.

## Testing Strategy

Side-repo `bun:test` only. Resolver tests use hand-built `MessageText[]` with `isPruneWrapper` set explicitly. Predicate tests use hand-built `Part[]`. Integration test exercises `buildMessageTexts` against a synthesized `PluginMessage[]` with a real prune tool part to confirm the flag is populated correctly.

## Validation Commands

- `cd /home/basil/projects/context-bonsai-agents/kilo_context_bonsai && bun test`
- `cd /home/basil/projects/context-bonsai-agents/kilo_context_bonsai && bun run typecheck`

## Worktree Artifact Check

- Checked At: 2026-04-25
- Planned Target Files:
  - `kilo_context_bonsai/src/guards.ts`
  - `kilo_context_bonsai/src/factory.ts`
  - `kilo_context_bonsai/test/plugin.test.ts`
- Overlaps Found (path + class): none. Verified by `git status --short` in `kilo_context_bonsai/` — submodule clean.
- Escalation Status: none
- Decision Citation: n/a

## Plan Approval and Commit Status

- Approval Status: llm-agent-approved
- Approval Citation: validation loop iteration 2 cleared all findings (resolved the `factory.ts` vs `index.ts` alternative; pinned predicate location with rationale; cross-referenced K1 AC for the `error`-status decision; ensured K1 `toolMsg()` helper reuse).
- Plan Commit Hash: pending-next-commit
- Ready-for-Orchestration: yes (after this plan is committed and the Plan Commit Hash field is updated)

## Validation Loop Results

- Missing details check: pass (iteration 2). Iter-1 findings: (1) `index.ts` doesn't exist — sibling-module alternative dropped; (2) predicate location pinned to `factory.ts` with rationale (avoid exporting `OtherPart`); (3) `state.status === "error"` justification verified, cross-ref K1 added; (4) four outcome tests concretely specified.
- Ambiguity check: pass (iteration 2). Iter-1 findings: (1) factory.ts vs index.ts — committed to factory.ts; (2) `resolveRange` confirmed untouched; (3) `toolMsg()` helper reuse from K1 added; (4) predicate location reasoned through.
- Worktree artifact risk check: pass. `git status --short` in `kilo_context_bonsai` empty; planned targets clean.
- Plan-commit status check: pending until commit (will be filled in by post-commit update).
- Iterations run: 2
