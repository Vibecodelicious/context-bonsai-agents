# Story: Rewrite the e2e harness for an installed Pi

**Epic:** Relocate Pi Context Bonsai Out Of The pi-mono Fork
**Size:** Medium
**Dependencies:** Story 2 (the relocated extension and the moved `test/e2e/` tree must exist in the side repo).

## Story Description

The end-to-end harness `pi_context_bonsai/test/e2e/run-e2e.sh` (moved into the side repo by Story 2) hard-assumes an in-tree pi-mono checkout: it sets `PI_ROOT="$PACKAGE_DIR/../.."`, requires `$PI_ROOT/pi-test.sh` and `$PI_ROOT/node_modules/.bin/tsx`, and `pi-test.sh` itself runs Pi's in-tree source via `tsx packages/coding-agent/src/cli.ts`. None of that exists for a standalone side repo.

Rewrite the e2e harness so it exercises a genuinely installed Pi the way a real user would: install `@mariozechner/pi-coding-agent@0.69.0`, place the bonsai extension into `~/.pi/agent/extensions/`, launch Pi from a working directory unrelated to the extension, and run the Protocol A secret-prune oracle. This is the verification that closes the cwd-dependency gap — the earlier behavioral test only passed because Pi was launched from inside the `pi/` directory where a project-local symlink lived.

## User Model

### User Gamut
Examples only; broad dimensions.
- The maintainer who needs an e2e that verifies a real installed Pi per release.
- A reviewer checking that the relocation preserves end-to-end coverage.
- Test automation that runs the e2e with credentials provisioned out-of-band.

### User-Needs Gamut
Examples only; broad dimensions.
- An e2e that installs and drives Pi as a user would, not via in-tree source.
- Verification that bonsai loads regardless of the directory Pi is launched from.
- Behavioral transcript evidence — the model actually calling prune/retrieve — not build-artifact proxies.

### Design Implications
- The e2e installs `@mariozechner/pi-coding-agent@0.69.0` (pinned, consistent with Story 2).
- The extension is wired through `~/.pi/agent/extensions/` — the user-global discovery path.
- Pi is launched from a directory that is neither the extension directory nor the side-repo clone, so the run genuinely exercises cwd-independent discovery.
- Protocol A from `docs/context-bonsai-e2e-template.md` is the behavioral test; credentials are provisioned out-of-band per `docs/installation-e2e-template.md` Phase 0.

## Acceptance Criteria

- [ ] `pi_context_bonsai/test/e2e/run-e2e.sh` is rewritten with no dependency on `PI_ROOT`, `pi-test.sh`, or an in-tree pi checkout.
- [ ] The rewritten harness installs `@mariozechner/pi-coding-agent@0.69.0`, places the extension via `~/.pi/agent/extensions/`, and launches Pi from a directory unrelated to the extension.
- [ ] The rewritten harness runs the Protocol A secret-prune oracle.
- [ ] A run passes: the model calls `context-bonsai-prune`, the secret leaves active context, post-prune recall fails — verified from transcript evidence quoted by the run.
- [ ] `pi_context_bonsai/docs/e2e-testing.md` references that assumed an in-tree checkout (`pi-test.sh`, `PI_ROOT`) are not introduced or relied on by the harness (the doc's own rewrite is Story 5).

## Context References

### Relevant Codebase Files (must read)
- `pi_context_bonsai/test/e2e/run-e2e.sh` — current harness (moved by Story 2); to be rewritten.
- `pi_context_bonsai/test/e2e/check-credentials.ts` — credential preflight; reuse or adapt.
- `docs/context-bonsai-e2e-template.md` — Protocol A definition.
- `docs/installation-e2e-template.md` — sprite-based install verification; Phase 0 credential setup is out-of-band.
- `pi/packages/coding-agent/docs/extensions.md` — extension discovery roots (`~/.pi/agent/extensions/`).

### New Files to Create
- None — `run-e2e.sh` is rewritten in place; supporting scripts adapted as needed.

### Relevant Documentation
- `docs/context-bonsai-e2e-template.md`, `docs/installation-e2e-template.md`.

## Implementation Plan

### Phase 1: Foundation
- Confirm Story 2 is green.
- Read the current `run-e2e.sh` and `check-credentials.ts` to inventory their in-tree assumptions.

### Phase 2: Core Implementation
- Rewrite `run-e2e.sh`: install pinned published Pi, wire the extension into `~/.pi/agent/extensions/`, launch Pi from an unrelated cwd.

### Phase 3: Integration
- Wire Protocol A (seed secret, prune, forbid tools, recall) into the harness.

### Phase 4: Testing and Validation
- Run the harness with provider credentials provisioned out-of-band; capture transcript evidence.

## Step-by-Step Tasks

1. Confirm Story 2 green.
2. Inventory in-tree assumptions in `run-e2e.sh` / `check-credentials.ts`.
3. Rewrite `run-e2e.sh` to install and drive a pinned published Pi from an arbitrary cwd.
4. Implement the Protocol A turn sequence in the harness.
5. Run the harness with out-of-band credentials; confirm behavioral transcript evidence.

## Testing Strategy

- E2E: Protocol A against a genuinely installed Pi launched from a directory other than the extension's.
- Acceptance evidence is the behavioral transcript (model calls prune, secret leaves active context, recall fails) — not file presence or `strings` output.

## Validation Commands

- `bash /home/basil/projects/context-bonsai-agents/pi_context_bonsai/test/e2e/run-e2e.sh` (run from a working directory unrelated to the extension; provider credentials provisioned out-of-band)
- `! grep -rIn 'PI_ROOT\|pi-test.sh' /home/basil/projects/context-bonsai-agents/pi_context_bonsai/test/e2e/run-e2e.sh`

## Worktree Artifact Check

- Checked At: `2026-05-18`
- Planned Target Files: `pi_context_bonsai/test/e2e/run-e2e.sh`, `pi_context_bonsai/test/e2e/check-credentials.ts`
- Overlaps Found (path + class): `none` — `pi_context_bonsai` working tree is clean; these paths arrive via Story 2.
- Escalation Status: `none`
- Decision Citation: `none`

## Plan Approval and Commit Status

- Approval Status: `approved`
- Approval Citation: `User approval — message "approved", 2026-05-18`
- Plan Commit Hash: `15a260d705bf5cbc54f5a7647ad190cef3457cef`
- Ready-for-Orchestration: `yes`

## Completion Checklist

- [ ] All acceptance criteria met
- [ ] Validation commands pass
- [ ] Plan approved and committed before orchestration begins
- [ ] User-model ambiguities resolved or escalated
- [ ] Worktree artifact overlaps resolved (approved direction or explicit deferral)
