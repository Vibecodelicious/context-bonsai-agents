# Story: Define a Meta-Plan for Future Rebase Planning

## Goal

Create a reusable, deterministic process for generating implementation-ready rebase plans for future upstream updates. This document governs how to CREATE the next rebase plan; it does not execute rebase work directly. The generated plan must be execution-ready and, when orchestrated, must be capable of producing a new `HEAD` with required diverging commits replayed onto latest fetched `UPSTREAM_REF` (default `upstream/dev`, explicit override allowed).

## User Model

### User Gamut

- Maintainers rebasing regularly onto fast-moving upstream
- Reviewers and judges auditing replay correctness and provenance
- Operators rerunning rebase cycles after interruptions or branch movement

### User-Needs Gamut

- Deterministic scope freeze so the same inputs produce the same plan
- Exhaustive, mutually exclusive commit classification with no uncategorized SHAs
- Explicit late-fix intake flow that prevents hidden mid-cycle drift
- Auditable completion gates tied to reviewer+judge approval and evidence consistency

### Ambiguities From User Model

- Speed vs strict traceability: this process prioritizes strict traceability
- Late fixes allowed or forbidden: allowed only via formal intake and full revalidation
- Metadata/doc evidence vs git evidence conflicts: resolved by fixed evidence precedence

## Context References

- `.llm-conductor/planning_guidance.md` - authoritative planning workflow for triage, process phases, output-path conventions, and mandatory validation loop
- `.llm-conductor/ORCHESTRATOR_AGENT.md` - authoritative orchestration workflow used after plan generation during execution

## Acceptance Criteria

- [ ] Input contract is explicit and validated:
      `UPSTREAM_REF`, `SOURCE_REF` must be full refs or full SHAs;
      `SOURCE_HEAD_SHA`, `BASE_SHA` must be full 40-char SHAs.
- [ ] Input grammar is strict and normalized: refs must pass `git rev-parse --verify`, short SHAs are rejected, and ref inputs are normalized to full SHAs before planning logic.
- [ ] Accepted ref namespaces are explicit: allow `refs/heads/*` and `refs/remotes/*`; reject symbolic refs and tags unless explicitly user-approved and recorded.
- [ ] Baseline policy is fixed: default `UPSTREAM_REF` is `upstream/dev`; any override must be explicitly user-supplied and recorded in the generated plan header.
- [ ] The generated rebase plan explicitly states that `.llm-conductor/planning_guidance.md` was read and applied.
- [ ] Freeze rule is explicit: resolve `SOURCE_HEAD_SHA` once; all cycle commands use frozen SHA, never moving `HEAD`.
- [ ] Upstream freeze rule is explicit: resolve and persist `UPSTREAM_HEAD_SHA=$(git rev-parse <UPSTREAM_REF>)` after fetch; all inventory/replay/verification commands use frozen `UPSTREAM_HEAD_SHA`, not moving refs.
- [ ] `BASE_SHA` rule is deterministic: computed as `git merge-base "$UPSTREAM_HEAD_SHA" "$SOURCE_HEAD_SHA"`; if user-supplied, must equal computed value or hard fail.
- [ ] Candidate inventory algorithm is deterministic (command order, merge handling, rename handling, stable row ordering).
- [ ] Classification buckets are fixed and mutually exclusive by precedence:
      `already_in_upstream`, `drop`, `late_fix_pending`, `required_runtime`, `required_docs`, `state_only`, `manual_review`.
- [ ] Precedence order is fixed and first-match deterministic:
      `already_in_upstream > drop > late_fix_pending > required_runtime > required_docs > state_only > manual_review`.
- [ ] Candidate population scope default is fixed: include all commits in `"$UPSTREAM_HEAD_SHA"..SOURCE_HEAD_SHA`; author-filter mode is allowed only when explicitly requested and then must include a fixed identity map in the generated plan.
- [ ] Identity-map normalization is explicit: canonical key is lowercase email; aliases must normalize to lowercase emails.
- [ ] Mandatory fallback exists: if no non-fallback bucket matches or evidence is indeterminate, assign `manual_review` and block sealing.
- [ ] Per-candidate row schema is fixed:
      `sha`, `subject`, `bucket`, `replay_action`, `target_paths`, `mapping_type`, `evidence`, `rationale`, `approver`.
