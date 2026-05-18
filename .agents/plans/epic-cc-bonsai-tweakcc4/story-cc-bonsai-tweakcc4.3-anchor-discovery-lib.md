# Story: Resilient anchor-discovery library

**Epic:** Re-implement Context Bonsai for Claude Code on tweakcc 4.0
**Size:** Large
**Dependencies:** Story 1 (implements its resilient-anchor spec contract), Story 2 (uses `patches/types.ts`; tested against the harness's extracted JS)

## Story Description

Build `patches/discovery.ts` — the shared module every patch module (Stories 4–6) consumes — implementing epic Contract B exactly. It is the concrete realization of Story 1's resilient-anchor spec contract.

Two responsibilities:

**(a) Patch-point discovery.** Claude Code's bundle is minified and re-minified roughly weekly; a single brittle regex is the recurring failure mode. The library locates an insertion point with multiple candidate patterns, scores each candidate against contextual signals, and selects a unique winner with explicit disambiguation — or throws. The pinned-target spike found 133 `switch(X.type)` candidates, so scoring and a minimum-margin disambiguation rule are mandatory, not optional.

**(b) Runtime-helper discovery.** The old patches relied on fork-specific `findRuntimeHelpers()` logic to resolve the minified names of Claude Code's `fs` module getter, config-directory getter, and session-id getter. tweakcc 4.0's `adhoc-patch` does NOT expose this. This story re-homes that capability into `discovery.ts`. There is no external reference source in this worktree; implementers must derive the behavior from the epic contracts, committed fixtures, current code, and the pinned-target artifact contract.

**(c) Target-artifact verification hook.** This story must make discovery validation runnable against the pinned target artifact from the epic's Target Release And Artifact Contract, but it does not have to generate that artifact from an ambient local Claude install. If the real extracted bundle is not present in the worktree, the test may skip with a clear reason; Story 8 remains responsible for producing release-gate evidence from the reproducible pinned target before the epic is complete.

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
- A reproducible path to test discovery against the pinned Claude Code target without depending on unversioned local state.
- Maintainability: when a release does break an anchor, the error pinpoints which one.

### Design Implications

- Scoring must use signals robust to minification: nearby `case"user"` / `case"assistant"` literals, structural shape, proximity — not exact identifier names.
- `selectUnique` needs both a `minScore` floor (reject weak matches) and a `minMargin` rule (reject ambiguous top-twos) — both throwing distinct errors.
- `findRuntimeHelpers` must port the fork's *approach* (count `.existsSync` call sites, match the `JOIN(CONFIGDIR(),"history.jsonl")` shape, match `function N(){return STORE.sessionId}`), not hard-code names.
- Tests must not depend on the ephemeral `/tmp/cc-bonsai-spike/extracted.js` or an unversioned local Claude install. Commit small fixtures representing each code shape; gate full-bundle assertions on `tweakcc_context_bonsai/.artifacts/claude-code/2.1.143/linux-x64/extracted.js` or `CB_CLAUDE_TARGET_BUNDLE_JS`, with metadata in `tweakcc_context_bonsai/.artifacts/claude-code/2.1.143/linux-x64/manifest.json`, and skip with a clear reason when the artifact is absent.

## Acceptance Criteria

- [ ] `patches/discovery.ts` exports `findCandidates`, `scoreCandidates`, `selectUnique`, `findRuntimeHelpers`, `verifySentinel` with signatures matching epic Contract B exactly.
- [ ] `selectUnique` throws `AnchorNotFoundError` on zero candidates or none above `minScore`, and `AnchorAmbiguousError` when the top two are within `minMargin`.
- [ ] `findRuntimeHelpers` resolves `fsFunc`, `configDirFunc`, `sessionIdFunc` from a Claude Code bundle and throws `RuntimeHelpersError` if any is unresolved.
- [ ] `verifySentinel` throws unless the given sentinel appears exactly once.
- [ ] Discovery scoring is demonstrated with a deterministic committed fixture containing 133 `switch(X.type)` candidates and exactly one visibility-predicate winner.
- [ ] The test suite includes a target-artifact verification path for the epic's pinned Claude Code target: default path `tweakcc_context_bonsai/.artifacts/claude-code/2.1.143/linux-x64/extracted.js`, optional override `CB_CLAUDE_TARGET_BUNDLE_JS`, and manifest path `tweakcc_context_bonsai/.artifacts/claude-code/2.1.143/linux-x64/manifest.json`. When the extracted bundle is absent, it skips with a clear reason that names Claude Code native `2.1.143` Linux x64 and the expected artifact/manifest contract rather than silently passing as release evidence.
- [ ] Committed fixtures cover each code shape; the test suite passes without `/tmp` artifacts.
- [ ] `bun run typecheck` and `bun test` pass.

## Context References

### Relevant Codebase Files (must read)

- `tweakcc_context_bonsai/patches/types.ts` - created by Story 2; `BonsaiPatchError` base for the discovery error classes.
- No external reference source is available in this worktree. Derive runtime-helper and anchor behavior from the epic contracts, committed fixtures, current code, and live Claude Code/tweakcc APIs available through the story validation flow.

### New Files to Create

- `tweakcc_context_bonsai/patches/discovery.ts` - the library.
- `tweakcc_context_bonsai/patches/discovery.test.ts` - unit tests.
- `tweakcc_context_bonsai/patches/__fixtures__/` - small committed code-shape fixtures.

### Relevant Documentation

- The epic, "Shared Implementation Contracts → Contract B" (authoritative API surface).
- The epic, "Target Release And Artifact Contract" (authoritative target/evidence contract for real-bundle validation).
- `docs/context-bonsai-agent-spec.md` resilient-discovery requirement (added by Story 1).

## Implementation Plan

### Phase 1: Foundation

- Derive the discovery patterns and runtime-helper logic from the epic contracts, committed fixtures, current code, and live Claude Code/tweakcc APIs available through validation.
- Define the error classes on `BonsaiPatchError`.

### Phase 2: Core Implementation

- Implement `findCandidates`, `scoreCandidates`, `selectUnique` with the `minScore`/`minMargin` rules.
- Port `findRuntimeHelpers`.
- Implement `verifySentinel`.

### Phase 3: Integration

- Build committed fixtures; add an optional integration test against a real extract.
- Add a target-artifact verification path that can run against `tweakcc_context_bonsai/.artifacts/claude-code/2.1.143/linux-x64/extracted.js` or `CB_CLAUDE_TARGET_BUNDLE_JS` when present and reports a clear skip reason naming the manifest path when absent.

### Phase 4: Testing and Validation

- Unit tests for each function incl. the not-found / ambiguous throwing paths.
- The 133-candidate disambiguation assertion against a deterministic committed fixture.
- Optional target-bundle verification against the pinned target artifact, with release-gate evidence deferred to Story 8 when the artifact is absent.

## Step-by-Step Tasks

1. Review the epic contracts, committed fixtures, current code, and live Claude Code/tweakcc APIs available through validation to derive the required patch-point and runtime-helper behavior.
2. Define `AnchorNotFoundError`, `AnchorAmbiguousError`, `RuntimeHelpersError`.
3. Implement `findCandidates` and `scoreCandidates` (minification-robust signals).
4. Implement `selectUnique` with `minScore` + `minMargin`.
5. Implement `findRuntimeHelpers` from the plan-described code-shape rules and committed fixtures; do not read or depend on external/stale helper sources.
6. Implement `verifySentinel`.
7. Build committed code-shape fixtures under `patches/__fixtures__/`.
8. Write `discovery.test.ts`, including the 133-candidate fixture test and the optional pinned-target artifact verification path.
9. Run `bun run typecheck` and `bun test`.

## Testing Strategy

- Unit: every export, including both throwing paths of `selectUnique` and the `RuntimeHelpersError` path.
- Deterministic fixture: assert exactly one visibility-predicate candidate is selected from a committed 133-candidate fixture.
- Target artifact: if `tweakcc_context_bonsai/.artifacts/claude-code/2.1.143/linux-x64/extracted.js` exists or `CB_CLAUDE_TARGET_BUNDLE_JS` is provided, assert the real pinned-target bundle selects exactly one visibility-predicate candidate and record evidence per the epic Target Release And Artifact Contract; otherwise skip with a clear reason naming the expected bundle path, `CB_CLAUDE_TARGET_BUNDLE_JS`, and `tweakcc_context_bonsai/.artifacts/claude-code/2.1.143/linux-x64/manifest.json`. This skip is acceptable for Story 3 but not for Story 8's release gate.

## Validation Commands

- `cd tweakcc_context_bonsai && bun run typecheck`
- `cd tweakcc_context_bonsai && bun test patches/discovery.test.ts`

## Worktree Artifact Check

- Checked At: `2026-05-18T00:00:00Z`
- Planned Target Files: `tweakcc_context_bonsai/patches/discovery.ts`, `tweakcc_context_bonsai/patches/discovery.test.ts`, `tweakcc_context_bonsai/patches/__fixtures__/*`
- Current State: existing tracked clean files in side repo at `ac5753d`; this is continuation/revision work, not new-file creation.
- Overlaps Found (path + class): `none`
- Escalation Status: `none`
- Decision Citation: `none`

## Plan Approval and Commit Status

- Approval Status: `approved`
- Approval Citation: `User direction: "Update the plan, but use the process in planning_guidance.md... Commit the plan once..." (2026-05-18)`
- Plan Commit Hash: `fc0beb1`
- Ready-for-Orchestration: `yes`

## Completion Checklist

- [ ] All acceptance criteria met
- [ ] Validation commands pass
- [ ] Plan approved and committed before orchestration begins
- [ ] User-model ambiguities resolved or escalated
- [ ] Worktree artifact overlaps resolved (approved direction or explicit deferral)
