# Story: Add Operator Documentation Contract to the shared Context Bonsai spec

## Goal

Add a new `## Operator Documentation Contract` section to `docs/context-bonsai-agent-spec.md` requiring every port to ship operator-facing install/usage documentation. Add a brief `## User Model` section naming the gamuts the contract serves. Add the operator doc to the existing `## Suggested Output Artifacts For Per-Agent Plans` list. Per-agent spec propagation and per-port README updates are downstream stories.

## User Model

### User Gamut

- **Senior security engineer** auditing what the install touches and what data leaves the box.
- **Non-developer creator** (PM, designer, hobbyist) building software through coding agents — runs commands when shown them step-by-step but doesn't already know `git clone` / `npm install` / equivalents on their own. The docs must teach the moves.
- **Existing developer adopter** who knows the terminal but is new to Context Bonsai.

### User-Needs Gamut

- Reproducibility on a clean machine without prior project context.
- Concrete copy-paste commands for each platform the port supports.
- A post-install verification step that confirms bonsai is wired in (e.g., a smoke prompt + expected response shape).
- Security disclosure: what data the extension reads, where state persists, what is transmitted to the LLM provider (placeholder summary and index terms YES; archived original content NO), and any network egress the extension initiates separately from the host.
- Uninstall procedure that returns the host to its pre-install state.

## Context References

- `docs/context-bonsai-agent-spec.md` — the shared spec being amended.
- `opencode_context_bonsai_plugin/README.md` — the only existing operator doc with a real Installation section; useful as a starting reference for what a compliant doc looks like.

## Acceptance Criteria

- [ ] `docs/context-bonsai-agent-spec.md` gains a new `## User Model` section between `## Terminology` and `## Required User Outcomes`, with `### User Gamut` and `### User-Needs Gamut` subsections covering the gamuts and needs above. Treat lists as examples, not exhaustive categories.
- [ ] `docs/context-bonsai-agent-spec.md` gains a new `## Operator Documentation Contract` section between `## Policy and Safety Constraints` and `## Invariants`. The section requires every port to ship operator-facing docs covering: Prerequisites, Install commands, Post-install verification, Security disclosure (data read; state persistence; provider transmission per the User-Needs Gamut bullet; any port-initiated network egress), and Uninstall. Ports choose their own doc structure; the categories are content requirements, not section-name requirements.
- [ ] `## Suggested Output Artifacts For Per-Agent Plans` gains one new item: "an operator install/usage doc satisfying the Operator Documentation Contract."
- [ ] All existing MUST/SHOULD/MAY language is preserved unchanged. Edit is additive only.
- [ ] No per-agent spec, side-repo README, parent `README.md`, or other plan/implementation file is modified by this story. Commit subject: `docs(spec): add User Model + Operator Documentation Contract to shared spec`.

## Implementation Tasks

1. Read `docs/context-bonsai-agent-spec.md` end-to-end.
2. Insert the two new sections at the specified positions and add the new item to Suggested Output Artifacts.
3. Self-check that no existing language was weakened, then commit.

## Worktree Artifact Check

- Checked At: 2026-05-07
- Planned Target Files: `docs/context-bonsai-agent-spec.md` (modified — sole target).
- Overlaps Found: none. File is tracked and clean at HEAD `f8c422a`.
- Escalation Status: none.

## Plan Approval and Commit Status

- Approval Status: approved
- Approval Citation: user "Approve" 2026-05-07 after lean-rewrite validator returned APPROVE.
- Plan Commit Hash: see git log of the commit landing this plan file (orchestration entry record).
- Ready-for-Orchestration: yes

## Validation Loop Results

- Prior drafts accumulated scope creep around modal-verb prescription, target-gamut declarations, error-message docs, enterprise security trust-model sub-bullets, Update/Compatibility categories for v1 ports, multi-host-evaluator gamut, Required/Optional artifact subsection split, and elaborate validation-command grep checks — all cut after user pushback. Current shape is the minimum that closes the actual gap (Pi shipped with no operator doc) without imposing fictional content.
- Iteration (post-rewrite, 2026-05-07): APPROVE. No bugs, no missing pieces, goal delivered. Internal consistency verified: the Security-disclosure parenthetical "placeholder summary + index terms YES; archived original content NO" matches the cross-agent spec §4/§5/§6 verbatim. No required changes. Ready for approval and commit.
