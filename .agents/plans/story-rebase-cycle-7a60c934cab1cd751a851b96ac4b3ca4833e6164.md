# Story: Forward-Port Claude Code Context Bonsai To 2.1.156

## Goal

Forward-port the Claude Code/tweakcc Context Bonsai integration from the current verified `@anthropic-ai/claude-code` 2.1.143 target evidence to the latest frozen npm target `@anthropic-ai/claude-code@2.1.156`, preserving the required transcript-rewrite seam, MCP prune/retrieve behavior, and live retrieve visibility validation.

This is a concrete rebase-cycle plan generated after reading and applying `.llm-conductor/planning_guidance.md` and `.agents/plans/story-meta-plan-for-future-rebase-planning.md`.

## Non-Goal

This plan defines and validates the rebase/forward-port work. It does not perform patch replay, runtime modification, or live validation during planning.

## Cycle Header

- Plan type: single-story plan.
- Plan-shape rationale: the Claude Code 2.1.156 forward-port is one coupled deliverable; patch anchors, semantic analysis, docs, and live validation all depend on the same frozen npm artifact identity.
- Concrete plan path: `.agents/plans/story-rebase-cycle-7a60c934cab1cd751a851b96ac4b3ca4833e6164.md`.
- Meta-plan path: `.agents/plans/story-meta-plan-for-future-rebase-planning.md`.
- Meta-plan immutability: implementation must not modify the meta-plan.
- Source repo: `tweakcc_context_bonsai`.
- SOURCE_REF: `refs/heads/main` in `tweakcc_context_bonsai`.
- SOURCE_HEAD_SHA: `7a60c934cab1cd751a851b96ac4b3ca4833e6164`.
- UPSTREAM_REF adaptation: Claude Code has no public git upstream ref; the frozen upstream target is the native Claude Code runtime whose package identity is `@anthropic-ai/claude-code@2.1.156`.
- UPSTREAM_HEAD_SHA adaptation: not applicable to closed npm artifact; use the frozen npm package identity below as the upstream identity.
- Target package version: `2.1.156`.
- Target tarball: `https://registry.npmjs.org/@anthropic-ai/claude-code/-/claude-code-2.1.156.tgz`.
- Target npm integrity: `sha512-DRIqsawy+n+LtNBaxOW+3JYLaehbCdEdc+mZjYv/zRnZ1bHeTetJBcV41TagNjL00hHjrlALdl76wmA4s/PVQQ==`.
- Target npm shasum: `32f21eb881e84f421195873842c68c367093d43e`.
- Runtime target binding: live validation must hard-fail unless `claude --version` reports `2.1.156`; patch application must either use an explicit frozen native install path or record evidence that tweakcc auto-detected exactly that 2.1.156 install.
- Final execution outcome: `tweakcc_context_bonsai` `HEAD` must contain only approved changes needed to support the frozen native 2.1.156 runtime artifact, and the parent repo must advance the submodule pin only after side-repo approval.

## User Model

### User Gamut

- Claude Code users who need long-running session pruning without leaked archived context.
- Maintainers who forward-port a closed-source runtime patch across fast-moving Claude Code releases.
- Reviewers who need semantic evidence that minified bundle anchors target the real provider-transcript behavior, not incidental syntax.
- Operators running live E2E in authenticated disposable environments where credentials must not enter artifacts.

### User-Needs Gamut

- Deterministic target freezing so every reviewer can identify the exact Claude Code package and extracted bundle used.
- Release-gate evidence that prune hides archived content and retrieve makes it visible again in real Claude Code, not only in unit fixtures.
- Fail-closed patch behavior when anchors are missing, ambiguous, or semantically wrong for the new target.
- Minimal side-repo and parent changes that are easy to audit and do not commit extracted closed-source bundles or credentials.

### Ambiguities From User Model

