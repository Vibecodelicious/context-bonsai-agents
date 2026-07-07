# Epic: Publish Doc Prep

**Goal:** Prepare the human-facing documentation across all Context Bonsai repos for public publish, so that each published repo serves its readers accurately with the smallest doc set — without touching any LLM-facing document the self-maintenance system uses.
**Depends on:** None (publish itself — pushing — is a separate owner action)
**Parallel with:** None
**Complexity:** Medium

## Owner decisions binding this epic (2026-07-06/07 conversation)

1. **Incomplete harnesses are not published as usable ports.** gemini-cli is excluded (never live-validated). OpenCode qualifies as complete: the `structural-protocol-a-regression` escalation was remediated and closed 2026-07-07 (spec §3.6 reasoning-channel extension, parent `26e791a4`; Protocol A re-run PASS, evidence `opencode/.agent_tmp/rebase-on-v1.17.13/.agent_tmp/e2e-on-v1.17.13/protocol-a-remediation/`).
2. **Consumers:** end users of the harnesses are primary; evaluators second. Contributors/maintainers get pointers to existing information plus a short note that an AI self-maintenance system exists — not new documentation.
3. **LLM-facing docs do not change at all.** That includes: `docs/agent-specs/**`, the per-harness e2e runbooks in parent `docs/`, `docs/meta-loop-direction.md`, all `.agents/**` (plans, pilot records, intent/observer logs), all HAND_OFF files, and the side repos' e2e/binding evidence docs that the loop's evidence chain cites.
4. **Internal artifacts publish in public history as-is.** No history surgery, no quarantine, no exclusion.
5. **End-state over per-finding patching** (owner correction, 2026-07-06): docs that serve no purpose are deleted, not fixed; no "don't do the old thing" residue is written into replacements.

## User Model

### User Gamut (examples only; broad dimensions)
- Harness end users (any of the six CLIs/agents; possibly non-developers) who want context pruning working in their tool today.
- Evaluators deciding in ~90 seconds from the parent README whether the project is real, tested, and maintained.
- Contributors wanting to bind a new harness or fix a port — served by pointers to the existing spec pipeline.
- Researchers reading the pilot/meta-loop record — served by the internal artifacts publishing as-is.
- Security-conscious adopters who need to know what the extension stores and that nothing leaves the machine.
- Future maintainer agents that boot from these docs (their docs are the LLM-facing set, frozen by decision 3).

### User-Needs Gamut (examples only)
- Trust calibration: dated verification evidence, honest per-port status.
- Fast install success on a fresh machine, prerequisites honest about credentials.
- Provenance: which upstream version each port is certified against, and when.
- Safety comprehension: data flow, storage locations.
- Low noise: install path findable without wading through relay bookkeeping.
- Extension path: a discoverable pointer from human docs into the spec pipeline.

### Ambiguities From User Model
- Resolved by owner: scope (no incomplete harnesses), consumer priority (users first), LLM-doc freeze, internal artifacts as-is.
- Remaining, resolved in-plan: OpenCode presented as in-progress (decision 1 applied to the open regression); per-repo "verified" wording tied to the dated evidence docs already in each repo.

## Stories

### Story 1: Parent repo human-facing docs
**Size:** Medium
**Description:** README per-port status table made truthful (verified ports with dates: Claude Code, OpenCode, pi, codex, cline, kilo; gemini-cli not listed as usable); DEVELOPMENT.md updated for contributors (pi submodule listed, superseded manual sections pointed at the spec pipeline, short "AI self-maintenance system" note pointing to `docs/agent-specs/`). No `docs/` file is touched.
**Implementation Plan:** `.agents/plans/epic-publish-doc-prep/story-publish-doc-prep.1-parent-human-docs.md`

### Story 2: Port side-repo READMEs (tweakcc, pi, cline, codex, kilo)
**Size:** Medium
**Description:** Each published port repo's README serves install → verify → troubleshoot → provenance for its harness user, cites its dated evidence doc, and carries the maintainer pointer note. pi additionally gets its agreed end-state: STANDARDS.md deleted, package.json files-array entry removed, DEVELOPMENT.md's three stale filenames corrected. cline README headline evidence repointed at the v2.17.0-cli record. codex README notes the active tag. Evidence docs themselves (LLM-facing) untouched.
**Implementation Plan:** `.agents/plans/epic-publish-doc-prep/story-publish-doc-prep.2-port-readmes.md`

### Story 3: OpenCode plugin README status
**Size:** Small
**Description:** `opencode_context_bonsai_plugin/README.md` serves the OpenCode user like the other port READMEs: install → verify → provenance (sealed at v1.17.13; Protocol A PASS 2026-07-07 under the amended §3.6 discipline), plus the maintainer pointer note. Historical docs in the repo untouched.
**Implementation Plan:** `.agents/plans/epic-publish-doc-prep/story-publish-doc-prep.3-opencode-plugin-status.md`

### Story 4: Cross-repo consistency + fresh-eyes verification
**Size:** Medium
**Description:** After stories 1–3 land: verify cross-repo links (GitHub URLs, parent↔side references in human docs), version/status claims agree everywhere a human doc states them, then one fresh-eyes reader agent per published repo follows the README start-to-finish and flags anything broken or assuming internal context. Failures loop back to the owning story.
**Implementation Plan:** `.agents/plans/epic-publish-doc-prep/story-publish-doc-prep.4-consistency-verification.md`

## Dependencies and Integration

- Prerequisites: none for doc edits. The publish (push) itself is owner-gated and out of scope.
- Enables: the owner's publish across repos.
- Integration points: parent README ↔ side README status claims; all commits local-only.
- Risk: the parent repo currently sits on branch `spec/update-cadence-rule` with unrelated working-tree dirt (opencode.json, untracked blog drafts, relaunch script). Doc commits stage only their own files; branch consolidation before push is the owner's call.
- Risk: none open on OpenCode (regression closed 2026-07-07); if any port's verification state changes before push, the owning story's status line is a one-line update.
