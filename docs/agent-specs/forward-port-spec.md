# Context Bonsai Forward-Port Specification

This is the authoritative contract for carrying a Context Bonsai port onto a new upstream release of its harness. Context Bonsai is a context-management capability (prune, retrieve, and an in-band context gauge) ported onto multiple AI-agent harnesses; a *port* is the harness-specific implementation, carried as a patch chain, plugin, or artifact-patching side repo on top of the harness's releases. This spec defines a shape-agnostic core (the determinism machinery every cycle obeys), two upstream shape bindings (git-fork and closed npm artifact), and the per-harness binding slots a harness must fill before the routine path can run against it.

**Status: operative.** This spec restructured `.agents/plans/story-meta-plan-for-future-rebase-planning.md` and passed the regeneration acceptance test defined in `docs/meta-loop-direction.md` §"Next Step" on 2026-07-02: both most-recent executed cycle plans (OpenCode `4d88b95`, Claude Code `95c2422`) were regenerated clean-room from this spec plus their bindings — including the §1.15 validation loop — and independently audited equivalent on all four criteria (seal/blocking gates, bucket taxonomy and precedence, validation command set with working directories, immutable e2e scope). The meta-plan's old path now holds a pointer note; its full text remains in git history.

## Relationship to the other documents

- **Behavior contract** — [`../context-bonsai-agent-spec.md`](../context-bonsai-agent-spec.md): what Context Bonsai does, harness-independent. A forward-port cycle changes nothing about it.
- **E2E spec** — [`context-bonsai-e2e-spec.md`](context-bonsai-e2e-spec.md): the release gate every cycle ends in. Its disciplines (host-state verification, the Secret Prune Oracle method — Protocol A, pre-publish local sourcing, out-of-band credentials, BLOCKED ≠ FAIL) bind every cycle; this spec cites them and does not restate them.
- **`DEVELOPMENT.md`** §"Carrying Patches on Upstream": the human-facing statement of the git-fork loop. Its per-cycle steps 4–9 (tagging, Protocol A, pin advance, pre-publish install gate, publish ordering, `main` fast-forward) are incorporated into the git-fork shape binding below; the two documents must not diverge.
- **Direction statement** — `../meta-loop-direction.md`: why this spec exists, its acceptance test, and the executor-tiering intent. This spec is written to be executable by the target executor named there (GPT-5.5 at low/medium thinking under a process orchestrator); no step may require a judgment call the spec does not resolve. Where a genuinely unresolved situation arises, the resolution is always one of: a fixed default stated here, a hard-blocking classification, or a stop-and-escalate rule — never executor discretion.

## How a routine cycle uses this spec

One cycle = one new upstream release for one harness. The target release (git-fork: the release tag; closed-artifact: the package version) is a cycle-start input supplied by the invoker. The executor never self-selects a target and never resolves "latest"; if the target is not supplied, STOP and request it. The executor:

1. Reads Part 1 (core), the harness's shape binding (Part 2 or Part 3), and the harness's slot table (Part 4). If the harness has no bound slot table, STOP: this is the new-harness path, out of scope for the routine executor (see §1.17).
2. Generates a cycle plan per the "Generated cycle-plan contract" (Part 1), binding every core and shape requirement to the slot values.
3. Runs the generation validation loop, obtains plan approval, commits the plan.
4. Executes the plan phase by phase; seals only when every seal gate passes.
5. Performs routine maintenance: absorbs this cycle's friction back into this spec's Part 4 slots or flags core/shape gaps (see "Routine maintenance"). This step also runs when step 4 (or any earlier step) ends in a STOP instead of a seal.

All relative paths in this spec are from the parent repo root (`context-bonsai-agents/`).

---

# Part 1: Shape-Agnostic Core

## 1.1 Cycle identity and freeze protocol

Every cycle freezes its inputs once, at cycle start, and never re-resolves them.

- **Source identity**: `SOURCE_REF` (full ref) and `SOURCE_HEAD_SHA` (full 40-char SHA) of the port being carried forward. Short SHAs are rejected; refs must pass `git rev-parse --verify` and are normalized to full SHAs before any planning logic.
- **Upstream identity**: shape-defined (Part 2: fetched release ref frozen to SHA; Part 3: npm package identity with tarball integrity). Frozen the same way: resolve once, record, use only the frozen value.
- All cycle commands reference frozen values. The executor must not substitute moving refs, `HEAD`, or "latest".
- The invoker-supplied identities define the cycle. If, already at generation time, the supplied source identity differs from the tracked source's current tip, STOP and confirm with the invoker (stale input vs. intended historical cycle) rather than silently generating or re-keying; drift discovered later, at execution preflight, is handled per §1.9.
- The frozen identities appear verbatim in the generated plan's header, together with every derived value (base SHA, worktree path, target branch/tag names, validation mode) so the plan is executable without re-derivation.

## 1.2 Deterministic inventory