- Git-rebase meta-plan fields do not map one-to-one to Claude Code because Claude Code is a closed native/npm-distributed runtime artifact, not a public upstream branch. This plan resolves that by treating the exact native `claude --version` output, npm tarball identity, integrity, shasum, extracted native bundle checksum, and semantic anchor report as the frozen upstream identity.
- Live validation may require Claude Code login/provider credentials. If credentials or sprite access block execution, the implementation may record `BLOCKED`, but final release-ready approval requires the full Claude Code E2E protocol or explicit reviewer+judge exceptions.
- Gauge E2E has historically been less complete than prune/retrieve. This cycle may not claim full release-gate PASS if gauge or any other required E2E scenario is omitted without explicit reviewer+judge exception.

## Context References

- `.llm-conductor/planning_guidance.md` - planning workflow, validation loop, worktree artifact checks, and plan commit gate.
- `.agents/plans/story-meta-plan-for-future-rebase-planning.md` - deterministic rebase planning contract adapted here to a closed npm artifact target.
- `docs/agent-specs/claude-code-context-bonsai-spec.md` - Claude Code-specific contract, semantic anchor requirements, fail-closed behavior, and E2E priorities.
- `docs/context-bonsai-e2e-template.md` - shared Protocol A secret-prune oracle and retrieve behavior expectations.
- `tweakcc_context_bonsai/DEVELOPMENT.md` - side-repo source of truth and validation commands.
- `tweakcc_context_bonsai/README.md` - operator install and patch-apply commands under test.
- `tweakcc_context_bonsai/docs/e2e-protocol.md` - Claude Code live E2E procedure; must be updated from 2.1.143 to this cycle's frozen target when implementation completes.
- `tweakcc_context_bonsai/e2e/native-e2e.ts` - artifact evidence and Protocol A oracle harness; currently defaults to 2.1.143 paths and must be forward-ported.
- `tweakcc_context_bonsai/patches/anchors.ts` - semantic anchor selectors for closed-source bundle seams.
- `tweakcc_context_bonsai/patches/registry.ts` - patch registry and sentinel set.
- `tweakcc_context_bonsai/patches/archived-filter.patch.ts` - required transcript visibility seam.
- `tweakcc_context_bonsai/patches/message-content-ids.patch.ts` - message content construction seam.
- `tweakcc_context_bonsai/patches/context-bonsai-gauge.patch.ts` - gauge/reminder/attachment seams.
- `tweakcc_context_bonsai/apply/apply-bonsai.ts` - patch composition and sentinel verification.

## Immutable Live E2E Scope For This Cycle

Implementation may update `tweakcc_context_bonsai/docs/e2e-protocol.md`, but it may not narrow this cycle's acceptance scope. The required live scenario set for a release-gate PASS is fixed here:

- E2E-00: clean install procedure using the current README commands.
- E2E-01: contiguous prune success, including evidence that archived follower messages are hidden from the model-visible transcript after prune.
- E2E-02: ambiguity rejection and prune-wrapper collision filtering without mutation.
- E2E-03: retrieve by anchor success, including evidence that restored content becomes visible again after retrieval.
- E2E-04: gauge cadence and severity, or explicit reviewer+judge exception if gauge remains partial for this cycle.
- E2E-05: compatibility error path without mutation.
- E2E-06: persistence across resume with archived-state filtering after reload.
- E2E-07 / Protocol A: secret-prune oracle without leaking the secret into prune arguments, summary, or index terms.
- Pinned-target artifact evidence: semantic 2.1.156 anchor analysis plus artifact-evidence JSON generated against the frozen native bundle.

The developer may record `BLOCKED` for scenarios that require unavailable credentials, sprite access, or runtime capabilities, but reviewer+judge approval is required before any `BLOCKED` row can be accepted for final seal. No release-gate PASS may be claimed with an unapproved `BLOCKED` or omitted scenario.

## Evidence Retention Policy

- Committed parent evidence artifacts:
  - `.agents/plans/validation/replay-set-7a60c934cab1cd751a851b96ac4b3ca4833e6164.json`
  - `.agents/plans/validation/rebase-cycle-7a60c934cab1cd751a851b96ac4b3ca4833e6164.baseline.json`
- Committed side-repo evidence artifacts:
  - `tweakcc_context_bonsai/docs/semantic-anchor-analysis-2.1.156.md`
  - `tweakcc_context_bonsai/docs/e2e-results-2026-05-29-2.1.156.md`
