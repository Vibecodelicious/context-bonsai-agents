# Story: End-to-end verification for native Claude Code

**Epic:** Re-implement Context Bonsai for Claude Code on tweakcc 4.0
**Size:** Medium
**Dependencies:** Stories 4, 5, 6, 7 (verifies the fully integrated system)

## Story Description

Adapt the e2e protocol to the native-install + tweakcc-4.0 apply flow and run it to a full PASS. A full PASS is the epic's release gate.

Two mandatory test classes, plus the existing scenario set:

**(a) Install-procedure e2e test.** Per the project rule that a documented install path is not done until verified end-to-end from a clean state: start from a clean machine (a fly.io sprite — see `docs/installation-e2e-template.md`), run the documented apply commands *verbatim* (Story 2's harness; MCP registration in `~/.claude.json` per Story 7), and verify the bonsai tools end up not just registered but **functional** — a prune actually reduces context. A documented path that has only been reasoned about does not pass.

**(b) Protocol A — secret-prune oracle.** In a fresh session: seed a unique secret, have the assistant acknowledge it without over-repeating, prune the secret-introducing message (the secret must not appear in tool arguments, summary, or index terms), forbid further tool use, then ask for the secret. The model must be unable to reveal it from active context. The oracle is **invalidated** if the secret appears anywhere unpruned in the transcript — the protocol must check that explicitly.

Adapt the existing protocol document `tweakcc_context_bonsai/docs/e2e-protocol.md`: it already covers scenarios E2E-01..07; add the install-procedure scenario, and align it to native + tweakcc 4.0. While editing, **correct the stale `settings.json` references to `~/.claude.json`** — they occur at `e2e-protocol.md` lines 9, 46, and 64 (all three; Story 7 confirms the authoritative file). `docs/context-bonsai-e2e-template.md` is the cross-port template to align with.

The patch stories (4, 6) deliberately delegate full functional/Protocol-A proof to this story; this story owns it as the integrated release gate.

## User Model

### User Gamut

Examples only:

- The maintainer deciding whether the epic is shippable.
- An operator who will trust the install doc only because it was verified clean-room.
- A reviewer auditing whether "bonsai works for Claude Code" is an evidenced claim.
- A future contributor re-running the protocol after a Claude Code release to detect regressions.

### User-Needs Gamut

Examples only:

- Proof that prune actually reduces tokens — not that a tool returned success text.
- Proof that the documented install commands work verbatim from a clean state.
- A reproducible protocol any contributor can re-run.
- A secret-oracle result that is sound — explicitly invalidated if the secret leaked into unpruned transcript.

### Design Implications

- Clean-state verification uses a fly.io sprite so the dev machine's pre-installed dependencies cannot color the result.
- The install test runs the *documented* commands, not bespoke ones — it tests Story 9's doc as much as the code.
- Native is the primary verified path; npm `cli.js` is smoke-checked, not deeply exercised.
- Provider credentials for the sprite are out-of-band and never committed (see the installation-e2e template's Phase 0).

## Acceptance Criteria

- [ ] `tweakcc_context_bonsai/docs/e2e-protocol.md` is updated for the native + tweakcc-4.0 flow and adds an install-procedure scenario.
- [ ] All three `settings.json` references in `e2e-protocol.md` (lines 9, 46, 64) are corrected to `~/.claude.json`.
- [ ] The install-procedure test runs the documented apply commands verbatim from a clean fly.io sprite and verifies the tools are functional (a prune measurably reduces context), not merely registered.
- [ ] The Protocol A secret-prune oracle is specified and executed, including the explicit invalidation check that the secret never appears in unpruned transcript, tool arguments, summary, or index terms.
- [ ] The existing scenario set (E2E-01..07) is run against the integrated system; results are recorded with PASS/BLOCKED/FAIL verdicts and evidence.
- [ ] A full PASS run is recorded as the epic's release gate.
- [ ] `bun run typecheck` and `bun test` still pass (no regression in the side repo).

## Context References

### Relevant Codebase Files (must read)

- `tweakcc_context_bonsai/docs/e2e-protocol.md` - existing protocol (E2E-01..07); stale `settings.json` at lines 9, 46, 64.
- `docs/context-bonsai-e2e-template.md` - cross-port e2e template incl. Protocol A; align the protocol to it.
- `docs/installation-e2e-template.md` - the fly.io sprite clean-state procedure; Phase 0 credentials are out-of-band.
- `tweakcc_context_bonsai/apply/apply-bonsai.ts` - the documented apply path under test (Story 2).
- `tweakcc_context_bonsai/mcp-server/index.ts` - the patch-presence guard (Story 7) the protocol exercises.

### New Files to Create

- A runnable e2e harness/script under `tweakcc_context_bonsai/` (or an extension of the existing protocol's scripts) for the install-procedure and Protocol A scenarios.

### Relevant Documentation

- The epic, all three Shared Implementation Contracts.
- `docs/context-bonsai-agent-spec.md` "Minimum Validation Scenarios" — the scenario set this story must cover.

## Implementation Plan

### Phase 1: Foundation

- Read the existing protocol, the cross-port template, and the installation-e2e template.

### Phase 2: Core Implementation

- Update `e2e-protocol.md` for native + tweakcc 4.0; add the install-procedure scenario; fix the three `settings.json` lines.
- Specify the Protocol A oracle with the explicit invalidation check.

### Phase 3: Integration

- Build the runnable harness for the install-procedure and Protocol A scenarios on a fly.io sprite.

### Phase 4: Testing and Validation

- Execute the full protocol; record verdicts and evidence; confirm a full PASS gate.

## Step-by-Step Tasks

1. Read `e2e-protocol.md`, `docs/context-bonsai-e2e-template.md`, `docs/installation-e2e-template.md`.
2. Update `e2e-protocol.md` for the native + tweakcc-4.0 flow; correct `settings.json` → `~/.claude.json` at lines 9, 46, 64.
3. Add the install-procedure scenario (clean sprite → documented commands verbatim → functional prune check).
4. Specify the Protocol A secret-prune oracle with the invalidation gate.
5. Build the runnable e2e harness/script.
6. Execute the full protocol on a fly.io sprite; record PASS/BLOCKED/FAIL with evidence.
7. Confirm and record the full-PASS release gate; run `bun run typecheck` and `bun test`.

## Testing Strategy

- This story *is* the test story: e2e on a clean fly.io sprite. Native install is primary; npm `cli.js` gets a smoke check.
- Evidence favors model-visible transcript over internal logs, per the spec's Evidence Expectations.
- Each scenario gets an explicit PASS/BLOCKED/FAIL verdict; a missing dependency is BLOCKED, not FAIL.

## Validation Commands

- `cd tweakcc_context_bonsai && bun run typecheck`
- `cd tweakcc_context_bonsai && bun test`
- `! grep -n 'settings\.json' tweakcc_context_bonsai/docs/e2e-protocol.md`

## Worktree Artifact Check

- Checked At: `2026-05-17T22:18:10Z`
- Planned Target Files: `tweakcc_context_bonsai/docs/e2e-protocol.md`, plus a new e2e harness/script under `tweakcc_context_bonsai/`
- Overlaps Found (path + class): `none` (side repo clean at `a3c5c81`; `e2e-protocol.md` tracked and clean)
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