- [ ] Mapping semantics are fixed (`1:1`, `many:1`, `1:many`, `drop`) with non-1:1 equivalence evidence required.
- [ ] Late-fix state machine is defined and enforced:
      `open -> intake -> revalidate -> sealed`; accepted late fixes invalidate prior completion gates and require full revalidation.
- [ ] Completion gates are hard-fail and machine-checkable:
      zero unmapped SHAs, zero unresolved `manual_review`, zero unapproved late fixes, evidence bundle complete, reviewer+judge approvals present.
- [ ] Generated plans include a dedicated baseline-capture phase that does only: run required validations, record raw outputs, and write normalized baseline rows; no replay changes occur in this phase.
- [ ] Baseline row schema is strict and complete per row: `row_id`, `command`, `frozen_upstream_head_sha`, `frozen_source_head_sha`, `exit_code`, `result`, `artifact_path`, `provenance_ref`; missing fields hard-fail the phase.
- [ ] Provenance is first-pass mandatory: missing `provenance_ref` blocks progression to replay phases.
- [ ] Exception ledger contract is deterministic: each exception references `row_id`, rationale, approver, and resolution state.
- [ ] Approval contract is explicit: `approver` format `name <email>`; seal requires two distinct approvers (reviewer + judge).
- [ ] Rerun safety rules are explicit: deterministic branch/worktree naming, clean-state preflight, rollback safety branch.
- [ ] Canonical machine-checked outputs are deterministic (no wall-clock timestamps in canonical sections; stable sort).
- [ ] Generated rebase-plan output paths follow `planning_guidance.md` Path A/Path B exactly:
      `.agents/plans/story-{kebab-case-title}.md` for single-story,
      or `.agents/plans/epic-{epic-title}/...` for epic.
- [ ] Plan-shape selection is deterministic: default to single-story output; epic output is allowed only when rubric confirms all are true: (a) at least two independently executable story files are required, (b) each has distinct acceptance criteria, and (c) dependency ordering between stories is explicit.
- [ ] Generated rebase-plan naming is deterministic and includes `SOURCE_HEAD_SHA`:
      single-story filename pattern: `story-rebase-cycle-<source-head-sha>.md`;
      epic directory/title pattern: `epic-rebase-cycle-<source-head-sha>`.