- Local-only evidence artifacts:
  - `/tmp/cc-bonsai-artifacts/claude-code/2.1.156/native/extracted.js`
  - `/tmp/cc-bonsai-artifacts/claude-code/2.1.156/native/manifest.json`
  - `/tmp/cc-bonsai-e2e/2.1.156-artifact-evidence.json`
  - `/tmp/cc-bonsai-e2e/2.1.156-protocol-a-oracle.json`

Committed docs must summarize local-only evidence with enough durable facts for review: command, exit code, target version, install path or detection evidence, relevant SHA-256 values, scenario verdicts, and paths to local artifacts. They must not include secrets, credentials, auth paths, full session transcripts, or extracted bundle contents.

## Acceptance Criteria

- [ ] Planning guidance and the rebase meta-plan are followed; any adaptation from git upstream to npm artifact is recorded in this plan and implementation evidence.
- [ ] The frozen target identity is recorded: exact `claude --version`, package version, tarball URL, npm integrity, npm shasum, native install path or explicit detection evidence, extraction command, extracted bundle path, manifest path, and extracted bundle SHA-256.
- [ ] No closed-source extracted Claude Code bundle, auth file, credential, or live session transcript is committed.
- [ ] `tweakcc_context_bonsai/e2e/native-e2e.ts` supports artifact evidence for `@anthropic-ai/claude-code@2.1.156` without relying on stale 2.1.143 defaults.
- [ ] A committed semantic anchor analysis for 2.1.156 exists and covers all required sections: `archived-filter.visibility`, `message-content-ids.converter`, `context-bonsai-gauge.token-usage`, `context-bonsai-gauge.attachment-pipeline`, `context-bonsai-gauge.reminder-render`, `runtime-helper.fs`, `runtime-helper.config-dir`, and `runtime-helper.session-id`.
- [ ] Each semantic anchor section explains host behavior controlled, required seam rationale, plausible wrong candidates rejected, fail-closed ambiguity evidence, and runtime/model-facing evidence.
- [ ] Patch selectors and patches either work unchanged against the frozen 2.1.156 bundle with semantic evidence or are minimally updated with the same evidence standard.
- [ ] Missing or ambiguous anchors fail closed; no thresholds or ambiguity checks are weakened to make the target pass.
- [ ] MCP prune/retrieve behavior remains unchanged except for target-version evidence/doc updates.
- [ ] Live validation hard-fails unless native `claude --version` reports `2.1.156`, then includes the full Claude Code E2E protocol with Protocol A secret-prune oracle and retrieve visibility with the runtime patch applied.
- [ ] The implementation records a new 2.1.156 E2E run result, including PASS/BLOCKED/FAIL reason codes, and does not claim release-gate PASS without full live E2E evidence plus artifact evidence or explicit reviewer+judge exceptions.
- [ ] Side-repo validation commands pass or any pre-existing baseline failures are recorded with reviewer+judge-approved exceptions.
- [ ] Side repo is committed before parent submodule pin is advanced; parent commit updates only the pin and any necessary parent spec/docs.

## Planned Target Files

### Side Repo Targets

- `tweakcc_context_bonsai/e2e/native-e2e.ts`
- `tweakcc_context_bonsai/patches/anchors.ts`
- `tweakcc_context_bonsai/patches/discovery.ts`
- `tweakcc_context_bonsai/patches/registry.ts`
- `tweakcc_context_bonsai/patches/archived-filter.patch.ts`
- `tweakcc_context_bonsai/patches/message-content-ids.patch.ts`
- `tweakcc_context_bonsai/patches/context-bonsai-gauge.patch.ts`
- `tweakcc_context_bonsai/patches/anchors.test.ts`
- `tweakcc_context_bonsai/patches/discovery.test.ts`
- `tweakcc_context_bonsai/patches/archived-filter.patch.test.ts`
- `tweakcc_context_bonsai/patches/message-content-ids.patch.test.ts`
- `tweakcc_context_bonsai/patches/context-bonsai-gauge.patch.test.ts`
- `tweakcc_context_bonsai/docs/semantic-anchor-analysis-2.1.156.md`
- `tweakcc_context_bonsai/docs/e2e-results-2026-05-29-2.1.156.md`
- `tweakcc_context_bonsai/docs/e2e-protocol.md`
- `tweakcc_context_bonsai/README.md`
- `tweakcc_context_bonsai/DEVELOPMENT.md`

