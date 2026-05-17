# Story: context-bonsai-gauge patch

**Epic:** Re-implement Context Bonsai for Claude Code on tweakcc 4.0
**Size:** Large
**Dependencies:** Story 2 (`patches/types.ts`, registry, harness), Story 3 (`patches/discovery.ts`)

## Story Description

Implement `patches/context-bonsai-gauge.patch.ts` — the patch that injects the context-utilization gauge: in-band, model-visible feedback about how full the context is and graduated guidance about when to prune.

It is the most complex of the three patches. The reference implementation is `the_observer/tweakcc/src/patches/contextBonsaiGauge.ts`: three distinct anchor points (L324–393 — the token-usage helper, the attachment-registration pipeline, and the todo-reminder render case), the injected helper functions (L431–442 — port the full set present in the reference; do not rely on a fixed count), the gauge function `MM1Bonsai()` (L443), the attachment registration (L447), and the severity-banded reminder case (L451). The gauge fires when a prune/retrieve tool response is detected, or when threshold rules are met (more than 20 turns total, at least 5 turns since the last gauge, and context usage above 25%); reminder text is graduated across severity bands.

This story re-expresses it as a single `BonsaiPatch` transform module per epic Contract A, using Story 3's `discovery.ts` for all anchor location. Per Contract A the module exports one `BonsaiPatch` with `name: "context-bonsai-gauge"` and `sentinel: "/*cb:context-bonsai-gauge:v1*/"`.

**Internal re-find discipline.** This patch inserts at three anchor points within one `apply` call. Each insertion shifts byte offsets, so the patch MUST re-run discovery against the current (already-partially-modified) content before each insertion — it must never reuse offsets computed before an earlier insertion. This is in addition to the cross-patch rule that, as patch 3, it receives content already modified by `archived-filter` and `message-content-ids`.

The injected gauge code uses Bun host globals (e.g. `Buffer`); that drives the native-binary acceptance check below.

## User Model

### User Gamut

Examples only:

- A developer who wants to know context is filling up *before* hitting the wall.
- A developer who just pruned and wants confirmation the gauge reflects the freed space.
- A model consuming the in-band gauge to decide, unprompted, whether to prune.
- A developer who finds frequent gauge text noisy and needs the cadence rules to keep it sparse.
- The maintainer checking all three gauge anchors still resolve after a Claude Code release.

### User-Needs Gamut

Examples only:

- Timely, in-band context-pressure feedback the model can act on.
- Cadence that is informative without being spammy (the >20-turn / ≥5-since-last / >25% rules).
- Severity-appropriate guidance — gentle near-empty, urgent near-full.
- Resilient anchoring across three independent insertion points.
- No corruption of token accounting or attachment rendering.

### Design Implications

- All three anchors are located via `discovery`; each insertion is preceded by a fresh discovery pass against the current content.
- The eight injected helpers and `MM1Bonsai` must be self-contained — no reliance on identifiers that minification may rename outside the discovered region.
- Injected code uses host globals (`Buffer`); these MUST be verified inside the repacked native binary.
- Gauge visibility is the spec requirement (gauge MUST be model-visible in-band); a UI-only widget does not satisfy it.

## Acceptance Criteria

- [ ] `patches/context-bonsai-gauge.patch.ts` exports a `BonsaiPatch` with `name: "context-bonsai-gauge"` and `sentinel: "/*cb:context-bonsai-gauge:v1*/"`.
- [ ] All three anchors (token-usage helper, attachment-registration pipeline, todo-reminder render case) are located via `discovery.selectUnique`.
- [ ] The patch re-runs discovery against the current content before each of the three insertions; no pre-insertion offset is reused.
- [ ] `apply` throws `BonsaiPatchError` (fail closed) if any of the three anchors is not uniquely resolved.
- [ ] After `apply`, `verifySentinel` confirms the sentinel is present exactly once.
- [ ] The injected gauge fires on a prune/retrieve tool response, and on the threshold rule (>20 turns, ≥5 since last gauge, >25% usage); reminder text is graduated across severity bands.
- [ ] `apply` operates correctly on content already transformed by `archived-filter` and `message-content-ids` (verified by composing all three in the test).
- [ ] The module is registered in `patches/registry.ts` as the third patch.
- [ ] **Native-binary check:** after the harness applies this patch to a copy of a native install and repacks, the rebuilt binary runs and the injected gauge code's host-global usage executes without `ReferenceError` — verified by a runtime smoke check.
- [ ] `bun run typecheck` and `bun test` pass.