- [ ] Meta-plan immutability rule is explicit for execution runs: generating a concrete plan must not modify `.agents/plans/story-meta-plan-for-future-rebase-planning.md`.
- [ ] Generated concrete artifact path must be distinct from the meta-plan path and must be created as a new file under `.agents/plans/`.
- [ ] The generated rebase plan includes a non-goal statement: this cycle plan defines and validates rebase work; it does not perform replay/rewrite during planning.
- [ ] The generated rebase plan includes an explicit execution outcome statement: final target branch `HEAD` must be based on latest fetched `UPSTREAM_REF` used by the cycle and include the approved replay set only.
- [ ] The generated rebase plan includes concrete replay execution phases and commands (worktree prep, replay/cherry-pick-or-reimplement flow, conflict handling, validation runs, final gate report), not policy-only guidance.
- [ ] The generated rebase plan includes a deterministic replay-set materialization artifact (ordered source SHAs, mapping type, replay action) required before execution begins.
- [ ] Replay-set artifact contract is deterministic and machine-readable: fixed path `.agents/plans/validation/replay-set-<source-head-sha>.json`; schema fields in order are `source_sha`, `bucket`, `replay_action`, `mapping_type`, `target_paths`, `rationale`, `evidence_ref`; row sort is topological order then full `source_sha`; checksum is SHA-256 of UTF-8 canonical JSON with fixed key order and no insignificant whitespace.
- [ ] Classification allowlists are explicit in generated plans: runtime allowlist defaults to `packages/opencode/**` and `packages/plugin/**`; docs allowlist defaults to `.agents/plans/**` and `.opencode/context_bonsai/**`; state-only includes metadata/state artifacts outside runtime/docs allowlists.
- [ ] Allowlists override policy is explicit: overrides require explicit user request plus reviewer+judge approval and must be recorded in generated plan header.
- [ ] Merge-commit handling is mandatory and deterministic: merge commits are always inventoried by dedicated scan; default classification is `manual_review` hard-block unless approved decomposition mapping exists.
- [ ] Merge inventory ordering is explicit: merge-scan rows are appended after non-merge topological rows, then globally tie-broken by full `source_sha`.
- [ ] Non-merge `manual_review` resolution is deterministic: generated plans must define a machine-readable approvals artifact that maps each unresolved non-merge row to `approved_action` and `approval_refs`; seal hard-fails while any non-merge `manual_review` row is unresolved.
- [ ] Non-merge `manual_review` approvals artifact contract is fixed and machine-readable: path `.agents/plans/validation/manual-review-approvals-<source-head-sha>.json`; schema fields in order are `source_sha`, `approved_action`, `approval_refs`, `resolution_state`; row sort is lexical by full `source_sha`; checksum is SHA-256 of UTF-8 canonical JSON (`jq -S -c .`).
- [ ] `already_in_upstream` algorithm is fixed: use `git cherry -v "$UPSTREAM_HEAD_SHA" "$SOURCE_HEAD_SHA"` as canonical patch-equivalence evidence with stable patch-id fallback when needed.
- [ ] Replay method selection is deterministic: default `cherry-pick`; `re-implement` is allowed only when cherry-pick fails with conflicts that cannot be resolved without introducing out-of-scope changes, and requires intent-equivalence evidence plus reviewer+judge approval.
- [ ] Replay method selection includes a reviewer-simplicity evaluation before switching away from cherry-pick: compare `cherry-pick`, `cherry-pick + minor fixups`, and `re-implement`; prefer the path that is easiest for stakeholders to review and audit, with `cherry-pick` or `cherry-pick + minor fixups` preferred when viable.
- [ ] Architectural adaptation is an approved replay mode: when upstream has materially changed file layout, service boundaries, APIs, or data-flow, generated plans may choose `re-implement` to preserve source intent in the current upstream architecture instead of forcing obsolete hunks, but only after recording why `cherry-pick` or `cherry-pick + minor fixups` would be harder to review or less correct.
- [ ] Replay switch criteria are explicit: out-of-scope paths are paths outside generated-plan allowlists; `re-implement` requires citing those paths plus intent-equivalence evidence.
- [ ] Replay verification is method-aware: generated plans must verify cherry-picked rows using provenance (`cherry picked from commit`) or patch-equivalence mapping; direct source-SHA equality against replayed commit SHA is forbidden.
- [ ] Environment/bootstrap prerequisites are deterministic and executable in generated plans: required toolchain checks, dependency hydration detection, and the exact dependency installation command must appear before post-replay test/typecheck/build gates run.
- [ ] Validation commands are working-directory aware: each command must state the directory it runs from, and generated plans must follow repository-local instructions when they require package-directory execution instead of root-level `--cwd` invocation.
- [ ] Re-implementation rows include an explicit behavioral contract table before execution: source primitive/intent, current upstream API or service boundary, sync/async/Effect return shape, required runtime bridge pattern when boundaries differ, allowed mutation surface, approved metadata/schema shape when metadata is mutated, metadata runtime-validation level, atomicity requirement, generated-artifact/SDK decision, public API exposure decision, and validation evidence.
- [ ] Generated plans distinguish committed-final validation from uncommitted pressure-test validation: if the implementor is not required to commit, final verification must include uncommitted diff commands such as `git diff --name-status` and must not rely only on `UPSTREAM_HEAD_SHA..HEAD` commit-range commands.
- [ ] Generated plans distinguish pressure-test SDK drift from replay commit scope: pressure tests may regenerate SDK/API artifacts locally or record stale generated SDK types as validation friction, but Context Bonsai replay commits must not include generated artifacts; generated-file diffs are left uncommitted for upstream to handle through a completely separate generated-SDK process.
- [ ] Generated artifact exclusion is a hard final gate: when source/API changes imply generated output drift, the generated plan must record the expected generated artifact impact and verify generated files are absent from the replay commit diff before seal.
- [ ] Generated SDK/API type consistency does not override generated-file exclusion: even when generated SDK files would make public TypeScript types cleaner or avoid narrow casts, they must not be committed in the replay; the generated plan must use source-only typing strategies or document expected SDK drift until upstream's separate generated-artifact process runs.
- [ ] Generated plans require the existing Context Bonsai OpenCode integration E2E procedure by reference before final seal; cite `.agents/e2e-context-bonsai-opencode-integration.md` as the authoritative procedure and do not duplicate the procedure steps in the generated plan.
- [ ] The generated rebase plan includes a final verification section that proves rebased-head outcome (`merge-base` with fetched upstream, expected commit inventory, and required validation pass set).