### Parent Repo Targets

- `.agents/plans/validation/replay-set-7a60c934cab1cd751a851b96ac4b3ca4833e6164.json`
- `.agents/plans/validation/rebase-cycle-7a60c934cab1cd751a851b96ac4b3ca4833e6164.baseline.json`
- `docs/agent-specs/claude-code-context-bonsai-spec.md`
- `tweakcc_context_bonsai` submodule pin

### Explicit Non-Targets

- `.agents/plans/story-meta-plan-for-future-rebase-planning.md`
- `opencode`
- `docs/agent-specs/context-bonsai-e2e-spec.md`
- Extracted Claude Code bundles or manifests inside the repository
- Any `~/.claude/**`, auth, credential, or live transcript files

## Implementation Tasks

1. Preflight current state.
   - Confirm parent status and side-repo status.
   - Confirm `SOURCE_HEAD_SHA=7a60c934cab1cd751a851b96ac4b3ca4833e6164` still matches `tweakcc_context_bonsai` `main`, or stop and reopen the plan for drift intake.
   - Confirm unrelated parent artifacts `opencode` and `docs/agent-specs/context-bonsai-e2e-spec.md` remain non-targets.

2. Freeze the Claude Code target artifact.
   - Use `npm view @anthropic-ai/claude-code@2.1.156 version dist.tarball dist.integrity dist.shasum --json`.
   - Run `claude --version` and hard-fail unless it reports `2.1.156`.
   - Capture the native install path used by tweakcc. Prefer an explicit path passed to patch tooling when available; otherwise record tweakcc's detected path and evidence that the detected install is exactly 2.1.156.
   - Extract/read the native bundle into out-of-repo local artifact storage under `/tmp/cc-bonsai-artifacts/claude-code/2.1.156/native/`.
   - Write a local manifest at `/tmp/cc-bonsai-artifacts/claude-code/2.1.156/native/manifest.json` with package identity, `claude --version`, install path, extraction/read command, extraction tool versions, platform, extracted bundle path, and SHA-256.
   - Do not create extracted bundles or manifests under `tweakcc_context_bonsai/.artifacts/**` unless `.gitignore` is deliberately updated and reviewer+judge approve the repository-local artifact policy. Default is out-of-repo `/tmp` storage only.

3. Capture baseline validation before edits.
   - Run side-repo tests and typecheck.
   - Run current artifact-evidence command against 2.1.143 if artifact is available; otherwise record `BLOCKED` baseline for old artifact availability.
   - Record raw outputs under a plan validation artifact path or in the developer report; do not replay or modify implementation in this phase.

4. Re-derive semantic anchors against the frozen 2.1.156 bundle.
   - Inspect the real extracted target bundle semantically.
   - For each required seam, document the behavior controlled and why it is the correct seam.
   - Identify plausible nearby candidates and explain why they are wrong.
   - Preserve fail-closed behavior for missing or ambiguous anchors.

5. Update patch selectors and tests only as needed.
   - Prefer unchanged patches/selectors if semantic analysis proves the anchors are still correct.
   - If selectors need updates, keep changes minimal and tied to the semantic evidence.
   - Do not add synthetic happy-path fixture evidence as release-gate proof; fixtures may only test helper mechanics.

6. Update artifact-evidence tooling and docs for 2.1.156.
   - Update `native-e2e.ts` defaults or arguments so 2.1.156 is the current target.
   - Add `docs/semantic-anchor-analysis-2.1.156.md`.
   - Update `docs/e2e-protocol.md`, `README.md`, `DEVELOPMENT.md`, and parent Claude Code spec only where they currently state stale target evidence.

