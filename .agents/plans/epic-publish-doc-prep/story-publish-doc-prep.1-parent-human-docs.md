# Story: Parent repo human-facing docs

**Epic:** Publish Doc Prep
**Size:** Medium
**Dependencies:** None

## Story Description

Make the parent repo's two human-facing docs (`README.md`, `DEVELOPMENT.md`) serve the publish's primary readers — harness users and evaluators — with truthful, dated per-port status, and give contributors a pointer into the existing spec pipeline plus a short note that an AI self-maintenance system exists. Nothing under `docs/` changes (LLM-facing freeze, epic decision 3).

## User Model

### User Gamut
- Evaluator skimming README for 90 seconds; harness user arriving to find their port's install path; contributor looking for how the system maintains itself.

### User-Needs Gamut
- Trust: dated verification per port. Navigation: one link from README to each port repo. Extension path: DEVELOPMENT points into `docs/agent-specs/` rather than duplicating it.

### Design Implications
- Status claims must cite the evidence docs that already exist (each port's dated e2e results); no adjectives without dates.
- gemini-cli appears, if at all, only as "in development — not yet validated"; never with an install path.

## Acceptance Criteria

- [ ] README per-port status table lists Claude Code, OpenCode, pi, codex, cline, kilo as verified with dates and upstream versions matching each port repo's evidence docs; gemini-cli not presented as usable.
- [ ] README's per-port links point at the correct side repos.
- [ ] DEVELOPMENT.md: confirm `pi_context_bonsai` remains listed under "Side repos" (already at line 42 — validation N1); pi is a standalone extension and must NOT be added to the runtime-harness list at lines 23-27. No change expected here.
- [ ] DEVELOPMENT.md "Carrying Patches on Upstream" section opens with a pointer naming `docs/agent-specs/forward-port-spec.md` + `derivation-pipeline-spec.md` as the current process (existing text kept as manual background).
- [ ] DEVELOPMENT.md backlog reflects what is built by pointing at the actual files (validation N2): `scripts/check-cycle-cadence.mjs`, `scripts/detect-pending-target.mjs`, `scripts/dispatch-escalation.mjs`, `scripts/invoke-routine-cycle.mjs`, `scripts/routine-wake.sh`, and spec §1.20/§1.21 — not by re-documenting them.
- [ ] The self-maintenance note uses the canonical sentence pinned in Story 2, adapted grammatically for the parent ("The ports are kept current by…").
- [ ] A short "AI self-maintenance" note exists in DEVELOPMENT.md: the project maintains its ports via an agent-run forward-port loop; pointer to `docs/agent-specs/README.md`. No new process documentation is written.
- [ ] No file under `docs/` or `.agents/` is modified.

## Context References

### Relevant Codebase Files (must read)
- `README.md:60-75` — current status table (cline/kilo "Untested" rows are stale; audit 2026-07-06)
- `DEVELOPMENT.md:23-27, 46-77, 92-97` — harness list, superseded manual workflow, stale backlog
- Each port repo's dated evidence doc (e.g. `cline_context_bonsai/docs/e2e-results-2026-07-06-cline-2.17.0-live.md`) — source of status dates

### New Files to Create
- None.

## Implementation Tasks

1. Read every port repo's newest dated evidence doc; build the status row facts (upstream version, date, evidence path).
2. Update README status table + port links.
3. Update DEVELOPMENT.md: pi in harness list; spec-pipeline pointer atop the manual section; backlog refresh; self-maintenance note.
4. Self-check against writing guidance (`.llm-conductor/writing_guidance/DOCUMENT_WRITING_GUIDANCE.md`).

## Testing Strategy

- Story 4's fresh-eyes reader and link checks are the acceptance test; here, verify every date/version cited resolves to the named evidence doc.

## Validation Commands

- `git -C /home/basil/projects/context-bonsai-agents diff --stat` (only README.md and DEVELOPMENT.md changed)
- `grep -n "Untested" /home/basil/projects/context-bonsai-agents/README.md` (no stale rows for verified ports)

## Worktree Artifact Check

- Checked At: 2026-07-07T01:05:00Z
- Planned Target Files: `README.md`, `DEVELOPMENT.md`
- Overlaps Found (path + class): none (parent dirt is `opencode.json`, submodule pins, untracked blog/pilot files — not targets)
- Escalation Status: none
- Decision Citation: none

## Plan Approval and Commit Status

- Approval Status: approved
- Approval Citation: Owner reply "Approved." (2026-07-07 showrunner conversation, following validated plan presentation)
- Plan Commit Hash: none
- Ready-for-Orchestration: yes (pending plan commit hash below)

## Completion Checklist

- [ ] All acceptance criteria met
- [ ] Validation commands pass
- [ ] Plan approved and committed before orchestration begins
- [ ] User-model ambiguities resolved or escalated
- [ ] Worktree artifact overlaps resolved
