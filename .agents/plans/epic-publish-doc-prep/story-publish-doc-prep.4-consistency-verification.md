# Story: Cross-repo consistency + fresh-eyes verification

**Epic:** Publish Doc Prep
**Size:** Medium
**Dependencies:** Stories 1–3 complete

## Story Description

The acceptance gate for the epic. Two passes over the seven published repos (parent + five port repos + plugin): (1) a mechanical consistency pass — every cross-repo link/URL in human-facing docs resolves, and every version/date/status claim agrees wherever it is stated twice; (2) a fresh-eyes reader pass — one agent per repo, which has not seen the edits, plays the target consumer and follows the README start to finish, flagging anything broken, stale, or assuming internal context. Findings loop back to the owning story; the epic closes when both passes are clean.

## User Model

### User Gamut
- Proxy for every publish-day reader; the fresh-eyes agent is deliberately context-free to simulate them.

### User-Needs Gamut
- The needs are stories 1–3's needs; this story's job is proving they're met.

### Design Implications
- Fresh-eyes agents must receive only "you are a user of harness X; here is the repo" — no epic context, no edit history.

## Acceptance Criteria

- [ ] Link/URL matrix: every cross-repo reference in the seven repos' human-facing docs resolves (GitHub URLs checked for correct org/repo/branch form; local relative paths for existence).
- [ ] Claim matrix: upstream version + verification date per port identical everywhere stated (parent README table vs port README vs its evidence doc's own header).
- [ ] Seven fresh-eyes reports, each with zero blocking findings (blocking = broken step, false claim, or required-but-missing information for install/verify).
- [ ] All findings dispositioned: fixed in the owning story's repo, or explicitly waived by the owner.

## Context References

### Relevant Codebase Files (must read)
- Outputs of stories 1–3 (the edited docs) — at execution time
- Parent `README.md` status table — claim-matrix anchor

### New Files to Create
- `.agents/plans/epic-publish-doc-prep/verification-report.md` — the two-pass results and dispositions (plan-adjacent artifact, allowed under the LLM-doc freeze since it is a new plan-directory file)

## Implementation Tasks

1. Build the link + claim matrices mechanically (script or agent with explicit checklists).
2. Launch seven context-free fresh-eyes reader agents (one per repo, consumer persona per port).
3. Consolidate findings → route fixes to owning stories → re-verify changed docs.
4. Write verification-report.md; commit in the parent repo with the epic plan directory.

## Testing Strategy

- This story is the test. Its own check: the verification report lists every link and claim checked, not just failures (silent-coverage rule).

## Validation Commands

- `node -e "..."`/`grep` link checks as recorded in verification-report.md (report must list the exact commands)

## Worktree Artifact Check

- Checked At: 2026-07-07T01:05:00Z
- Planned Target Files: `.agents/plans/epic-publish-doc-prep/verification-report.md` (new)
- Overlaps Found (path + class): none
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