7. Run local validation.
   - Run `bun test` from `tweakcc_context_bonsai`.
   - Run `bun run typecheck` from `tweakcc_context_bonsai`.
   - Run artifact evidence against the frozen 2.1.156 bundle and verify sentinels.
   - Verify generated/local artifacts remain uncommitted.

8. Run live Claude Code validation.
   - Assert `claude --version` is exactly `2.1.156`; stop otherwise.
   - Apply runtime patches with `bun run apply` against the frozen native Claude Code 2.1.156 install, using an explicit path when possible or recorded exact-version auto-detection evidence otherwise.
   - Confirm MCP tool registration.
   - Execute the immutable live E2E scope listed in this plan for 2.1.156. Any omitted or `BLOCKED` scenario requires explicit reviewer+judge exception before release-gate PASS can be claimed.
   - Execute Protocol A without leaking the secret into prune arguments, summary, or index terms.
   - Execute retrieve by anchor id and verify the restored content is visible again in a later model-visible context.
   - Record the run in `tweakcc_context_bonsai/docs/e2e-results-2026-05-29-2.1.156.md`.

9. Commit and parent pin update.
   - Commit side-repo changes first.
   - Advance parent `tweakcc_context_bonsai` submodule pin.
   - Commit any parent spec/doc changes and the pin together.
   - Push only after review/judgement approval if orchestrating through the standard review loop.

## Replay-Set / Artifact-Drift Materialization

The git replay-set contract from the meta-plan is adapted for a closed native/npm target. Before implementation seal, produce and commit a deterministic artifact-drift inventory at `.agents/plans/validation/replay-set-7a60c934cab1cd751a851b96ac4b3ca4833e6164.json` with canonical JSON rows sorted by `anchor_id`, then `target_path`.

Required row fields, in order:

- `anchor_id`
- `source_version`
- `target_version`
- `bucket`
- `replay_action`
- `mapping_type`
- `target_paths`
- `rationale`
- `evidence_ref`

Allowed buckets:

- `unchanged_anchor`
- `updated_anchor`
- `removed_or_ambiguous_anchor`
- `docs_evidence_only`
- `manual_review`

Precedence is first-match deterministic:

`removed_or_ambiguous_anchor > updated_anchor > unchanged_anchor > docs_evidence_only > manual_review`.

Seal hard-fails if any row remains `manual_review` or `removed_or_ambiguous_anchor` without explicit reviewer+judge approval.

## Baseline Capture Contract

Before implementation changes, create or update `.agents/plans/validation/rebase-cycle-7a60c934cab1cd751a851b96ac4b3ca4833e6164.baseline.json` with rows sorted by `row_id`. This baseline artifact is a planned parent target and must be committed with the implementation evidence. Sensitive data must not be written to it.

Each row must include:

- `row_id`
- `command`
- `frozen_target_package`
- `frozen_source_head_sha`
- `exit_code`
- `result`
- `artifact_path`
- `provenance_ref`

Missing `provenance_ref`, `result`, or `command` hard-fails the baseline phase. Use `BLOCKED` only when a required external dependency is genuinely unavailable; do not use placeholder `n/a` rows.

## Testing Strategy

- Unit and integration tests for patch selectors, patch composition, MCP prune/retrieve, session mutation, and process discovery must pass or have approved baseline exceptions.
- Artifact evidence must validate against the frozen native 2.1.156 extracted bundle and the 2.1.156 semantic anchor report.
- Live Claude Code validation must exercise real MCP tool registration, the full Claude Code E2E protocol, Protocol A, and retrieve visibility after the runtime patch is applied.
- Reviewer must inspect semantic anchor evidence against the real target bundle, not just fixture or sentinel output.

## Validation Commands

Every command is non-interactive unless explicitly classified as live E2E. The developer must run commands from the stated working directory.

### Planning/Preflight Commands

- Working directory: `/home/basil/projects/context-bonsai-agents`
  - `git status --short`
  - `git -C tweakcc_context_bonsai status --short`
  - `git -C tweakcc_context_bonsai rev-parse HEAD`
  - `npm view @anthropic-ai/claude-code@2.1.156 version dist.tarball dist.integrity dist.shasum --json`
  - `claude --version | grep '2.1.156'`
  - `test -z "$(git diff --name-only -- .agents/plans/story-meta-plan-for-future-rebase-planning.md)"`

