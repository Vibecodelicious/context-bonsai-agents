# Story: Port side-repo READMEs

**Epic:** Publish Doc Prep
**Size:** Medium
**Dependencies:** None (Story 1 shares status facts; coordinate values, not order)

## Story Description

Each published port repo (tweakcc_context_bonsai, pi_context_bonsai, cline_context_bonsai, codex_context_bonsai, kilo_context_bonsai) gets a README that serves its harness user end-to-end — what it is, install, verify-it-works, troubleshoot, provenance (upstream version + dated evidence doc) — plus a two-line maintainer note: pointer to the parent's spec pipeline and the fact that an AI self-maintenance system maintains the port. pi additionally receives its owner-agreed end-state cleanup. LLM-facing evidence docs in these repos are read, cited, and never edited.

## User Model

### User Gamut
- A user of exactly one harness who found this repo directly (search, link) and may never visit the parent repo.

### User-Needs Gamut
- Fresh-machine install that works; honest prerequisites (credentials, Node versions); "how do I know it's working"; what data is stored where; which upstream version this is certified against.

### Design Implications
- Every README must stand alone (no assumed parent context) while linking to the parent for the shared concept explanation — the pattern pi's README already uses.
- Delete-not-fix rule applies to purposeless docs (owner decision 5).

## Acceptance Criteria

- [ ] Each of the five READMEs covers: what/install/verify/troubleshoot/provenance-with-date + maintainer pointer note (AI self-maintenance system, parent spec-pipeline link).
- [ ] pi end-state applied (owner-approved 2026-07-07): `STANDARDS.md` deleted; `package.json` files-array entry for it removed; `DEVELOPMENT.md` file list corrected to the actual `src/` inventory (`prune-pattern*.ts`, `archive-store.ts`, `context-transform.ts` set — verify at execution time).
- [ ] cline README headline evidence points at `docs/e2e-results-2026-07-06-cline-2.17.0-live.md` (the record for the sealed version); the 2.16.0 doc remains linked as prior history.
- [ ] codex README states provenance as: integration carried on branch `feat/spec-compliance` (current tip; no bonsai tag exists in this repo — validation finding B1), upstream `rust-v0.125.0`, evidence `docs/e2e-results-2026-07-06-live.md`. Do not invent or require a tag.
- [ ] No evidence doc, e2e doc, binding doc, HAND_OFF, or `.agents/` file modified in any repo.
- [ ] Deletion scope: only pi `STANDARDS.md` is pre-approved for deletion (no-gap test recorded in the commit body). Any other doc judged purposeless is escalated with its no-gap analysis, not deleted unilaterally.
- [ ] Maintainer note uses this canonical sentence verbatim in every README: "This port is kept current by an AI self-maintenance system that forward-ports Context Bonsai onto new upstream releases. See the process specs in the parent repo: https://github.com/Vibecodelicious/context-bonsai-agents/tree/main/docs/agent-specs"
- [ ] Version/date facts: the single source of truth for each port's upstream version and verification date is that port repo's newest dated evidence-doc header; Story 1 reads the same source; Story 4's claim matrix is the reconciliation gate.
- [ ] Detached-HEAD rule: for a submodule on a detached HEAD whose commit equals a named branch tip, check out that branch before committing so the doc commit advances it, then note the parent pin will need advancing; if the detached commit is NOT a branch tip, stop and escalate — never commit onto a bare detached HEAD. Record branch + resulting SHA in the commit body.

## Context References

### Relevant Codebase Files (must read)
- `pi_context_bonsai/README.md` — the quality bar; its Architecture note / prerequisites style generalizes
- `pi_context_bonsai/STANDARDS.md`, `package.json:15`, `DEVELOPMENT.md:12-14` — the agreed pi cleanup
- `cline_context_bonsai/README.md:3`; `codex_context_bonsai/README.md:109` — audit findings 2026-07-06
- `tweakcc_context_bonsai/README.md`, `kilo_context_bonsai/README.md` — current state to gap-check against the acceptance list
- Each repo's newest dated evidence doc — provenance source

### New Files to Create
- None expected; gaps are filled inside READMEs.

## Implementation Tasks

1. Per repo: read README + evidence docs; gap-check against the what/install/verify/troubleshoot/provenance list. Calibration from validation: tweakcc is near-complete (needs only the dated provenance line + maintainer note); kilo (56 lines) has the largest gap.
2. Apply pi end-state cleanup.
3. Fill README gaps; add the maintainer note; align provenance lines with the evidence docs.
4. Per repo: commit locally (message with body; stage only edited/deleted files). Note: codex/cline/kilo submodules may be on detached HEADs or feature branches — record the branch decision per repo in the commit body.

## Testing Strategy

- Story 4 fresh-eyes read is the acceptance test. Here: `npm test`/`bun test` in repos where package.json changes (pi) to prove the files-array edit breaks nothing.

## Validation Commands

- `git -C <repo> status --short` per repo (only intended files)
- `cd /home/basil/projects/context-bonsai-agents/pi_context_bonsai && npm test` (after package.json edit)
- `ls /home/basil/projects/context-bonsai-agents/pi_context_bonsai/STANDARDS.md` (must fail)

## Worktree Artifact Check

- Checked At: 2026-07-07T01:05:00Z
- Planned Target Files: 5× `README.md`; pi `STANDARDS.md` (delete), `package.json`, `DEVELOPMENT.md`
- Overlaps Found (path + class): none — tweakcc's untracked `capture.pid`/`run-capture*` and parent dirt are not targets. (pi `STANDARDS.md` was briefly tracked-dirty on 2026-07-06 from a stopped agent; reverted same day — re-check at execution.)
- Escalation Status: none
- Decision Citation: owner approval of pi end-state, conversation 2026-07-07 ("Am I right that the parent-level docs already clearly identify the right way…" → confirmed deletion path)

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