## Implementation Tasks

1. Read `.llm-conductor/planning_guidance.md` and apply its process (feature understanding, codebase intelligence, strategic design, plan construction, mandatory validation loop) to this rebase-planning use case.
2. Produce a new rebase cycle plan (single-story or epic per planning guidance triage) that includes strict input grammar for refs/SHAs and fail-fast behavior.
3. In that generated plan, define freeze protocol (`SOURCE_HEAD_SHA`, `BASE_SHA`) and immutable cycle boundaries.
   - include `UPSTREAM_HEAD_SHA` freeze and require all cycle commands to reference frozen upstream SHA
4. In that generated plan, define canonical candidate inventory algorithm:
   - exact command sequence
   - `--no-merges` default policy
   - rename-aware file evidence
   - stable ordering (topological then full SHA)
   - explicit population scope policy recorded in generated plan header; default is `all commits`, and author-filter mode requires explicit user request plus fixed identity map
   - explicit deterministic merge policy (`manual_review` hard-block by default unless approved decomposition mapping exists)
   - merge commits are always inventoried by dedicated scan and cannot be silently omitted
5. In that generated plan, define classification predicates, precedence table, and `manual_review` fallback.

- define bucket predicate contract table with objective evidence keys and deterministic tie-breakers for each classification bucket
- minimum predicate signals are fixed:
  - `already_in_upstream`: patch-equivalent evidence exists against frozen upstream
  - `drop`: explicit out-of-scope rationale with approval
  - `late_fix_pending`: accepted late-fix marker present and not revalidated
  - `required_runtime`: touches runtime allowlist paths and not matched by higher precedence
  - `required_docs`: touches docs/plan allowlist paths and not matched by higher precedence
  - `state_only`: metadata/state artifacts only and not matched by higher precedence
  - `manual_review`: default fallback for missing/contradictory evidence

6. In that generated plan, define replay-action policy and mapping-type evidence requirements.
7. In that generated plan, define late-fix intake policy, reopen boundaries, and automatic gate invalidation.
8. In that generated plan, define evidence hierarchy and conflict resolution:
   `git graph/range > code diff evidence > artifact metadata`; conflicts force `manual_review`.
9. In that generated plan, define completion checklist and approval gate requirements.
10. Ensure the generated plan file location and naming match `planning_guidance.md` Path A/Path B conventions exactly.
11. Ensure generated-plan sections follow planning-guidance templates (Goal/Story Description, User Model, Acceptance Criteria, Implementation Tasks/Plan, Testing Strategy, Validation Commands, Validation Loop Results).
12. Use deterministic generated-plan naming that includes `SOURCE_HEAD_SHA` (single-story `story-rebase-cycle-<source-head-sha>.md`; epic `epic-rebase-cycle-<source-head-sha>`).
13. Enforce artifact-type guardrails in generated-plan creation runs:
    - do not modify `.agents/plans/story-meta-plan-for-future-rebase-planning.md`
    - create a distinct concrete plan file under `.agents/plans/`
    - fail the run if output path equals the meta-plan path
14. Require generated plan to define concrete execution phases with commands for:
    - fetch/prune and frozen-sha capture
    - isolated replay worktree creation with rerun safety
    - deterministic replay of approved commit set (cherry-pick+resolve or re-implement with intent-equivalence evidence)
    - required test/typecheck/build validations
    - canonical validation set for generated plans is fixed and explicit:
      from `packages/opencode`: `bun test test/tool/registry.test.ts test/session/message-v2.test.ts test/session/session.test.ts`
      from `packages/opencode`: `bun typecheck`
      from repository root: `bun turbo build --filter=opencode`
    - final gate report and ready/not-ready decision
15. Require generated plan to define final rebased-head verification commands proving:
    - branch is based on latest fetched upstream SHA used by the cycle
    - replayed commit inventory matches approved set
    - no unresolved manual-review/late-fix gate remains