### Side-Repo Validation Commands

- Working directory: `/home/basil/projects/context-bonsai-agents/tweakcc_context_bonsai`
  - `bun install`
  - `bun test`
  - `bun run typecheck`
  - `bun run e2e/native-e2e.ts artifact-evidence --bundle /tmp/cc-bonsai-artifacts/claude-code/2.1.156/native/extracted.js --manifest /tmp/cc-bonsai-artifacts/claude-code/2.1.156/native/manifest.json --out /tmp/cc-bonsai-e2e/2.1.156-artifact-evidence.json`
  - `git status --short`

### Live E2E Commands

- Working directory: `/home/basil/projects/context-bonsai-agents/tweakcc_context_bonsai`
  - `claude --version | grep '2.1.156'`
  - `bun run apply`
  - `claude mcp list`
  - `bun run e2e/native-e2e.ts protocol-a-oracle --session <session-jsonl> --secret <secret> --out /tmp/cc-bonsai-e2e/2.1.156-protocol-a-oracle.json`

Live operator prompts must satisfy the immutable live E2E scope in this plan and may use `tweakcc_context_bonsai/docs/e2e-protocol.md` plus `docs/context-bonsai-e2e-template.md#protocol-a-secret-prune-oracle` for procedure detail. The secret literal must not appear in prune patterns, summary, or index terms.

### Final Verification Commands

- Working directory: `/home/basil/projects/context-bonsai-agents/tweakcc_context_bonsai`
  - `git log --oneline -5`
  - `git diff --name-status HEAD~1..HEAD`
  - `git status --short`

- Working directory: `/home/basil/projects/context-bonsai-agents`
  - `git status --short`
  - `git diff --submodule=short HEAD~1..HEAD`
  - `git diff --name-only -- .agents/plans/story-meta-plan-for-future-rebase-planning.md`

## Worktree Artifact Check

- Checked At: `2026-05-29T03:39:22Z`
- Planned Target Files: see `Planned Target Files` above.
- Overlaps Found: none for planned target files observed during planning.
- Existing Non-Target Artifacts: parent `opencode` and `docs/agent-specs/context-bonsai-e2e-spec.md` are present and must not be modified by this story unless Basil explicitly changes scope.
- Artifact Storage Finding: repository-local `.artifacts/**` is not assumed ignored; extracted Claude Code artifacts must be stored under `/tmp/cc-bonsai-artifacts/**` by default.
- Escalation Status: none for planned targets; non-target artifacts deferred/ignored by scope.
- Decision Citation: Basil requested Claude Code rebase planning and previously noted these artifacts as unrelated.

## Plan Approval and Commit Status

- Approval Status: pending
- Approval Citation: none yet
- Plan Commit Hash: none yet
- Ready-for-Orchestration: no

## Validation Loop Results

- Iteration 1:
  - Missing details check: fail; fixed validation artifact target inventory, native target binding, out-of-repo artifact storage, and executable artifact extraction requirements.
  - Ambiguity check: fail; fixed native 2.1.156 target binding, full E2E scope policy, and validation artifact retention policy.
  - Worktree artifact risk check: pass; no planned target overlaps with tracked-dirty or existing-untracked artifacts.
- Iteration 2:
  - Missing details check: pass.
  - Ambiguity check: fail; fixed immutable E2E scenario scope and committed-vs-local evidence policy.
  - Worktree artifact risk check: pass.
- Final targeted ambiguity recheck: pass.
- Plan-commit status check: pending user approval and plan commit.
- Iterations run: 2 plus targeted final recheck.

## Completion Checklist

- [ ] All acceptance criteria met.
- [ ] Validation commands pass or approved exceptions are recorded.
- [ ] Semantic anchor evidence is complete for 2.1.156.
- [ ] Live Protocol A and retrieve visibility evidence is recorded.
- [ ] Side repo commit exists before parent pin commit.
- [ ] Plan approved and committed before orchestration begins.
- [ ] Worktree artifact overlaps resolved or explicitly deferred.