## Context References

### Relevant Codebase Files (must read)

- `/home/basil/projects/the_observer/tweakcc/src/patches/contextBonsaiGauge.ts` - reference implementation (three anchors L324–393, injected helpers L431–442, `MM1Bonsai` L443, attachment registration L447, reminder case L451).
- `tweakcc_context_bonsai/mcp-server/index.ts` - the `<context-bonsai-tool-response>` metadata wrapper the gauge decodes to detect prune/retrieve responses.
- `tweakcc_context_bonsai/patches/discovery.ts` - Story 3 API.
- `tweakcc_context_bonsai/patches/types.ts` - `BonsaiPatch` interface.

### New Files to Create

- `tweakcc_context_bonsai/patches/context-bonsai-gauge.patch.ts`
- `tweakcc_context_bonsai/patches/context-bonsai-gauge.patch.test.ts`

### Relevant Documentation

- The epic, Contract A (apply order; compose-over-modified-content; internal re-find discipline).
- `docs/context-bonsai-agent-spec.md` - the gauge MUST-be-model-visible requirement.

## Implementation Plan

### Phase 1: Foundation

- Read `contextBonsaiGauge.ts` in full; map the three anchors and the tool-response metadata format.

### Phase 2: Core Implementation

- Implement the `BonsaiPatch`: discover anchor 1, insert; re-discover and insert at anchor 2; re-discover and insert at anchor 3; append the sentinel.
- Port the full set of injected helpers, `MM1Bonsai`, the firing rules, and the severity bands.

### Phase 3: Integration

- Register the module in `patches/registry.ts` (position 3).

### Phase 4: Testing and Validation

- Unit tests; the three-patch composition test; the native repack + runtime smoke check.

## Step-by-Step Tasks

1. Read the reference patch and the tool-response metadata wrapper in `mcp-server/index.ts`.
2. Implement `context-bonsai-gauge.patch.ts` as a `BonsaiPatch` using `discovery`.
3. Implement the three-insertion flow with a fresh discovery pass before each insertion.
4. Port the helpers, `MM1Bonsai`, firing rules, severity bands.
5. Append the `/*cb:context-bonsai-gauge:v1*/` sentinel; self-verify.
6. Register the module in `patches/registry.ts` as patch 3.
7. Write `context-bonsai-gauge.patch.test.ts`, including a compose-all-three case.
8. Run the harness against a copied native install; smoke-test the repacked binary's gauge host-global usage.
9. Run `bun run typecheck` and `bun test`.

## Testing Strategy

- Unit: each of the three anchors resolves on fixtures; fail-closed when any does not; re-find discipline verified (an insertion does not invalidate a later anchor); firing rules and severity bands; sentinel self-verification.
- Composition: apply all three patches in registry order to one fixture; confirm all anchors resolve and all three sentinels are present.
- Native integration: apply via the Story 2 harness to a copied native binary, repack, run, confirm the gauge's host-global usage executes without `ReferenceError`. Skip-with-reason if no native install is present.

## Validation Commands

- `cd tweakcc_context_bonsai && bun run typecheck`
- `cd tweakcc_context_bonsai && bun test patches/context-bonsai-gauge.patch.test.ts`

## Worktree Artifact Check

- Checked At: `2026-05-17T22:18:10Z`
- Planned Target Files: `tweakcc_context_bonsai/patches/context-bonsai-gauge.patch.ts`, `patches/context-bonsai-gauge.patch.test.ts`, `patches/registry.ts` (modified — created by Story 2)
- Overlaps Found (path + class): `none` (side repo clean at `a3c5c81`; new files absent)
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
