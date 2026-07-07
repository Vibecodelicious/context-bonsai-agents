# Story: OpenCode plugin README status

**Epic:** Publish Doc Prep
**Size:** Small
**Dependencies:** None

## Story Description

Bring `opencode_context_bonsai_plugin/README.md` to the same reader-serving bar as the other port READMEs: what/install/verify/troubleshoot/provenance + maintainer note. Provenance: the port is sealed at upstream v1.17.13 (tag `bonsai/v1-on-opencode-1.17.13` — the tag lives in the OpenCode harness fork, not this plugin repo; say so in the README), with Protocol A re-verified PASS 2026-07-07 under the amended §3.6 discipline after the reasoning-channel remediation (spec commit `26e791a4`). The repo's historical diagnosis/e2e docs are untouched (several document superseded layouts — they are internal artifacts publishing as-is per epic decision 4).

## User Model

### User Gamut
- OpenCode user installing the plugin; evaluator checking whether the reference implementation is current.

### User-Needs Gamut
- Working install path for the plugin against a published OpenCode; honest note on how this port differs (git-fork port + plugin rather than pure extension); current verification date.

### Design Implications
- The README must not require reading the pilot record to install; it links to it for provenance.

## Acceptance Criteria

- [ ] README covers what/install/verify/troubleshoot/provenance (v1.17.13, Protocol A PASS 2026-07-07) + maintainer note.
- [ ] Install instructions verified against the actual plugin wiring the sealed port uses (read the fork worktree's `.opencode/opencode.jsonc` pattern and the plugin package entry points before writing).
- [ ] No historical doc in the repo modified.

## Context References

### Relevant Codebase Files (must read)
- `opencode_context_bonsai_plugin/README.md` — current state
- `opencode/.agent_tmp/rebase-on-v1.17.13/.opencode/opencode.jsonc` — real plugin wiring
- `.agents/pilot/gpt55-v1.17.13-final-report.md` + intent-log remediation entry — provenance facts

### New Files to Create
- None.

## Implementation Tasks

1. Read current README, plugin package.json entry points, and the sealed port's wiring.
2. Rewrite/extend README to the acceptance list.
3. Commit locally (message with body; README only), following Story 2's detached-HEAD rule (this repo is detached from `b635284` — verify whether HEAD equals a named branch tip; if not, escalate rather than commit).

## Testing Strategy

- Story 4 fresh-eyes read; install path additionally sanity-checked against the wiring files cited.

## Validation Commands

- `git -C /home/basil/projects/context-bonsai-agents/opencode_context_bonsai_plugin status --short` (README only)

## Worktree Artifact Check

- Checked At: 2026-07-07T01:05:00Z
- Planned Target Files: `README.md`
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