16. Require generated plan to define replay-action selection precedence per commit: attempt `cherry-pick` first; `re-implement` only with infeasibility rationale and intent-equivalence evidence.
    - require an explicit reviewer-simplicity evaluation before choosing `re-implement`: assess `cherry-pick`, `cherry-pick + minor fixups`, and `re-implement`; prefer `cherry-pick` or `cherry-pick + minor fixups` when that produces the smallest, clearest, easiest-to-audit result.
    - allow architectural adaptation via `re-implement` when upstream drift in file layout, APIs, service boundaries, or data-flow makes literal replay or minor fixups harder to review or less correct than an intent-preserving port.
17. Require generated plan to define a deterministic replay-set artifact contract (fixed path + schema + sort + checksum) used as the sole replay input for orchestration.
18. Require judge checklist in generated-plan orchestration to include blocking `artifact_type_correctness`: meta-plan unchanged and concrete artifact created at distinct path.
19. Require generated plan to include a dedicated baseline-capture phase before replay with explicit stop-on-missing-row behavior.
20. Require generated plan to define strict baseline row schema and deterministic row ordering; prohibit `n/a` rows for required checks.
21. Require generated plan to include deterministic provenance and exception-ledger checks as blocking gates before replay and before final approval.
22. Require generated plan to define strict input grammar and normalization rules for refs/SHAs, including explicit rejection of short SHAs.
23. Require generated plan to define canonical checksum algorithm/serialization for replay-set artifact integrity.
24. Require generated plan to include deterministic plan-shape selector (single-story default, epic only with fixed >1-story rubric evidence).
25. Require generated plan to include bucket predicate contract table with objective evidence keys and deterministic tie-breakers.
26. Require generated plan to include deterministic non-merge `manual_review` approvals artifact and seal-time unresolved-row hard-fail checks.
27. Require generated plan to enforce replay-verification method contract (provenance/patch-equivalence for cherry-pick; no direct source-SHA equality checks).
28. Require generated plan to include explicit environment/bootstrap prerequisites for post-replay validation commands.
    - include dependency hydration detection and the exact install command to run when dependencies are missing.
    - express validation commands as command plus required working directory, not only as shell text.
    - follow repository instructions that require package-directory execution for tests/typechecks.
29. Require generated plan to include a behavioral-contract table for each `re-implement` row.
    - contract fields: `source_primitive_or_intent`, `current_upstream_boundary`, `return_shape`, `runtime_bridge_pattern`, `allowed_mutation_surface`, `approved_metadata_schema`, `metadata_runtime_validation`, `atomicity_requirement`, `generated_artifact_decision`, `public_api_exposure_decision`, `validation_evidence`.
    - if source behavior used atomic read-modify-write semantics, the generated plan must state whether equivalent atomicity is acceptance-critical or why current upstream semantics are sufficient.
    - if message/tool/plugin API shape changes could require generated SDK artifacts, the generated plan must record the expected generated artifact impact, state whether public SDK/API consumers eventually need the new shape, and require generated-file diffs to remain uncommitted and absent from replay commits.
    - generated SDK/API files must not be committed to solve type/API consistency during the replay; use a source-only bridge/cast or other minimal non-generated typing strategy if needed, and record that upstream's separate generated-SDK process must eventually refresh public generated types.
    - if plugin/tool metadata can be mutated, the generated plan must define the approved metadata shape or key namespace; generic "any metadata" is insufficient unless the source intent explicitly requires arbitrary metadata.
    - if the current upstream boundary crosses runtime models (for example Effect services called from Promise-returning plugin APIs), the generated plan must state the intended bridge pattern and where errors are surfaced.
    - if metadata is stored under an approved namespace, the generated plan must state whether runtime validation enforces JSON-compatible values or intentionally stores opaque values.
30. Require generated plans to specify validation mode before execution.
    - `committed-final`: branch verification uses `git log`/`git diff` against `UPSTREAM_HEAD_SHA..HEAD` after commits exist.
    - `uncommitted-pressure-test`: verification uses working-tree commands such as `git diff --name-status`, `git diff --stat`, and targeted tests because `HEAD` may still equal `UPSTREAM_HEAD_SHA`.
    - if a pressure test changes message schemas or public plugin/API types without regenerating SDK artifacts, record that as expected pressure-test drift rather than a blocker; if generated artifacts are regenerated locally for validation, leave their diffs uncommitted and require final replay diff checks to exclude them.
