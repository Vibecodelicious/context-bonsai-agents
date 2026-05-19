# Story: Rewire wiring, documentation, pins, and re-verify

**Epic:** Relocate Pi Context Bonsai Out Of The pi-mono Fork
**Size:** Medium
**Dependencies:** Story 4 (the fork must be stripped before pins advance and docs are finalized).

## Story Description

With the extension relocated, the test infrastructure rebuilt, and the fork stripped, this story makes the relocation real for users and for the project record. It rewrites the Pi side-repo README for the no-fork install path, rewrites the moved e2e doc, advances the parent submodule pins, re-runs the rewritten e2e from a working directory unrelated to the extension to close the cwd-dependency gap, and amends `.agents/plans/epic-pi-port/` so the migrated epic matches the corrected spec.

The cwd-dependency gap is specific: the prior Pi behavioral test passed only because Pi was launched from inside the `pi/` directory, where a project-local symlink lived. The relocated design relies on user-global `~/.pi/agent/extensions/` discovery, which works from any directory. This story's re-verification MUST launch Pi from an unrelated directory to prove that.

## User Model

### User Gamut
Examples only; broad dimensions.
- A first-time user installing Context Bonsai for Pi from the published README.
- A user who runs Pi against their own project directories, not the extension's directory.
- The maintainer advancing the parent repo to a coherent committed state.
- A reader of `.agents/plans/epic-pi-port/` who needs the plan to match reality.

### User-Needs Gamut
Examples only; broad dimensions.
- An install path that does not mention a pi-mono fork: install Pi normally, add the extension to the user-global extensions directory.
- Confidence that bonsai loads regardless of which directory Pi is launched from.
- Parent submodule pins that reference the relocated, stripped state.
- Plan docs consistent with the implemented architecture.

### Design Implications
- The README install path: install a published Pi (`@mariozechner/pi-coding-agent`), obtain the `pi_context_bonsai` extension, wire it into `~/.pi/agent/extensions/`, verify. No fork clone, no `pi-test.sh`.
- Re-verification launches Pi from a directory that is neither the extension directory nor the side-repo clone.

## Acceptance Criteria

- [ ] `pi_context_bonsai/README.md` documents the no-fork install path: install published Pi, obtain the extension, wire it into `~/.pi/agent/extensions/`, verify. It contains the five Operator Documentation Contract categories (Prerequisites, Install commands, Post-install verification, Security disclosure, Uninstall) and no instruction to clone a pi-mono fork.
- [ ] `pi_context_bonsai/docs/e2e-testing.md` content is rewritten for the rewritten e2e. The doc currently hard-codes `pi-test.sh`, `PI_ROOT`, and a monorepo install; that content is replaced, not merely reference-patched.
- [ ] The parent `pi` submodule pin references the stripped (bonsai-free) fork commit from Story 4.
- [ ] The parent `pi_context_bonsai` submodule pin references the populated side-repo commit from Stories 1–3.
- [ ] The rewritten e2e is run with Pi launched from a working directory unrelated to the extension; Protocol A passes with transcript evidence.
- [ ] `.agents/plans/epic-pi-port/` is amended: in-tree (`pi-mono/packages/context-bonsai/`) language is corrected to the standalone side-repo architecture.
- [ ] The parent `README.md` Pi row is consistent with the relocated architecture.

## Context References

### Relevant Codebase Files (must read)
- `pi_context_bonsai/README.md` — current README; to be rewritten for the no-fork path.
- `pi_context_bonsai/docs/e2e-testing.md` — moved by Story 2; to be rewritten.
- `opencode_context_bonsai_plugin/README.md` — reference for the Operator Documentation Contract structure.
- `README.md` (parent) — the agent harness support table; the Pi row.
- `.agents/plans/epic-pi-port/` — the migrated 5-story epic with in-tree language to correct.
- `docs/agent-specs/pi-context-bonsai-spec.md` — the corrected spec the README and plans must match.

### New Files to Create
- None (all targets are rewrites of existing files plus submodule pin commits).

### Relevant Documentation
- `docs/context-bonsai-agent-spec.md` — Operator Documentation Contract and Code Placement Rule.
- `DEVELOPMENT.md` — Pi is now outside the carry-patches rebase cycle.

## Implementation Plan

### Phase 1: Foundation
- Confirm Story 4 is complete and the fork is stripped.

### Phase 2: Core Implementation
- Rewrite `pi_context_bonsai/README.md` for the no-fork install path, covering all five Operator Documentation Contract categories.
- Rewrite `pi_context_bonsai/docs/e2e-testing.md` for the rewritten e2e.
- Amend `.agents/plans/epic-pi-port/` to remove in-tree language.

### Phase 3: Integration
- Advance the parent submodule pins for `pi` and `pi_context_bonsai`.
- Update the parent `README.md` Pi row as needed.

### Phase 4: Testing and Validation
- Run the rewritten e2e from a working directory unrelated to the extension; capture Protocol A transcript evidence.

## Step-by-Step Tasks

1. Confirm Story 4 complete.
2. Rewrite `pi_context_bonsai/README.md` (no fork; install published Pi; wire extension into `~/.pi/agent/extensions/`; five contract categories).
3. Rewrite `pi_context_bonsai/docs/e2e-testing.md` for the rewritten e2e.
4. Amend `.agents/plans/epic-pi-port/` epic and story files to the standalone architecture.
5. Update the parent `README.md` Pi row if its wording no longer matches.
6. Run the rewritten e2e from an unrelated cwd; record the Protocol A transcript.
7. Advance the parent `pi` and `pi_context_bonsai` submodule pins; commit on the parent.

## Testing Strategy

- The rewritten e2e (from Story 3) is the verification, run here from an unrelated cwd to specifically exercise user-global discovery.
- Behavioral transcript evidence (model calls prune, secret leaves active context, recall fails) is the acceptance evidence — not file presence.

## Validation Commands

- `bash /home/basil/projects/context-bonsai-agents/pi_context_bonsai/test/e2e/run-e2e.sh` (run from an unrelated working directory, credentialed)
- `cd /home/basil/projects/context-bonsai-agents && git submodule status pi pi_context_bonsai`
- `! grep -rIn 'packages/context-bonsai' /home/basil/projects/context-bonsai-agents/pi_context_bonsai/README.md /home/basil/projects/context-bonsai-agents/.agents/plans/epic-pi-port`

## Worktree Artifact Check

- Checked At: `2026-05-18`
- Planned Target Files: `pi_context_bonsai/README.md`, `pi_context_bonsai/docs/e2e-testing.md`, `README.md` (parent), `.agents/plans/epic-pi-port/*`, parent submodule pins for `pi` and `pi_context_bonsai`
- Overlaps Found (path + class): `none` — `pi_context_bonsai`, the parent `README.md`, and `.agents/plans/epic-pi-port/` are clean. (The parent's unrelated `M opencode` submodule pin and the untracked plan directory are not targets of this story.)
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
- [ ] e2e re-verification launched from a directory unrelated to the extension
