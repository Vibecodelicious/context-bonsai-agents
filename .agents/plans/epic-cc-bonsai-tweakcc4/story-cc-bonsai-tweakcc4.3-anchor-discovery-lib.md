# Story: Resilient anchor-discovery library

**Epic:** Re-implement Context Bonsai for Claude Code on tweakcc 4.0
**Size:** Large
**Dependencies:** Story 1 (implements its resilient-anchor spec contract), Story 2 (uses `patches/types.ts`; tested against the harness's extracted JS)

## Story Description

Build `patches/discovery.ts` — the shared module every patch module (Stories 4–6) consumes — implementing epic Contract B exactly. It is the concrete realization of Story 1's resilient-anchor spec contract.

Two responsibilities:

**(a) Patch-point discovery.** Claude Code's bundle is minified and re-minified roughly weekly; a single brittle regex is the recurring failure mode. The library locates an insertion point with multiple candidate patterns, scores each candidate against contextual signals, and selects a unique winner with explicit disambiguation — or throws. The `switch(X.type)` pattern alone occurs 133 times in the extracted JS, so scoring and a minimum-margin disambiguation rule are mandatory, not optional.

**(b) Runtime-helper discovery.** The old patches relied on the forked tweakcc's `findRuntimeHelpers()` to resolve the minified names of Claude Code's `fs` module getter, config-directory getter, and session-id getter. tweakcc 4.0's `adhoc-patch` does NOT expose this. This story re-homes that logic into `discovery.ts`. The reference implementation is `the_observer/tweakcc/src/patches/helpers.ts` lines 288–336 (`fsFunc` discovery L294–306, `configDirFunc` L312–321, `sessionIdFunc` L323–332).

The fixed public surface is epic Contract B verbatim: `findCandidates`, `scoreCandidates`, `selectUnique`, `findRuntimeHelpers`, `verifySentinel`, plus the error classes `AnchorNotFoundError`, `AnchorAmbiguousError`, `RuntimeHelpersError`. Every throwing path is the fail-closed mechanism the harness relies on.

## User Model

### User Gamut

Examples only:

- Story 4/5/6 implementers, who call this API to locate their patch points.
- The maintainer, who after a Claude Code release runs the discovery tests to see whether anchors still resolve before shipping.
- A reviewer judging whether the port meets Story 1's resilient-discovery spec bar.
- An operator hitting a failed apply, who receives a discovery error naming the patch and anchor that could not be located.

### User-Needs Gamut

Examples only:

- A discovery API stable enough that Stories 4–6 can be written against it without guessing.
- Resilience: an anchor that survives ordinary minification churn (renamed identifiers, whitespace, reordered cases).
- Honest failure: zero matches or an ambiguous match throws a typed, descriptive error — never returns a wrong guess.
- A way to confirm, after patching, that the change actually landed (`verifySentinel`).
- Maintainability: when a release does break an anchor, the error pinpoints which one.

### Design Implications

- Scoring must use signals robust to minification: nearby `case"user"` / `case"assistant"` literals, structural shape, proximity — not exact identifier names.
- `selectUnique` needs both a `minScore` floor (reject weak matches) and a `minMargin` rule (reject ambiguous top-twos) — both throwing distinct errors.
- `findRuntimeHelpers` must port the fork's *approach* (count `.existsSync` call sites, match the `JOIN(CONFIGDIR(),"history.jsonl")` shape, match `function N(){return STORE.sessionId}`), not hard-code names.
- Tests must not depend on the ephemeral `/tmp/cc-bonsai-spike/extracted.js`. Commit small fixtures representing each code shape; gate any full-bundle assertion on a real extract being present.

## Acceptance Criteria

- [ ] `patches/discovery.ts` exports `findCandidates`, `scoreCandidates`, `selectUnique`, `findRuntimeHelpers`, `verifySentinel` with signatures matching epic Contract B exactly.
- [ ] `selectUnique` throws `AnchorNotFoundError` on zero candidates or none above `minScore`, and `AnchorAmbiguousError` when the top two are within `minMargin`.
- [ ] `findRuntimeHelpers` resolves `fsFunc`, `configDirFunc`, `sessionIdFunc` from a Claude Code bundle and throws `RuntimeHelpersError` if any is unresolved.
- [ ] `verifySentinel` throws unless the given sentinel appears exactly once.
- [ ] Discovery scoring is demonstrated against the real extracted JS to select exactly one `switch(X.type)` visibility-predicate candidate out of the 133 present.
- [ ] Committed fixtures cover each code shape; the test suite passes without `/tmp` artifacts.
- [ ] `bun run typecheck` and `bun test` pass.

## Context References

### Relevant Codebase Files (must read)

- `/home/basil/projects/the_observer/tweakcc/src/patches/helpers.ts:288` - `findRuntimeHelpers()` reference implementation to re-home (L294–306 fs, L312–321 configDir, L323–332 sessionId, L273–277 caching).
- `/home/basil/projects/the_observer/tweakcc/src/patches/archivedFilter.ts:8` - the visibility-predicate matcher + scoring (L28–39) Story 4 will need; informs the discovery API shape.
- `/home/basil/projects/the_observer/tweakcc/src/patches/messageContentIds.ts:14` - the five converter-matching regexes Story 5 will need; informs multi-strategy design.
- `tweakcc_context_bonsai/patches/types.ts` - created by Story 2; `BonsaiPatchError` base for the discovery error classes.

### New Files to Create

- `tweakcc_context_bonsai/patches/discovery.ts` - the library.
- `tweakcc_context_bonsai/patches/discovery.test.ts` - unit tests.
- `tweakcc_context_bonsai/patches/__fixtures__/` - small committed code-shape fixtures.

### Relevant Documentation

- The epic, "Shared Implementation Contracts → Contract B" (authoritative API surface).
- `docs/context-bonsai-agent-spec.md` resilient-discovery requirement (added by Story 1).

## Implementation Plan

### Phase 1: Foundation

- Read `helpers.ts`, `archivedFilter.ts`, `messageContentIds.ts` to capture the discovery patterns and runtime-helper logic.
- Define the error classes on `BonsaiPatchError`.

### Phase 2: Core Implementation

- Implement `findCandidates`, `scoreCandidates`, `selectUnique` with the `minScore`/`minMargin` rules.
- Port `findRuntimeHelpers`.
- Implement `verifySentinel`.

### Phase 3: Integration

- Build committed fixtures; add an optional integration test against a real extract.

### Phase 4: Testing and Validation

- Unit tests for each function incl. the not-found / ambiguous throwing paths.
- The 133-candidate disambiguation assertion against the real extracted JS.

## Step-by-Step Tasks

1. Read the three `the_observer/tweakcc/src/patches/*.ts` reference files.
2. Define `AnchorNotFoundError`, `AnchorAmbiguousError`, `RuntimeHelpersError`.
3. Implement `findCandidates` and `scoreCandidates` (minification-robust signals).
4. Implement `selectUnique` with `minScore` + `minMargin`.
5. Port `findRuntimeHelpers` from `helpers.ts`.
6. Implement `verifySentinel`.
7. Build committed code-shape fixtures under `patches/__fixtures__/`.
8. Write `discovery.test.ts`, including the real-extract disambiguation test.
9. Run `bun run typecheck` and `bun test`.

## Testing Strategy

- Unit: every export, including both throwing paths of `selectUnique` and the `RuntimeHelpersError` path.
- Integration: against a freshly produced Claude Code extract (via the Story 2 harness's `readContent`), assert exactly one visibility-predicate candidate is selected from the 133 `switch(X.type)` sites; skip-with-reason if no install is available.

## Validation Commands

- `cd tweakcc_context_bonsai && bun run typecheck`
- `cd tweakcc_context_bonsai && bun test patches/discovery.test.ts`

## Worktree Artifact Check

- Checked At: `2026-05-17T22:18:10Z`
- Planned Target Files: `tweakcc_context_bonsai/patches/discovery.ts`, `patches/discovery.test.ts`, `patches/__fixtures__/*`
- Overlaps Found (path + class): `none` (side repo clean at `a3c5c81`; all targets are new files)
- Escalation Status: `none`
- Decision Citation: `none`

## Plan Approval and Commit Status

- Approval Status: `approved`
- Approval Citation: `User approval: "Approved" (2026-05-17)`
- Plan Commit Hash: `none`
- Ready-for-Orchestration: `no`

## Completion Checklist

- [ ] All acceptance criteria met
- [ ] Validation commands pass
- [ ] Plan approved and committed before orchestration begins
- [ ] User-model ambiguities resolved or escalated
- [ ] Worktree artifact overlaps resolved (approved direction or explicit deferral)