31. Require generated plans to include a final Context Bonsai OpenCode integration E2E gate.
    - cite `.agents/e2e-context-bonsai-opencode-integration.md` as the authoritative procedure.
    - do not copy or restate the procedure steps inside the meta-plan or generated plan; reference the existing document and require execution evidence from it.
    - final seal is blocked until the E2E procedure has pass evidence or an explicit approved exception.

## Testing Strategy

- Verify required template sections exist, including Testing Strategy, Validation Commands, Validation Evidence Record, and Validation Exception Ledger.
- Verify validation commands are fully bound with concrete variable assignments and execute non-interactively.
- Verify artifact-type guardrails are testable: meta-plan unchanged and distinct concrete artifact path exists.
- Verify plan-shape selector determinism: single-story default unless fixed epic rubric conditions are met.
- Verify bucket predicate table exists and is objective/deterministic for all buckets.

## Validation Strategy

### Meta-Plan Validation (this document)

- Structural validation: generated-plan requirements are explicit, deterministic, and aligned with `.llm-conductor/planning_guidance.md`
- Ambiguity validation: bucket precedence, scope defaults, baseline defaults, and naming rules are fixed enough that two operators produce equivalent generated plans
- Governance validation: this document is planning-only and does not require executing replay/rewrite during validation

### Operational Validation (run on each generated rebase plan cycle)

- Determinism test: two independent runs on same frozen SHAs produce identical candidate set, buckets, mappings, and counts
- Drift test: move `SOURCE_REF` after freeze; outputs remain unchanged unless reopen is triggered
- Late-fix test: inject one late fix and verify automatic gate invalidation plus required revalidation
- Gate test: leave one SHA unmapped and verify seal is blocked
- Evidence-conflict test: create conflicting artifact vs git evidence and verify `manual_review` block
- Rebased-head outcome test: executing the generated plan yields a target branch whose `HEAD` is based on latest fetched upstream SHA for the cycle and contains only approved replay commits
- Baseline-capture test: baseline phase records all required rows with no missing fields and no `n/a` placeholders for required checks
- Provenance test: every required baseline row has valid provenance reference before replay starts

## Validation Commands

- `git fetch --all --prune`
- `: ${UPSTREAM_REF:?UPSTREAM_REF must be full ref or 40-char SHA}`
- `: ${SOURCE_REF:?SOURCE_REF must be full ref or 40-char SHA}`
- `git rev-parse --verify "$UPSTREAM_REF" "$SOURCE_REF"`
- `SOURCE_HEAD_SHA=$(git rev-parse --verify "$SOURCE_REF")`
- `UPSTREAM_HEAD_SHA=$(git rev-parse --verify "$UPSTREAM_REF")`
- `test ${#SOURCE_HEAD_SHA} -eq 40`
- `BASE_SHA=$(git merge-base "$UPSTREAM_HEAD_SHA" "$SOURCE_HEAD_SHA")`
- `test ${#UPSTREAM_HEAD_SHA} -eq 40`
- `TARGET_REPLAY_HEAD_SHA=${TARGET_REPLAY_HEAD_SHA:?TARGET_REPLAY_HEAD_SHA required}`
- `BASELINE_TABLE_PATH=.agents/plans/validation/story-meta-plan-for-future-rebase-planning.baseline.json`
- `EXCEPTION_LEDGER_PATH=.agents/plans/validation/story-meta-plan-for-future-rebase-planning.exceptions.json`
- `mkdir -p .agents/plans/validation`
- `printf '{"rows":[]}' > "$BASELINE_TABLE_PATH"`
- `printf '{"rows":[]}' > "$EXCEPTION_LEDGER_PATH"`
- `git log --topo-order --reverse --format='%H|%P|%s' "$UPSTREAM_HEAD_SHA".."$SOURCE_HEAD_SHA"`
- `git log --name-status --find-renames --format='%H|%s' "$UPSTREAM_HEAD_SHA".."$SOURCE_HEAD_SHA"`
- `git cherry -v "$UPSTREAM_HEAD_SHA" "$SOURCE_HEAD_SHA"`
- `git diff --name-only "$UPSTREAM_HEAD_SHA"..."$SOURCE_HEAD_SHA"`
- `git merge-base "$UPSTREAM_HEAD_SHA" "$TARGET_REPLAY_HEAD_SHA"`
- `git log --oneline "$UPSTREAM_HEAD_SHA".."$TARGET_REPLAY_HEAD_SHA"`
- `test -f "$BASELINE_TABLE_PATH"`
- `test -f "$EXCEPTION_LEDGER_PATH"`
- `test -z "$(jq -r '.rows[] | select((.command==null) or (.result==null) or (.provenance_ref==null)) | .row_id' "$BASELINE_TABLE_PATH")"`
- `test -z "$(git diff --name-only -- .agents/plans/story-meta-plan-for-future-rebase-planning.md)"`
- `CONCRETE_STORY_PATH=.agents/plans/story-rebase-cycle-${SOURCE_HEAD_SHA}.md`
- `CONCRETE_EPIC_DIR=.agents/plans/epic-rebase-cycle-${SOURCE_HEAD_SHA}`
- `test -f "$CONCRETE_STORY_PATH" || test -f "$CONCRETE_EPIC_DIR/epic-rebase-cycle-${SOURCE_HEAD_SHA}.md"`
- `test -f .llm-conductor/planning_guidance.md`
- `test -f .agents/plans/story-meta-plan-for-future-rebase-planning.md`

