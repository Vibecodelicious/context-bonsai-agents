# Story: Resilient-anchor spec contract and patch-required correction

**Epic:** Re-implement Context Bonsai for Claude Code on tweakcc 4.0
**Size:** Small
**Dependencies:** None

## Story Description

Two coupled spec corrections that set the contract the rest of the epic implements.

**(a) Shared spec — add cross-port anchor-resilience guidance.** `docs/context-bonsai-agent-spec.md` today only mandates *fail-closed* behavior when a patch/hook insertion point cannot be found (Policy and Safety Constraints, ~L309–310; Planning Checklist, ~L379). It never requires the discovery itself to be resilient. For any port that patches or hooks a host whose code changes between releases (Claude Code is re-minified on a roughly weekly cadence), fragile single-pattern matching is a recurring failure source. Add cross-port guidance that required patch/hook discovery MUST be resilient: multiple matching strategies, candidate scoring with explicit disambiguation, and post-application self-verification that the change actually landed. This is additive to — not a replacement for — the existing fail-closed rule: resilient discovery reduces how often discovery fails; fail-closed governs what happens when it still does.

**(b) Per-agent spec — correct the "patches not required" error.** `docs/agent-specs/claude-code-context-bonsai-spec.md` currently states the tweakcc patches are "RECOMMENDED but not required" and that "the MCP server alone must be functionally complete for prune/retrieve." The investigation behind this epic proved that false: with no transcript-rewrite seam, an MCP-only prune cannot remove follower messages from the model-facing transcript, which the shared spec mandates as a MUST (~L172). The per-agent spec must instead state that a transcript-rewrite seam (the tweakcc patch, or an equivalent) is **required** for the context-reduction guarantee, and that the MCP server MUST fail closed — deterministic plain-text error, no archive write — when that seam is absent. Claude-Code-specific resilience detail stays in the per-agent spec; only genuinely cross-port guidance goes in the shared spec.

This is a documentation-only story. No code.

## User Model

### User Gamut

Examples only, spanning role and lifecycle:

- Implementers writing any current or future Context Bonsai port who need to know the durability bar for patch/hook discovery.
- The epic's own downstream story implementers (Stories 3, 4, 7), who treat this spec as their acceptance contract.
- A reviewer or judge assessing whether a port's discovery code meets the project bar.
- A maintainer triaging a port that broke after a host upgrade, asking "was the discovery supposed to survive this?"

### User-Needs Gamut

Examples only:

- An unambiguous, testable contract for what "resilient anchor discovery" means — not a vibe.
- Assurance that a port never silently no-ops while the model believes pruning worked.
- A per-agent spec that does not contradict the shared spec it derives from.
- Cross-port guidance that stays genuinely cross-port, so it does not import Claude-Code-specific assumptions into other ports.

### Design Implications

- The shared-spec addition must be host-agnostic: phrase it in terms of "patch or hook insertion points," never tweakcc or Claude Code.
- The per-agent spec correction must name the concrete fail-closed behavior (error text shape, no mutation) so Story 7 has a precise target.
- Keep the shared-spec edit small and surgical; a large rewrite invites drift from the other ports' specs.

## Acceptance Criteria

- [ ] `docs/context-bonsai-agent-spec.md` contains a new, clearly labeled requirement that patch/hook insertion-point discovery MUST be resilient — multi-strategy, scored with explicit disambiguation, and self-verified after application — placed within or adjacent to "Policy and Safety Constraints."
- [ ] That addition is cross-port: it contains no reference to tweakcc, Claude Code, or any single host.
- [ ] The existing fail-closed requirement (~L309–310) remains and is explicitly framed as complementary, not superseded.
- [ ] `docs/agent-specs/claude-code-context-bonsai-spec.md` no longer states or implies the tweakcc patches are optional / "not required," and no longer states the MCP server alone is functionally complete for prune/retrieve.
- [ ] That spec states a transcript-rewrite seam is required for the context-reduction guarantee, and that the MCP server MUST fail closed (deterministic plain-text error, no archive write) when the seam is absent.
- [ ] No remaining contradiction between the per-agent spec and the shared spec's prune MUST (~L172): a reviewer reading both finds them consistent.
- [ ] The Planning Checklist item about fail-closed paths (~L379) is updated or cross-referenced so resilient discovery is discoverable from the checklist.

## Context References

### Relevant Codebase Files (must read)

- `docs/context-bonsai-agent-spec.md:303` - "Policy and Safety Constraints" section; insertion site for the new requirement.
- `docs/context-bonsai-agent-spec.md:309` - existing fail-closed rule the addition complements.
- `docs/context-bonsai-agent-spec.md:172` - the prune MUST (replace anchor with placeholder, omit followers) the per-agent spec must stop contradicting.
- `docs/context-bonsai-agent-spec.md:379` - Planning Checklist fail-closed item.
- `docs/agent-specs/claude-code-context-bonsai-spec.md` - locate the exact lines stating the patches are "RECOMMENDED but not required" and "the MCP server alone must be functionally complete" (reported near L60 and L104); these are the lines to correct.

### New Files to Create

- None. This story edits two existing tracked files.

### Relevant Documentation

- The epic, "Shared Implementation Contracts → Contract C" — the per-agent spec's required fail-closed behavior must match the MCP prune guard defined there.

## Implementation Plan

### Phase 1: Foundation

- Read both spec files in full; locate the exact contradicting lines in the per-agent spec.

### Phase 2: Core Implementation

- Draft the shared-spec resilient-discovery requirement (host-agnostic, surgical).
- Draft the per-agent spec correction (remove the "not required" framing; add the required-seam + fail-closed language).

### Phase 3: Integration

- Cross-check both edits against shared-spec L172 and epic Contract C for consistency.
- Update/cross-reference the Planning Checklist item.

### Phase 4: Testing and Validation

- Run the grep-based validation commands; confirm old phrasing is gone and new phrasing is present.

## Step-by-Step Tasks

1. Read `docs/context-bonsai-agent-spec.md` and `docs/agent-specs/claude-code-context-bonsai-spec.md`.
2. Add the resilient-discovery requirement to the shared spec under Policy and Safety Constraints, framed as complementary to the fail-closed rule.
3. Remove the "not required" / "MCP server alone is functionally complete" framing from the per-agent spec.
4. Add to the per-agent spec: a transcript-rewrite seam is required for context reduction; the MCP server MUST fail closed when it is absent.
5. Update or cross-reference the Planning Checklist fail-closed item.
6. Re-read both specs end-to-end to confirm no contradiction remains.

## Testing Strategy

- Documentation story: no unit tests. Verification is grep-based presence/absence checks plus a manual consistency read of both specs.

## Validation Commands

- `! grep -niE 'not required|recommended but not' docs/agent-specs/claude-code-context-bonsai-spec.md`
- `grep -niE 'fail closed|fail-closed' docs/agent-specs/claude-code-context-bonsai-spec.md`
- `grep -niE 'resilien|multi-strategy|self-verif' docs/context-bonsai-agent-spec.md`

## Worktree Artifact Check

- Checked At: `2026-05-17T22:18:10Z`
- Planned Target Files: `docs/context-bonsai-agent-spec.md`, `docs/agent-specs/claude-code-context-bonsai-spec.md`
- Overlaps Found (path + class): `none` (both tracked and clean in the parent repo at check time)
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