The inventory is the complete, deterministically ordered set of items the cycle must account for. The shape defines the item type and the exact procedure (Part 2: commits in a frozen range; Part 3: anchors in the harness's anchor registry). Core requirements:

- The procedure is a fixed command/step sequence producing stable ordering. Two runs on the same frozen inputs produce identical inventories.
- Nothing is silently omitted. Items the procedure cannot classify still appear, in the fallback bucket.
- Every inventory item receives exactly one bucket (below).

## 1.3 Classification

- Buckets are fixed per shape, mutually exclusive, assigned by first-match against a fixed precedence order.
- Each bucket has an objective evidence predicate (shape-defined). Missing or contradictory evidence forces the fallback bucket `manual_review`.
- Evidence precedence is fixed per shape; when evidence sources conflict, the item goes to `manual_review` — the executor never adjudicates the conflict.
- `manual_review` is hard-blocking: the seal fails while any `manual_review` item lacks an approved resolution recorded per the shape's approval-recording mechanism (§1.5). A shape may designate additional hard-blocking buckets.

## 1.4 Replay-set artifact

The replay set is the sole machine-readable input to execution.

- Path: `.agents/plans/validation/replay-set-<SOURCE_HEAD_SHA>.json`.
- Schema and row sort are shape-defined (Parts 2 and 3 fix field order exactly).
- Checksum discipline is shape-bound. Git-fork (Part 2): the plan records a SHA-256 of the UTF-8 canonical JSON (fixed key order, no insignificant whitespace; canonicalize with `jq -c`), verified before replay begins and unchanged at seal time. Closed-artifact (Part 3): the executed precedent commits the artifact without a recorded checksum; the committed, diff-tracked file itself is the frozen input.
- Checksum verification must be concretely executable: at compute time the digest is captured into a named shell variable or written as the literal value into the plan header, and every later verify command references that captured value — an executable command must never contain unresolved placeholder text.

## 1.5 Manual-review approval recording

The core invariant: the seal hard-fails while any hard-blocking row lacks an explicit, recorded reviewer+judge-approved resolution. The recording mechanism is shape-bound:

- **Git-fork (Part 2)**: a separate approvals artifact at `.agents/plans/validation/manual-review-approvals-<SOURCE_HEAD_SHA>.json`. Row fields, in order: `source_sha`, `approved_action`, `approval_refs`, `resolution_state`. Row sort: lexical by item id. Checksum: SHA-256 of the canonical JSON (`jq -c`, as for the replay set in §1.4 and as the executed precedent sealed), recorded in the plan and re-verified at preflight. Approved means `resolution_state=approved`.
- **Closed-artifact (Part 3)**: per the executed precedent, approval is recorded in the generated plan itself — an acceptance criterion naming each hard-blocking row and its approved resolution, with the approval citation. No separate approvals file is created.

## 1.6 Baseline capture

A dedicated phase, before any replay work, that only runs the required validations and records results. No replay changes occur in this phase.

- Row fields, in order: `row_id`, `command`, frozen upstream identity field (shape-defined name), `frozen_source_head_sha`, `exit_code`, `result`, `artifact_path`, `provenance_ref`.
- A missing required field — `command`, `result`, `provenance_ref`, or any other schema field — hard-fails the phase. `BLOCKED` is allowed only when a required external dependency is genuinely unavailable; placeholder `n/a` rows are forbidden. These rules apply to every baseline row, not only provenance.
- Non-zero `exit_code` is captured as data, not as a phase failure — except rows the plan designates must-be-green: if a designated row fails on the clean upstream baseline, STOP and escalate (a pre-existing upstream regression is not this cycle's to fix).
- For an artifact that replay itself introduces (it cannot exist at baseline), the baseline row is an existence probe with `result` of `missing-as-expected` or `unexpected-presence` (`unexpected-presence` hard-fails). Do not run a test command against a path known not to exist.
- Missing `provenance_ref` on any row blocks progression to replay.
- Baseline artifact path: `.agents/plans/validation/baseline-<SOURCE_HEAD_SHA>.json`.

## 1.7 Exception recording

The core invariant: every deviation from the plan's default path (out-of-scope fixup, e2e evidence bypass, allowlist override) requires reviewer+judge approval recorded **before** the deviating action — approval precedes the deviation, never ratifies it afterward — and the seal hard-fails on any unresolved exception record. The recording mechanism is shape-bound:

- **Git-fork (Part 2)**: a ledger file at `.agents/plans/validation/exceptions-<SOURCE_HEAD_SHA>.json`, created at cycle start, empty by default. Each row cites the replay-set row or plan step that authorized the deviation, rationale, reviewer+judge approval refs, and resolution state.
- **Closed-artifact (Part 3)**: per the executed precedent, approved exceptions are recorded in the generated plan's validation sections and completion checklist ("validation commands pass or approved exceptions are recorded"). No separate ledger file is created.

## 1.8 Approval contract

- Approver format: `name <email>`.
- Sealing requires two distinct approvers: reviewer and judge. When the cycle runs under an orchestration layer with its own reviewer and judge gates, those gates satisfy this requirement; the plan records their approval citations.
- Reviewer+judge approval is the unlock token for every STOP condition in this spec that is not an unconditional escalation.

## 1.9 Late fixes and source drift

- **Mid-cycle late fix** (source gains a commit after freeze that must ride this cycle): state machine `open -> intake -> revalidate -> sealed`. `intake` adds the accepted fix to the inventory (classified `late_fix_pending`) and automatically invalidates all prior completion gates; `revalidate` re-runs classification, baseline, and validation for the affected scope in full; only then may sealing resume. Unapproved late fixes hard-fail the seal.
- **Pre-execution source drift** (source moved after plan generation but before execution began): do not patch the plan. Generate a fresh plan keyed to the new `SOURCE_HEAD_SHA`, recording the supersession lineage ("prior-cycle source SHA superseded by drift intake: `<old sha>`") in the new plan's header. The superseded plan file stays in place for history.

## 1.10 Rerun safety

- The replay workspace is shape-bound: git-fork replays in an isolated worktree with a deterministic, slot-defined name, never on the source branch in place (§2.5); the closed-artifact shape works in place in the side repo's working tree on its tracked branch (§3.5).
- Preflight requires clean state in every repo the cycle touches: `git status --short` empty, or containing only enumerated pre-existing dirty paths (next bullet).
- Pre-existing dirty status paths: the invoker or the harness slot (Part 4) may enumerate status paths known to be dirty before the cycle and untouchable by it. The clean-state check passes when `git status --short` output contains only enumerated paths. Never stage, commit, revert, or otherwise absorb an enumerated path; list them in the plan as untouchable. Any non-enumerated dirty path still fails the preflight.
- Pre-existing worktrees or artifacts from prior cycles are out of scope: do not delete or modify them; list them in the plan as untouchable if present.
- Canonical machine-checked outputs contain no wall-clock timestamps and use stable sorts, so reruns produce identical artifacts.

## 1.11 Validation mode

The plan declares one mode before execution. The default for routine cycles of both shapes is `committed-final` (both executed precedents verified against commit ranges); `uncommitted-pressure-test` applies only when the invoker explicitly requests a pressure-test run that stops short of committing.

- `committed-final`: final verification uses commit-range commands (`git log` / `git diff` against `<frozen upstream>..HEAD`) after replay commits exist.
- `uncommitted-pressure-test`: `HEAD` may still equal the frozen upstream; verification uses working-tree commands (`git diff --name-status`, `git diff --stat`, targeted tests). Locally regenerated artifacts (e.g. SDK types) are recorded as expected pressure-test drift, left uncommitted, and excluded by the final diff checks.

## 1.12 Environment and bootstrap preflight

Before any validation gate runs, the plan executes (with slot-bound specifics):

- Toolchain presence checks for every tool the cycle invokes.
- Dependency hydration detection plus the exact install command to run when dependencies are missing.
- Every validation command in the plan is expressed as command **plus required working directory**; package-directory execution requirements from the repo's own docs are followed, not root-level `--cwd` substitutes.

## 1.13 Seal gates

Sealing a cycle requires all of the following, each machine-checkable, with hard failure on any miss:

1. Every inventory item has exactly one replay-set row (zero unmapped items).
2. Zero unresolved `manual_review` rows (and shape-designated hard-blocking buckets), resolved per the shape's approval-recording mechanism (§1.5).
3. Zero unapproved late fixes; any drift handled per 1.9.
4. Replay-set artifact present and schema-valid; where the shape requires a checksum (Part 2), verified before replay and unchanged at seal.
5. Where the shape uses separate approval artifacts (Part 2), their checksums verified.
6. Baseline artifact complete: schema-valid rows, no forbidden placeholders, provenance present.
7. Replay verification evidence per the shape's method (never identity-equality against the source; see shape bindings).
8. Post-replay validation results are no worse than baseline; designated must-be-green rows are green.
9. Change-scope check: the realized diff touches only paths in the union of replay-set `target_paths` (or working-tree diff in pressure-test mode), with any exceptions approved per §1.7 **before** the offending change landed. If an out-of-scope path has already landed without an exception record: STOP and revert.
10. No unresolved exception records, per the shape's exception-recording mechanism (§1.7).
11. E2E release gate: pass evidence for the harness slot's required scenario set, or an explicit reviewer+judge-approved exception record (§1.7). Never record an e2e bypass exception without that approval.
12. Spec immutability, as the exact asserting commands `test -f docs/agent-specs/forward-port-spec.md` and `test -z "$(git diff --name-only -- docs/agent-specs/forward-port-spec.md)"` — the spec still exists and a cycle run has not modified it (routine maintenance, 1.16, happens after the cycle ends as its own change). One exception: when the invoker enumerated the spec file as a pre-existing dirty path (§1.10 — a prior cycle's §1.16 edit still pending owner review, per §1.16's disposition rule), the diff cannot be empty through no act of this cycle; the gate then asserts this cycle did not touch the file instead — record `sha256sum docs/agent-specs/forward-port-spec.md` during the §1.10 preflight and re-assert the identical hash here.
13. Reviewer and judge approvals recorded.
14. The shape's release-gate steps completed in order (Part 2 §2.9 / Part 3 §3.8).

## 1.14 Generated cycle-plan contract

- Path and name: `.agents/plans/story-rebase-cycle-<SOURCE_HEAD_SHA>.md`, a new file. Generating it must not modify this spec or any prior plan; generation hard-fails if the output path collides with an existing artifact. If the colliding artifacts are this same cycle's own (same `SOURCE_HEAD_SHA` plan, validation artifacts, or shape-derived worktree/branch/tag names), the cycle has already been generated or executed: STOP and report to the invoker rather than regenerating or resuming.
- Single-story output is the default. An epic (`.agents/plans/epic-rebase-cycle-<SOURCE_HEAD_SHA>/`) is allowed only when all three hold: at least two independently executable stories are required, each has distinct acceptance criteria, and inter-story dependency order is explicit.
- Required sections, all concrete (commands bound to frozen values and working directories, no policy-only guidance):
  1. Goal, Non-Goal, and an execution outcome statement (final `HEAD` based on the frozen upstream, containing the approved replay set only).
  2. Frozen-inputs header (1.1), including validation mode and any recorded supersession lineage.
  3. Allowlists and planned targets, including explicit non-targets.
  4. Classification: for the git-fork shape, a table in the plan with one row per inventory item and fields `sha`, `subject`, `bucket`, `replay_action`, `target_paths`, `mapping_type` (`1:1`, `many:1`, `1:many`, `drop`; non-`1:1` requires equivalence evidence), `evidence`, `rationale`, `approver`. For the closed-artifact shape, the committed replay-set artifact (§3.4) serves as the classification record (per the executed precedent), with hard-blocking approvals recorded per §1.5. In either form, rows requiring no per-row approval carry the plan's approval citation in `approver`; distinct per-row approver entries are required only for hard-blocking and exception rows.
  5. Shape-required analysis sections (Part 2: reviewer-simplicity evaluation, re-implementation behavioral contracts; Part 3: anchor re-derivation records).
  6. Acceptance criteria.
  7. Implementation phases with commands: credentials preflight, bootstrap and frozen-identity verification, workspace preparation per the shape binding (Part 2: isolated worktree creation; Part 3: in-place side-repo preflight), baseline capture, replay, post-replay validation, e2e gate, release-gate steps and final verification.
  8. Validation commands grouped by working directory, matching the harness slot's canonical set exactly.
  9. E2E gate section citing the slot's e2e procedure and required scenario set.
  10. Worktree artifact check: for every planned target file, record overlap against the classes `tracked-dirty` (tracked, uncommitted modifications) and `existing-untracked` (on disk, untracked). The generator records the check at generation time; the executor re-runs it immediately before its first edit. Any overlap blocks implementation for that path until explicitly approved or deferred, recorded with a decision citation.
  11. Plan approval and commit status: approval status, approval citation, plan commit hash, ready-for-orchestration flag. Execution is blocked until all four are affirmative.
  12. Validation loop results (1.15).
  13. Completion checklist mirroring the seal gates.

## 1.15 Generation validation loop

After generating a cycle plan and before requesting approval:

- Run a missing-details review pass and an ambiguity review pass (independent reviewers; they must inspect the real repository, not just the plan text). Missing-details: anything that would block an executor. Ambiguity: any point where two reasonable executors would act differently.
- Fix findings in the plan; record each iteration's findings and fixes in the plan's Validation Loop Results section. Repeat up to 3 iterations; stop early only when a pass returns zero blocking findings.

## 1.16 Routine maintenance

After a cycle ends — sealed, or halted at a STOP — the executor attempts routine maintenance and records its outcome; a STOP does not waive this step. Maintenance absorbs the cycle's friction back into this spec:

- Slot-level facts that changed (command sets, paths, registry locations) are updated in Part 4 with the cycle's evidence cited.
- Anything that required an exception record, an unplanned STOP, or improvisation is recorded as either a Part 4 slot fix (if harness-local) or flagged in the maintenance report as a core/shape gap for the spec's owner tier — the stronger-model tier that, with the project owner, maintains Parts 1–3 and runs derivations (`docs/meta-loop-direction.md` §"End Goal", executor tiering). The routine executor edits Part 4 only; Parts 1–3 changes escalate.
- Every stumble in the cycle gets a failure-attribution verdict (`docs/meta-loop-direction.md` §"Provisional Future Steps"): `SPEC-GAP` — the spec left a judgment call unresolved; fix the artifact, not the tiering — or `EXECUTOR-FAIL` — the spec was deterministic and the executor still failed.
- On a STOP, the same duties apply to whatever the cycle reached before halting. When no slot-level fact changed, the maintenance report records that explicitly rather than skipping the step.
- **Disposition of the maintenance edit**: the executor leaves its Part 4 edit uncommitted in the working tree and names the exact edited path in the final report; the owner tier reviews it and commits, amends, or reverts. Until that review lands, any subsequent cycle's §1.10 preflight must receive the edited file as an invoker-enumerated pre-existing dirty path — the executor itself never commits spec changes.

## 1.17 Escalation out of the routine path

The routine path fails closed. STOP the cycle and escalate (structural-break derivation, run by the owner tier) when:

- Classification places a mass of inventory items in `manual_review` because evidence is indeterminate across the board — the shape's structural assumptions no longer discriminate.
- Anchor or seam re-derivation fails or is ambiguous for most of the registry (closed-artifact shape) — the harness's internal layout has shifted under the binding.
- Protocol A (the e2e spec's secret-prune oracle) fails on a clean build after all prior validation passed.
- The harness has no bound slot table in Part 4.

Never weaken a threshold, ambiguity rule, or gate to keep the routine path moving. The failure is the signal.

---

# Part 2: Shape Binding — Git-Fork Upstream

For harnesses maintained as a fork carrying a small patch chain on the upstream repo (see `DEVELOPMENT.md` §"Carrying Patches on Upstream"). The chain contains integration patches and fork-only doc commits; all rebase forward together each cycle.

## 2.1 Upstream identity and freeze

- `UPSTREAM_REF` for a routine release cycle is the invoker-supplied new upstream **release tag** (per `DEVELOPMENT.md` per-cycle step 1), recorded as a full ref (`refs/tags/<tag>`). Branch refs (`refs/heads/*`, `refs/remotes/*`) are allowed when the cycle explicitly targets a branch; symbolic refs are rejected. Tags-as-default deliberately supersedes the prior meta-plan rule that treated tags as approval-requiring exceptions; the executed OpenCode cycle's one-off "Tag-as-Upstream Approval" record was an artifact of that superseded rule, and regenerated plans carry no such record.
- Freeze: `git fetch --all --prune`; when `UPSTREAM_REF` is a tag, follow with an explicit tag fetch from the slot's upstream remote — `git fetch <upstream-remote> "refs/tags/<tag>:refs/tags/<tag>"` — because `--all --prune` honors each remote's configured refspec, and a heads-only refspec acquires no tags. Then `UPSTREAM_HEAD_SHA=$(git rev-parse --verify "$UPSTREAM_REF")`, persisted; 40-char check enforced. All subsequent commands use `$UPSTREAM_HEAD_SHA`.
- `BASE_SHA` is computed, never asserted: `git merge-base "$UPSTREAM_HEAD_SHA" "$SOURCE_HEAD_SHA"`. A user-supplied `BASE_SHA` must equal the computed value or the cycle hard-fails.
- Preflight re-verifies the frozen SHAs: clean state per §1.10 (its pre-existing dirty-path enumeration applies), `git rev-parse` of source ref and upstream ref each equal to their frozen values.

## 2.2 Inventory

From the harness repo, in this order:

```
git log --topo-order --reverse --format='%H|%P|%s' "$UPSTREAM_HEAD_SHA".."$SOURCE_HEAD_SHA"
git log --name-status --find-renames --format='%H|%s' "$UPSTREAM_HEAD_SHA".."$SOURCE_HEAD_SHA"
git cherry -v "$UPSTREAM_HEAD_SHA" "$SOURCE_HEAD_SHA"
git log --merges "$UPSTREAM_HEAD_SHA".."$SOURCE_HEAD_SHA"
```

- Population scope default: all commits in the range. Author-filter mode only on explicit user request, and then with a fixed identity map (canonical key: lowercase email) recorded in the plan header.
- Ordering: topological then full SHA. Merge-scan rows are appended after non-merge topological rows, then globally tie-broken by full `source_sha`.
- Merge commits are always inventoried by the dedicated scan and default to `manual_review` (hard-block) unless an approved decomposition mapping exists.

## 2.3 Bucket taxonomy

Precedence, first-match deterministic:

`already_in_upstream > drop > late_fix_pending > required_runtime > required_docs > state_only > manual_review`

| Bucket | Evidence predicate |
|---|---|
| `already_in_upstream` | Patch-equivalent in frozen upstream: `git cherry -v` marks `-`; stable patch-id comparison as fallback evidence |
| `drop` | Explicit out-of-scope rationale with approval |
| `late_fix_pending` | Accepted late-fix marker present, not yet revalidated |
| `required_runtime` | Touches runtime-allowlist paths (slot-defined); not matched above |
| `required_docs` | Touches docs-allowlist paths (slot-defined); not matched above |
| `state_only` | Metadata/state artifacts only, outside runtime/docs allowlists; not matched above |
| `manual_review` | Fallback: missing or contradictory evidence, or paths outside every allowlist |

- Evidence precedence: `git graph/range > code diff evidence > artifact metadata`; conflicts force `manual_review`.
- Fork-only doc commits that live outside every allowlist by design (e.g. the root `README.md` signpost) are classified `manual_review` and resolved through the approvals artifact per cycle — not through an allowlist override. This keeps allowlists tight and each cycle's approval auditable.
- Allowlist overrides require explicit user request plus reviewer+judge approval, recorded in the plan header.

## 2.4 Replay-set schema

Row fields, in order: `source_sha`, `bucket`, `replay_action`, `mapping_type`, `target_paths`, `rationale`, `evidence_ref`. Sort: topological order, then full `source_sha`.

## 2.5 Replay

- Replay proceeds in topological order, one step per approved row, in the isolated worktree on the target branch (slot-defined names).
- Default action: `git cherry-pick -x <source_sha>` (`-x` records the provenance trailer).
- **Conflict scope**: conflict-resolution edits must stay inside the row's `target_paths` as bounded by the allowlists. An edit outside that scope is an out-of-scope fixup: STOP, add an exception-ledger row citing the authorizing replay-set row and reviewer+judge approval refs, then continue.
- **Fork-owned wholesale files** (slot-defined, e.g. the signpost `README.md`): on conflict, replace the whole file from the source commit — `git show <source_sha>:<path> > <path> && git add <path> && git cherry-pick --continue`. Do not use `git checkout --theirs` (it resolves only conflicting hunks). Verify with `diff <(git show <source_sha>:<path>) <path>` empty plus a slot-defined content probe.
- **Re-implement escape**: allowed only when cherry-pick conflicts cannot be resolved without out-of-scope changes, or when upstream has materially changed file layout, APIs, service boundaries, or data-flow such that an intent-preserving port reviews better than forced hunks. Before switching, record a reviewer-simplicity evaluation comparing `cherry-pick`, `cherry-pick + minor fixups`, and `re-implement`, preferring the easiest to review when viable. `re-implement` requires the infeasibility rationale, intent-equivalence evidence, reviewer+judge approval, and a behavioral contract table with exactly these fields: `source_primitive_or_intent`, `current_upstream_boundary`, `return_shape`, `runtime_bridge_pattern`, `allowed_mutation_surface`, `approved_metadata_schema`, `metadata_runtime_validation`, `atomicity_requirement`, `generated_artifact_decision`, `public_api_exposure_decision`, `validation_evidence`.

## 2.6 Replay verification

- Cherry-picked rows are verified by provenance: anchored count of trailers in the replayed range must equal the number of replayed rows —
  `test "$(git log --format='%b' "$UPSTREAM_HEAD_SHA"..HEAD | grep -cE '^\(cherry picked from commit [0-9a-f]{40}\)$')" = "<row count>"` — run once after replay and again, identically, at seal.
- Patch-id comparison (`git patch-id`) demonstrates equivalence when conflict resolution required line-level edits.
- Direct source-SHA equality against a replayed commit SHA is forbidden as evidence.
- Final-state checks: `git merge-base "$UPSTREAM_HEAD_SHA" HEAD` returns `$UPSTREAM_HEAD_SHA`; `git rev-list --count "$UPSTREAM_HEAD_SHA"..HEAD` equals the replayed row count; commit subjects match the replay set.
- Push-readiness at seal, after the rebase-point tag exists locally (§2.9 step 1) and before anything is pushed (§2.9 step 5): `git push --dry-run origin <replay-branch>` and `git push --dry-run origin refs/tags/<bonsai-tag>` must both exit 0.

## 2.7 Generated-artifact exclusion

Replay commits never contain generated artifacts (SDK/API types, `dist/` output), even when committing them would make types cleaner. Use source-only typing strategies; record expected generated drift for upstream's own regeneration process. Hard gate before seal:

```
git diff --name-status "$UPSTREAM_HEAD_SHA"..HEAD | grep -E '(\.d\.ts$|/generated/|/__generated__/|openapi|\.gen\.|/dist/)' | wc -l   # must be 0
```

If any match surfaces: STOP and remove those files from the replay commits.

## 2.8 Baseline specifics

The baseline's frozen upstream identity field is `frozen_upstream_head_sha`. The slot defines the canonical row set; the row exercising the harness's own test suite on clean upstream is designated must-be-green.

## 2.9 Release gate and publish ladder

After the seal gates 1–13 pass, in this order (from `DEVELOPMENT.md` per-cycle steps 4–9):

1. **Tag the rebase point**: `bonsai/v1-on-<harness>-<version>` at the replayed tip — the durable name for a branch ref that will be rewritten next cycle.
2. **Run the e2e behavioral gate** (Protocol A required always; full required set per the harness slot) against the freshly built binary. Passing unit/typecheck gates does not substitute: a conflict can resolve to green types while breaking the hooks Context Bonsai depends on.
3. **Advance the parent submodule pin** on a non-`main` working branch, locally. No pushes yet.
4. **Pre-publish install gate**: run the installation e2e in pre-publish mode (per `docs/installation-e2e-template.md` "Run Mode") against the pin-advanced pair. `PASS` authorizes step 5. `FAIL`: fix the README or install path and re-run. `BLOCKED`: resolve the environmental precondition and re-run. Never publish on `FAIL` or `BLOCKED`.
5. **Publish**: force-push the harness branch with `--force-with-lease`, push the port's submodule, push the parent working branch. Both pushes are preceded by a green `git push --dry-run` for the branch and the tag.
6. **Fast-forward parent `main`** to the validated, pushed working-branch tip; push `main`.

A cycle plan may end before this ladder (recording "do not push; steps gated on reviewer+judge approval") only when the ladder is executed as its own approved continuation; the cycle is not complete until the ladder completes.

Chain disciplines carried from `DEVELOPMENT.md`: each chain commit is a single reviewable concern — no fixup commits (fold corrections into the commit that introduced the problem); preserve retired chains under descriptive branch names before rewriting.

---

# Part 3: Shape Binding — Closed NPM Artifact

For harnesses that ship as a closed, minified npm bundle with no public git upstream (Claude Code). The port lives in a side repo that patches the installed artifact; the upstream identity is the npm package itself.

## 3.1 Upstream identity and freeze

The frozen upstream identity is the npm package identity, recorded in the plan header:

- Package spec (`<package>@<version>`) at the invoker-supplied target version, tarball URL, npm `dist.integrity` (sha512) and `dist.shasum` — captured via `npm view <package>@<version> version dist.tarball dist.integrity dist.shasum --json`.
- **Runtime target binding**: live validation hard-fails unless the installed CLI reports exactly the target version (`<cli> --version`). Patch application either uses an explicit frozen install path or records evidence that discovery detected exactly the target-version install.
- **Extraction manifest**: the native bundle is extracted/read into out-of-repo artifact storage (slot-defined path), with a `manifest.json` recording package identity, reported CLI version, install path, extraction command and tool versions, platform, extracted bundle path, and the extracted bundle's SHA-256. Extracted bundles and manifests never land inside a repository unless `.gitignore` is deliberately updated and reviewer+judge approve a repository-local artifact policy; the default is out-of-repo storage only.
- The baseline's frozen upstream identity field is `frozen_target_package`.

## 3.2 Inventory: anchor-drift scan

The inventory domain is the harness's seam/anchor registry (slot-defined file), one inventory item per anchor. A *seam* is a behavior-controlling site in the host's internals; an *anchor* is the port's recorded binding to a seam — the identifiers that locate it plus the documented reasoning for why it is the right site. Install discovery is a separate seam with its own binding, distinct from the behavior anchors this scan iterates. For each anchor, against the frozen extracted bundle:

- Inspect the real bundle semantically. Document the behavior the seam controls, why it is the correct seam, why plausible nearby candidates are wrong, and why the anchor is expected to be reasonably stable.
- Re-derive or re-confirm the minified identifiers recorded for the prior version; never assume they survive into the target version.
- Confirm the install-discovery seam still locates the target-version install; update only if the layout changed.
- Temporary scripts and searches are aids, not authority: the authority is documented reasoning tied to the real target, and acceptance evidence comes from the pinned artifact and live runtime behavior — never from synthetic fixtures, syntax-match counts, or sentinel insertion alone.

## 3.3 Bucket taxonomy

Precedence, first-match deterministic:

`removed_or_ambiguous_anchor > updated_anchor > unchanged_anchor > docs_evidence_only > manual_review`

- `removed_or_ambiguous_anchor`: the seam is gone or cannot be identified unambiguously in the target bundle.
- `updated_anchor`: the seam exists with changed identifiers/site; re-derived binding recorded.
- `unchanged_anchor`: identical binding verified against the target bundle.
- `docs_evidence_only`: no code binding affected; documentation/evidence update only.
- `manual_review`: fallback for missing or contradictory evidence.

**Hard-blocking buckets**: both `manual_review` and `removed_or_ambiguous_anchor` block the seal without explicit reviewer+judge approval, recorded in the generated plan per §1.5 (this shape uses no separate approvals or exception files; extending the git-fork shape's checksummed artifacts to this shape is a candidate hardening, not current contract).

Missing or ambiguous anchors fail closed; no threshold or ambiguity check is ever weakened to make the target pass.

## 3.4 Replay-set schema

Row fields, in order: `anchor_id`, `source_version`, `target_version`, `bucket`, `replay_action`, `mapping_type`, `target_paths`, `rationale`, `evidence_ref`. Sort: by `anchor_id`, then `target_path`.

## 3.5 Replay: semantic re-derivation

Replay is the re-derivation itself plus the side-repo changes it requires: updating the anchor registry, discovery seam, patch code, and tests to bind the target version. Work happens in place in the side repo's working tree on its tracked branch (the executed precedent); there is no replay worktree or branch, and the clean-state preflight of §1.10 still applies. If preflight finds the tracked branch's HEAD no longer equal to the frozen `SOURCE_HEAD_SHA`, that is source drift: handle per §1.9 (generate a fresh plan keyed to the new SHA) — never reset or rewrite the branch to reach the frozen point. Scope notes in the plan bound each file's purpose (e.g. "in scope only to verify and minimally adjust X — not an invitation to redesign Y"); edits outside a file's stated purpose are out-of-scope fixups requiring an exception row.

## 3.6 Validation and immutable e2e scope

- Side-repo validation (slot-defined commands) plus a pinned-target artifact-evidence check that ties test evidence to the frozen bundle and manifest.
- The patch-application step itself enforces the §3.1 runtime binding: run apply with the explicit frozen install path (e.g. `bun run apply --path <native-install-path>`, as the executed baseline row 07 did) or record evidence that discovery detected exactly the target-version install. Re-assert the CLI version immediately before live validation begins; stop on mismatch.
- The plan fixes the required live-scenario set for a release-gate PASS. Implementation may update the side repo's e2e docs but may not narrow that cycle's acceptance scope. No release-gate PASS may be claimed with an unapproved `BLOCKED` or omitted scenario.
- Behavioral oracles verify transform **effects** (content genuinely absent from the real payload, measured footprint change), never flag-based or recall-based proxies, per the e2e spec's disciplines.

## 3.7 Evidence retention

Live-run evidence is written to out-of-repo storage (slot-defined paths). No credentials, auth files, or live transcripts enter any repository artifact.

## 3.8 Release-gate ordering

- The side repo is committed before the parent submodule pin is advanced; the parent commit updates only the pin and any necessary parent spec/docs.
- Final verification runs in both repos: side-repo log/diff/status checks, parent `git diff --submodule=short`, and the spec-immutability check.
- The routine cycle ends there: local pin advance plus final verification. The pin-advance commit lands on the parent's current branch (the executed precedent names no working branch for this shape). Pushing the side repo and parent is a separate, owner-approved step — this shape has no proven publish ladder (unlike §2.9), and the executor must not invent one.

---

# Part 4: Per-Harness Bindings

Each supported harness binds the slots below before the routine path can run against it. The two harnesses with executed, proven cycles are bound here. **Do not improvise values for unbound harnesses** — binding a new harness is derivation work (the new-harness path in `../meta-loop-direction.md`), not a routine cycle.

## 4.1 Slot schema

| Slot | Meaning |
|---|---|
| Shape | Part 2 or Part 3 |
| Repos and roles | Harness repo/submodule, side repos, remotes |
| Upstream identity source | Where releases come from (tag namespace or npm package) |
| Allowlists | Runtime and docs path allowlists (git-fork) or scope/target file policy (closed-artifact) |
| Seam/anchor registry | Where the port's binding to host internals lives |
| Worktree/branch/tag naming | Deterministic per-cycle names (git-fork shape only) |
| Toolchain and bootstrap | Required tools; hydration detection + install command |
| Baseline row set | Canonical baseline rows with working directories and must-be-green designations |
| Canonical validation set | Post-replay validation commands with working directories |
| E2E procedure and required scenarios | Cited procedure doc(s) + fixed minimum scenario set |
| Credentials | Out-of-band provisioning variables (never committed) |
| Evidence paths | Where run evidence is captured |
| Explicit non-targets | Files/repos the cycle must not touch |

## 4.2 OpenCode (shape: git-fork)

- **Repos**: harness fork at `opencode/` (submodule; remotes: `origin` = Vibecodelicious fork, `upstream` = canonical repo — the upstream remote for §2.1's tag fetch; its refspec is heads-only). Plugin side repo `opencode_context_bonsai_plugin/` — no replay or code changes during a cycle; the only cycle commits it may receive are the install-gate artifacts named under Evidence paths. If it has no cycle commits, the §2.9 publish-ladder "push the port's submodule" action for this side repo is a no-op verified by clean status, not an upstream comparison (the side repo may be detached in the parent checkout).
- **Pre-existing dirty status paths** (§1.10 enumeration): in the parent repo, the `tweakcc_context_bonsai` submodule pin (` M tweakcc_context_bonsai` in `git status --short`) — dirty before any cycle, untouchable.
- **Upstream identity**: upstream release tags (`refs/tags/v<version>`), frozen per §2.1.
- **Allowlists**: runtime `packages/opencode/**`, `packages/plugin/**`; docs `.agents/plans/**`, `.opencode/context_bonsai/**`; state-only: metadata/state artifacts outside both.
- **Fork-owned wholesale files**: root `README.md` (signpost; classified `manual_review` per §2.3, wholesale-replaced on conflict per §2.5; content probe: `grep -q "Context Bonsai" README.md`).
- **Naming**: worktree `opencode/.agent_tmp/rebase-on-<tag>` where `<tag>` is the upstream tag name including its `v` prefix (e.g. `rebase-on-v1.15.7`); branch `replay/context-bonsai-on-opencode-<version>` and tag `bonsai/v1-on-opencode-<version>` use the bare version without `v` (e.g. `...-1.15.7`). Parent pin-advance working branch (§2.9 step 3): `pin-advance/opencode-<version>` — a fixed default this spec sets (no precedent named one; DEVELOPMENT.md requires only "non-`main`"). When advancing the parent pin, the parent checkout's `opencode/` submodule must move to the replay tip by detached commit or tag checkout, because the replay branch is already checked out in the isolated replay worktree.
- **Toolchain**: `bun`, `jq`, `sha256sum`. Bootstrap (worktree root): `test -d node_modules || bun install`. Script existence preflight: `jq -r '.scripts.typecheck' packages/opencode/package.json` and `packages/plugin/package.json` non-empty; `bun turbo run build --filter=opencode --dry-run` lists the build task.
- **Baseline rows** (in the worktree):
  - r01 (must-be-green), from `packages/opencode`: `bun test test/tool/registry.test.ts test/session/message-v2.test.ts test/session/session.test.ts`
  - r02, from `packages/opencode`: `test ! -f test/session/context-bonsai.test.ts && echo missing-as-expected || (echo unexpected-presence && false)` — the chain introduces this test; upstream must not have it.
  - r03, from `packages/opencode`: `bun typecheck`
  - r04, from `packages/plugin`: `bun typecheck`
  - r05, from worktree root: `bun turbo run build --filter=opencode`
- **Canonical validation set** (post-replay, in the worktree): r01's test command, plus `bun test test/session/context-bonsai.test.ts` (must now pass), `bun typecheck` from `packages/opencode`, `bun typecheck` from `packages/plugin`, `bun turbo run build --filter=opencode` from worktree root. Post-replay r01 must be no worse than baseline; net-new failures are hard-fail regressions.
- **E2E**: procedure `docs/context-bonsai-e2e-template.md` (the meta-plan's citation of `.agents/e2e-context-bonsai-opencode-integration.md` is obsolete — that file does not exist; this binding is the corrected citation). Required minimum: Protocol A (secret-prune oracle) and Protocol B (retrieve roundtrip). Rebased binary at `packages/opencode/dist/opencode-linux-x64/bin/opencode` (platform-equivalent), wired to `opencode_context_bonsai_plugin/` via the worktree's `.opencode/opencode.jsonc`: start from the pinned harness's committed copy (which carries no `"plugin"` key), then add a top-level key `"plugin": ["file://<parent-repo-absolute-path>/opencode_context_bonsai_plugin/src/index.ts"]`. This wiring is generated fresh each cycle, stays worktree-local and uncommitted, and must not be included in replay commits. Verify with `grep -A2 '"plugin"' .opencode/opencode.jsonc`. Install gate per §2.9 uses `docs/installation-e2e-template.md`.
- **Credentials**: `OPENCODE_PROVIDER`, `OPENCODE_MODEL`, `OPENCODE_API_KEY`, provisioned out of band, verified present with `test -n`, never persisted or logged.
- **Evidence paths**: runtime e2e under `opencode/.agent_tmp/e2e-on-<tag>/protocol-a/`, `.../protocol-b/` (worktree-local, uncommitted; `<tag>` includes the `v` prefix, e.g. `e2e-on-v1.15.7`). Pre-publish install-gate run records follow the install template's Result Recording: `opencode_context_bonsai_plugin/docs/install-e2e-results-<DATE>.md`, committed in that side repo (the Claude Code port's committed `docs/e2e-results-*.md` records are the precedent). Together with README fixes on an install-gate `FAIL` — which the template requires landing before re-run — these are the only cycle commits the side repo may receive. When any land, the parent working branch must also carry the side repo's submodule pin bump before §2.9 step 5, and that step's side-repo push is then a real push, not the no-op above.
- **Explicit non-targets**: this spec; the source branch in place; the parent's `.agents/plans/` tree during replay (except the cycle's own validation artifacts); `opencode_context_bonsai_plugin/` (except the install-gate artifacts named under Evidence paths); prior cycles' worktrees.

## 4.3 Claude Code (shape: closed npm artifact)

- **Repos**: side repo `tweakcc_context_bonsai/` (submodule). No harness fork exists.
- **Upstream identity**: npm package `@anthropic-ai/claude-code`, frozen per §3.1 (`npm view`, `claude --version` runtime binding, extraction manifest).
- **Seam/anchor registry**: `tweakcc_context_bonsai/patches/anchors.ts`; install-discovery seam `tweakcc_context_bonsai/patches/discovery.ts`.
- **Artifact storage**: `/tmp/cc-bonsai-artifacts/claude-code/<version>/native/` (extracted bundle + `manifest.json`); e2e evidence under `/tmp/cc-bonsai-e2e/`.
- **Extraction procedure**: tweakcc's `readContent` via `apply/tweakcc-api.ts`, run with bun against the native install at `~/.local/share/claude/versions/<version>` — `bun --eval "import { tweakccApi } from './apply/tweakcc-api'; const c = await tweakccApi.readContent({ path: '<native-install-path>', kind: 'native', version: '<version>' }); await Bun.write('/tmp/cc-bonsai-artifacts/claude-code/<version>/native/extracted.js', c);"` from `tweakcc_context_bonsai/` (procedure recorded in `docs/semantic-anchor-analysis-2.1.156.md`). The tweakcc version and this command land in the manifest per §3.1.
- **Credentials**: provisioned out of band per `tweakcc_context_bonsai/docs/e2e-protocol.md` Phase 0 (harness operator provisions; nothing written into commands, run records, or artifacts). Missing environmental preconditions make affected live scenarios `BLOCKED` under that doc's reason codes (`credentials-missing-in-harness`, `sprite-unavailable`, `native-runtime-missing`, …) — BLOCKED is per-scenario with the e2e spec's discipline 5 semantics, never a plan-wide preflight hard-fail, and any BLOCKED accepted at seal needs the reviewer+judge exception per gate 11.
- **Toolchain and bootstrap**: `bun`, `npm`, installed `claude` CLI at target version. From `tweakcc_context_bonsai/`: `bun install`.
- **Preflight** (from parent root): `git status --short`; `git -C tweakcc_context_bonsai status --short`; `git -C tweakcc_context_bonsai rev-parse HEAD`; the `npm view` freeze command; `claude --version | grep '<version>'`; spec-immutability check.
- **Side-repo validation** (from `tweakcc_context_bonsai/`): `bun test`; `bun run typecheck`; `bun run e2e/native-e2e.ts artifact-evidence --bundle <extracted.js> --manifest <manifest.json> --out /tmp/cc-bonsai-e2e/<version>-artifact-evidence.json`; `git status --short`.
- **Baseline rows** (pre-replay, from `tweakcc_context_bonsai/`, per the executed artifact `baseline-95c24228….json`): 01 `bun install`; 02 `bun test` (must-be-green); 03 `bun run typecheck` (must-be-green); 04 the artifact-evidence command above against the frozen target bundle. The executed precedent records post-replay and live-e2e result rows in the same baseline artifact file; follow that convention.
- **Live e2e** (from `tweakcc_context_bonsai/`): `claude --version | grep '<version>'`; `bun run apply --path <native-install-path>` (§3.6 runtime binding); `claude mcp list`; `bun run e2e/native-e2e.ts protocol-a-oracle --session <session-jsonl> --secret <secret> --out ...`; `bun run e2e/native-e2e.ts prune-guard-live <args>`; `bun run e2e/native-e2e.ts prune-effect --pre-session <pre> --session <session-jsonl> --from-uuid <from> --to-uuid <to> --out ...`. Harness argument shapes come from `native-e2e.ts` usage output.
- **Required e2e scenario set** (immutable per cycle, §3.6): E2E-00 through E2E-08 (clean install; contiguous prune success; ambiguity rejection; retrieve by anchor; gauge cadence; compatibility error path; persistence across resume; Protocol A secret-prune oracle; bug-shape prune guard) plus pinned-target artifact evidence. E2E-08 verifies a transform effect — archived content absent from the real payload plus a measured input-token footprint drop; it must not be degraded into a flag-based or recall-based oracle. Shared oracle reference: `docs/context-bonsai-e2e-template.md#protocol-a-secret-prune-oracle`; side-repo procedure doc: `tweakcc_context_bonsai/docs/e2e-protocol.md` (may be updated, never narrowed).
- **Final verification**: from `tweakcc_context_bonsai/`: `git log --oneline -5`, `git diff --name-status HEAD~1..HEAD`, `git status --short`; from parent root: `git status --short`, `git diff --submodule=short HEAD~1..HEAD`, spec-immutability check. Side-repo commit precedes parent pin advance (§3.8).
- **Explicit non-targets**: this spec; superseded prior cycle plans; `opencode/`; `docs/agent-specs/context-bonsai-e2e-spec.md`; extracted bundles or manifests inside any repository; any `~/.claude/**`, auth, credential, or live transcript files.

## 4.4 Unbound harnesses

`cline`, `codex`, `gemini-cli`, `kilo`, and `pi` have Context Bonsai ports but no executed forward-port cycle and no bound slot table. Running the routine path against them requires first emitting their bindings via the new-harness/derivation path. Their per-harness behavior specs live in this directory; those documents do not substitute for a slot table.