## Validation Evidence Record

| Command                 | Baseline Result | Post-Change Result | Delta    | Evidence                                                                         |
| ----------------------- | --------------- | ------------------ | -------- | -------------------------------------------------------------------------------- |
| `missing-details-check` | fail            | pass               | resolved | `.agents/plans/validation/story-meta-plan-for-future-rebase-planning.step1.json` |
| `ambiguity-check`       | fail            | pass               | resolved | `.agents/plans/validation/story-meta-plan-for-future-rebase-planning.step2.json` |

## Validation Exception Ledger

| Story                                            | Iteration Scope | Command Set | Reason | Requesting User | Approval Citation | Timestamp | Expiry/Validity |
| ------------------------------------------------ | --------------- | ----------- | ------ | --------------- | ----------------- | --------- | --------------- |
| (empty by default; zero rows when no exceptions) |                 |             |        |                 |                   |           |                 |

## Validation Loop Results

- Iteration 1:
  - Missing details check: pass
  - Ambiguity check: fail
  - Fixed: baseline default (`upstream/dev`), explicit precedence order, and required population-scope policy.
- Iteration 2:
  - Missing details check: pass
  - Ambiguity check: fail
  - Fixed: deterministic scope default (`all commits`) and explicit author-filter override rule (explicit request + fixed identity map).
- Iteration 3:
  - Missing details check: pass
  - Ambiguity check: pass
  - Iterations run: 3
- Post-loop regression check (after requested scope expansion to execution-ready outcomes):
  - Missing details check: pass
  - Ambiguity check: pass
  - Fixed: execution-outcome wording now targets frozen `UPSTREAM_REF` baseline, adds upstream freeze, deterministic replay artifact contract, merge policy, and replay-method selection precedence for execution-ready generated plans.

- Post-loop regression check (artifact-boundary, baseline capture, and determinism hardening):
  - Missing details check: pass
  - Ambiguity check: pass
  - Fixed: artifact-type guardrails, strict baseline/provenance schema, explicit plan-shape rubric, fixed replay-set schema/path/checksum, canonical validation command set, and frozen-upstream command consistency.

- Post-loop regression check (blocked orchestration learnings from concrete rebase cycle):
  - Missing details check: pass
  - Ambiguity check: pass
  - Fixed: deterministic non-merge `manual_review` resolution contract, replay-verification method contract (provenance/patch-equivalence instead of source-SHA equality), and deterministic environment/bootstrap prerequisites for validation commands.

- Post-loop regression check (cycle-1 implementor friction):
  - Missing details check: pass
  - Ambiguity check: pass
  - Fixed: executable dependency hydration preflight, package-directory-aware validation commands, and required behavioral-contract fields for `re-implement` rows covering return shape, mutation surface, atomicity, and generated-artifact/SDK decisions.

- Post-loop regression check (cycle-2 implementor friction):
  - Missing details check: pass
  - Ambiguity check: pass
  - Fixed: validation-mode distinction for uncommitted pressure tests, explicit public SDK/API exposure decision, and approved metadata/schema shape requirements for metadata-mutating re-implementation rows.

- Post-loop regression check (cycle-3 implementor friction):
  - Missing details check: pass
  - Ambiguity check: pass
  - Fixed: required runtime bridge pattern for crossed runtime models and explicit metadata runtime-validation level for metadata-mutating re-implementation rows.
