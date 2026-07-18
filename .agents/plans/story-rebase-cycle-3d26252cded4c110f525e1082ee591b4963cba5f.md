# Story: Rebase Cycle 3d26252cded4c110f525e1082ee591b4963cba5f onto OpenCode v1.18.3

## Goal

Replay the Context Bonsai patch chain currently tipped at `3d26252cded4c110f525e1082ee591b4963cba5f` on `refs/heads/replay/context-bonsai-on-opencode-1.17.13` of the OpenCode fork onto the frozen upstream release tag `v1.18.3` (`127bdb30784d508cc556c71a0f32b508a3061517`). Produce a reviewable target branch whose `HEAD` is based on `UPSTREAM_HEAD_SHA` and contains only the approved replay set (the two integration patches and the fork-only signpost README), then tag the rebased tip `bonsai/v1-on-opencode-1.18.3` per `DEVELOPMENT.md` §"Carrying Patches on Upstream".

After the cycle is sealed, the required final user outcome is an updated, working `opencode_dev` whose function launches `/home/basil/projects/opencode_context_management/opencode/packages/opencode/dist/opencode-linux-x64/bin/opencode` with `OPENCODE_DISABLE_PRUNE=true`. Therefore the plan includes a local-landing phase that updates the developer installation at `/home/basil/projects/opencode_context_management/opencode` to the rebased, built binary and verifies the invoked version and Context Bonsai behavior.

## Non-Goal

This plan defines, validates, and records the rebase work; it does not perform the actual replay/rewrite or local installation edits during planning. No commits are created in the OpenCode fork or the local installation until the implementor reaches the Replay and Local Landing phases below.

## Execution Outcome Statement

After the implementor completes this plan:

1. The target branch `HEAD` in the isolated worktree must be based on `UPSTREAM_HEAD_SHA` (`127bdb30784d508cc556c71a0f32b508a3061517`) and contain exactly the three replayed commits from the approved replay set in the listed topological order.
2. No other commits, merge commits, generated-SDK diffs, or local planning artifacts may be present in `UPSTREAM_HEAD_SHA..HEAD`.
3. The local installation at `/home/basil/projects/opencode_context_management/opencode` must be checked out to the rebased tag, built, and wired to the Context Bonsai plugin so that `opencode_dev` (the shell function in `~/.bashrc`) launches the binary with `OPENCODE_DISABLE_PRUNE=true` and reports version `v1.18.3`.
4. Context Bonsai behavior must be verified on that binary by a minimal smoke (tool registration lists `context-bonsai-prune` and `context-bonsai-retrieve`, or a protocol B roundtrip).

## Frozen Inputs

- `UPSTREAM_REF`: `refs/tags/v1.18.3`
- `UPSTREAM_HEAD_SHA`: `127bdb30784d508cc556c71a0f32b508a3061517`
- `SOURCE_REF`: `refs/heads/replay/context-bonsai-on-opencode-1.17.13`
- `SOURCE_HEAD_SHA`: `3d26252cded4c110f525e1082ee591b4963cba5f`
- `BASE_SHA`: `6697cf3fd81d44fc8c3f72d32edb0e2549d24003` (`git merge-base UPSTREAM_HEAD_SHA SOURCE_HEAD_SHA`)
- `TARGET_WORKTREE`: `/home/basil/projects/context-bonsai-agents/opencode/.agent_tmp/rebase-on-v1.18.3`
- `TARGET_BRANCH`: `replay/context-bonsai-on-opencode-1.18.3`
- `TARGET_TAG_AT_TIP`: `bonsai/v1-on-opencode-1.18.3`
- `PARENT_PIN_BRANCH`: `pin-advance/opencode-1.18.3`
- `LOCAL_INSTALL_DIR`: `/home/basil/projects/opencode_context_management/opencode`
- `LOCAL_PLUGIN_DIR`: `/home/basil/projects/opencode_context_management/opencode_context_bonsai_plugin`
- `OPENCODE_DEV_BINARY`: `/home/basil/projects/opencode_context_management/opencode/packages/opencode/dist/opencode-linux-x64/bin/opencode`
- `VALIDATION_MODE`: `committed-final`
- Range scope: `UPSTREAM_HEAD_SHA..SOURCE_HEAD_SHA` (default; no author-filter override)

All commands in this plan reference the frozen SHAs above. The implementor must not substitute moving refs.

## Allowlists

From forward-port-spec §4.2, no overrides for this cycle:

- Runtime allowlist: `packages/opencode/**`, `packages/plugin/**`
- Docs allowlist: `.agents/plans/**`, `.opencode/context_bonsai/**`
- State-only: metadata/state artifacts outside the above

The fork-only root `README.md` falls outside the docs allowlist by design; it is classified `manual_review` and approved by the artifact at `.agents/plans/validation/manual-review-approvals-3d26252cded4c110f525e1082ee591b4963cba5f.json`. No allowlist override is requested.

## Pre-Existing Dirty Status Paths (Untouchable)

The invoker-enumerated pre-existing non-target dirt in the parent repo is:

- `opencode.json`
- `tweakcc_context_bonsai` submodule pin
- `.agents/pilot/relaunch-run6.sh`
- `blog-1-context-bonsai.md`
- `blog-2-maintenance.md`

The cycle must not stage, commit, modify, delete, or use any of these paths as cycle evidence. The `.agents/pilot/opencode-v1.18.3-intent-log.md` is cycle state (seeded by the invoker), not pre-existing dirt; it is updated per §1.18.

## User Model

- OpenCode maintainers reviewing a minimal carried-patch series above a tagged release.
- Context Bonsai users on OpenCode relying on prune/retrieve continuity through plugin tools.
- Operators running the developer-installation `opencode_dev` and expecting it to track the latest rebased binary.
- Reviewers and judges auditing source-commit provenance, replay equivalence, and the local installation wiring.

## Ambiguities Resolved

- The v1.17.13 release commit (`10c894bde`) is patch-equivalent to upstream (`git cherry -v` marks `-`) and is dropped, not replayed.
- Literal `cherry-pick` is preferred for the two runtime rows and the README row; `re-implement` is allowed only if cherry-pick fails with conflicts that cannot be resolved inside the row's `target_paths`.
- The README row is treated as `manual_review` with explicit approval rather than as an allowlist override.
- The local installation is updated from the submodule worktree via a local git fetch (no push), not by copying the built binary artifact.

## Context References

### Relevant Codebase Files

- `packages/opencode/src/session/message-v2.ts` — runtime target of `00ebeb266...`
- `packages/opencode/src/tool/registry.ts` — runtime target of `9187ca39f...`
- `packages/plugin/src/tool.ts` — co-target of `9187ca39f...`
- `packages/opencode/test/session/message-v2.test.ts` — regression coverage
- `packages/opencode/test/session/context-bonsai.test.ts` — bonsai-specific regression coverage introduced by `00ebeb266...`
- `packages/opencode/test/tool/registry.test.ts` — tool registry regression coverage
- `README.md` — fork-only signpost, target of `3d26252cd...`

### Relevant Documentation

- `docs/agent-specs/forward-port-spec.md` — authoritative cycle contract; this plan binds §4.2 (OpenCode git-fork shape).
- `docs/context-bonsai-e2e-template.md` — shared E2E template for Context Bonsai integrations.
- `docs/opencode-e2e-runbook.md` — OpenCode-specific command bindings for Protocols A/B and the install gate.
- `docs/installation-e2e-template.md` — pre-publish install gate discipline.
- `DEVELOPMENT.md` §"Carrying Patches on Upstream" — chain, tags, and per-cycle steps.
- `.llm-conductor/ORCHESTRATOR_AGENT.md` — orchestrator execution rules.

### Validation Artifact References

- Replay set: `.agents/plans/validation/replay-set-3d26252cded4c110f525e1082ee591b4963cba5f.json` (schema: `source_sha`, `bucket`, `replay_action`, `mapping_type`, `target_paths`, `rationale`, `evidence_ref`; row sort: topological order then full `source_sha`)
- Replay-set checksum: SHA-256 of `jq -c < <path>` output is `00e80b73639c2d9152fdf2a7340f47316a407a2d2a5f42137027551c4b010fed`. Implementor must re-verify before replay starts.
- Manual-review approvals: `.agents/plans/validation/manual-review-approvals-3d26252cded4c110f525e1082ee591b4963cba5f.json` (schema: `source_sha`, `approved_action`, `approval_refs`, `resolution_state`)
- Manual-review approvals checksum: SHA-256 of `jq -c < <path>` output is `568ed1978a5a0f046c972ea045d885704f611a0a15e18094159e6d68877c14dd`.
- Baseline-capture artifact (created by implementor in Baseline phase): `.agents/plans/validation/baseline-3d26252cded4c110f525e1082ee591b4963cba5f.json`
- Exception ledger (created by implementor; empty by default): `.agents/plans/validation/exceptions-3d26252cded4c110f525e1082ee591b4963cba5f.json`

## Source Commit Classification

| source_sha | subject | bucket | replay_action | mapping_type | target_paths | rationale |
| --- | --- | --- | --- | --- | --- | --- |
| `10c894bdeef3618f5666fb506ef7f9491bb964d8` | release: v1.17.13 | `already_in_upstream` | `drop` | `drop` | (none) | Upstream release version-bump commit. `git cherry -v 127bdb30784d508cc556c71a0f32b508a3061517 3d26252cded4c110f525e1082ee591b4963cba5f` marks `-`; not replayed because the target already carries the equivalent release commit. |
| `00ebeb266b9cfcd19cff9891d49690c3b427b49f` | Persist Context Bonsai message metadata through parsing and storage | `required_runtime` | `cherry-pick` | `1:1` | `packages/opencode/src/session/message-v2.ts`, `packages/opencode/test/session/context-bonsai.test.ts`, `packages/opencode/test/session/message-v2.test.ts`, `packages/schema/src/v1/session.ts` | Touches the runtime allowlist and the shared schema package to add `metadata` to the `User` and `Assistant` message schemas. `git cherry -v` marks `+`. Required for prune/retrieve continuity. |
| `9187ca39f25b71e747080763a539c376f06b2bcb` | Expose safe message-metadata updates to plugin tools | `required_runtime` | `cherry-pick` | `1:1` | `packages/opencode/src/tool/registry.ts`, `packages/opencode/test/tool/registry.test.ts`, `packages/plugin/src/tool.ts` | All paths inside runtime allowlists (`packages/opencode/**` and `packages/plugin/**`). `git cherry -v` marks `+`. Exposes the plugin-tool metadata-update API the side-repo plugin depends on. |
| `3d26252cded4c110f525e1082ee591b4963cba5f` | docs(README): replace upstream README with Context Bonsai signpost | `manual_review` | `cherry-pick` | `1:1` | `README.md` | Root `README.md` is outside both default allowlists. Per forward-port-spec §2.3 / §4.2 fork-owned wholesale files are classified `manual_review` and resolved through the approvals artifact. |

Merge-commit scan: `git log --merges 127bdb30784d508cc556c71a0f32b508a3061517..3d26252cded4c110f525e1082ee591b4963cba5f` is empty for this cycle; no merge rows required.

## Reviewer-Simplicity Evaluation

For each row, the spec requires comparing `cherry-pick`, `cherry-pick + minor fixups`, and `re-implement` and preferring the easiest to review.

- `00ebeb266...` and `9187ca39f...` (runtime integration patches):
  - `cherry-pick`: preferred. The patches touch narrow, well-defined seams (`message-v2.ts`, `registry.ts`, `tool.ts`).
  - `cherry-pick + minor fixups`: acceptable fallback for line-level conflicts inside the allowed target paths.
  - `re-implement`: not preferred unless cherry-pick conflicts require out-of-scope changes. If forced, a behavioral-contract table must be added per §2.5.
- `3d26252cd...` (README signpost):
  - `cherry-pick`: preferred. Any conflict on `README.md` is resolved by wholesale replacement with the source commit's tree contents, then `git cherry-pick --continue`.

## Re-Implementation Behavioral Contract

Not applicable for this cycle (all rows are `cherry-pick`). If cherry-pick fails for a runtime row and the implementor requests `re-implement`, this section must be populated with the spec's required fields before execution proceeds.

## Validation Mode

- Mode: `committed-final`.
- The implementor commits the three replayed commits in the target worktree and creates the tag.
- Final verification uses `git log` and `git diff` against `UPSTREAM_HEAD_SHA..HEAD`.
- Generated SDK/API artifact diffs must be left uncommitted and excluded from the replay commits.

## Acceptance Criteria

- [ ] `TARGET_WORKTREE` is created from `UPSTREAM_HEAD_SHA` with no overlap and clean `git status`.
- [ ] `TARGET_BRANCH` (`replay/context-bonsai-on-opencode-1.18.3`) is based on `UPSTREAM_HEAD_SHA`; `git merge-base UPSTREAM_HEAD_SHA HEAD` returns `UPSTREAM_HEAD_SHA`.
- [ ] `UPSTREAM_HEAD_SHA..HEAD` contains exactly the three replayed commits matching the replay-set rows, with `cherry picked from commit <source_sha>` provenance trailers.
- [ ] Replay-set checksum is verified before replay and unchanged at seal.
- [ ] Baseline artifact is complete before replay; all required rows have non-null `provenance_ref`.
- [ ] Exception ledger exists (empty or with explicit approved rows); no unresolved exceptions at seal.
- [ ] No unresolved `manual_review` rows; the README row's approval artifact is present and `resolution_state=approved`.
- [ ] Canonical validation set passes from the worktree and is no worse than baseline:
  - From `packages/opencode`: `bun test test/tool/registry.test.ts test/session/message-v2.test.ts test/session/session.test.ts`
  - From `packages/opencode`: `bun test test/session/context-bonsai.test.ts`
  - From `packages/opencode`: `bun typecheck`
  - From `packages/plugin`: `bun typecheck`
  - From worktree root: `OPENCODE_VERSION=1.18.3 bun turbo run build --filter=opencode`
- [ ] Replay diff excludes generated SDK/API artifacts.
- [ ] `TARGET_TAG_AT_TIP` (`bonsai/v1-on-opencode-1.18.3`) is created at the rebased tip and pushable to `origin`.
- [ ] E2E behavioral gate passes for BOTH Protocol A (Secret Prune Oracle) AND Protocol B (Retrieve Roundtrip), or an explicit reviewer+judge-approved exception is recorded.
- [ ] `docs/agent-specs/forward-port-spec.md` is unmodified at seal (`git diff --name-only -- docs/agent-specs/forward-port-spec.md` is empty).
- [ ] Local installation `LOCAL_INSTALL_DIR` is updated to the rebased tag (`bonsai/v1-on-opencode-1.18.3`) via a local-only fetch from the submodule repository; no push is performed.
- [ ] `OPENCODE_DEV_BINARY` is built and exists.
- [ ] `opencode_dev` (shell function in `~/.bashrc`) launches `OPENCODE_DEV_BINARY` with `OPENCODE_DISABLE_PRUNE=true` and no path change is required.
- [ ] The invoked binary reports version `v1.18.3`.
- [ ] Context Bonsai behavior is verified on the invoked binary (tool registration lists `context-bonsai-prune` and `context-bonsai-retrieve`, or a protocol B roundtrip produces a restored archive).

## Implementation Tasks

### Phase 0: Credentials and Provider (out-of-band; required before Phase 6)

The E2E gate drives a real model through the rebased binary using the Context Bonsai plugin. Credentials and provider/model must be in place before the developer sub-agent is dispatched and must NEVER be committed.

- Required: `OPENCODE_PROVIDER`, `OPENCODE_MODEL`, `OPENCODE_API_KEY` verified with `test -n`.
- The orchestrator records the provisioning decision in the developer dispatch prompt.

### Phase 1: Bootstrap and Frozen-SHA Capture

1. Toolchain preflight:
   - `command -v bun`, `bun --version`, `command -v jq`, `command -v sha256sum` succeed.
2. From the opencode submodule (`/home/basil/projects/context-bonsai-agents/opencode`), verify clean state:
   - `git status --short` returns empty or only paths enumerated in Pre-Existing Dirty Status Paths.
   - `git rev-parse refs/heads/replay/context-bonsai-on-opencode-1.17.13` equals `3d26252cded4c110f525e1082ee591b4963cba5f`.
   - `git rev-parse refs/tags/v1.18.3` equals `127bdb30784d508cc556c71a0f32b508a3061517`.
3. Re-verify replay-set checksum and manual-review approvals checksum.
4. Verify turbo build task and required scripts exist.
5. Record any pre-existing worktrees or branches as untouchable; do not delete them.

### Phase 2: Isolated Worktree Creation

6. Create the rebase worktree from `UPSTREAM_HEAD_SHA`:
   - `git -C /home/basil/projects/context-bonsai-agents/opencode worktree add -B replay/context-bonsai-on-opencode-1.18.3 /home/basil/projects/context-bonsai-agents/opencode/.agent_tmp/rebase-on-v1.18.3 127bdb30784d508cc556c71a0f32b508a3061517`
7. Confirm `HEAD` matches `UPSTREAM_HEAD_SHA`.
8. Hydrate dependencies from worktree root: `test -d node_modules || bun install`.

### Phase 3: Baseline-Capture (no replay yet)

9. Create `.agents/plans/validation/baseline-3d26252cded4c110f525e1082ee591b4963cba5f.json` with the required schema and rows:
    - `r01` (must-be-green): `bun test test/tool/registry.test.ts test/session/message-v2.test.ts test/session/session.test.ts` from `packages/opencode`.
    - `r02`: existence probe `test ! -f test/session/context-bonsai.test.ts && echo missing-as-expected || (echo unexpected-presence && false)` from `packages/opencode`. Record provenance ref from `packages/opencode`: `git ls-files test/session/context-bonsai.test.ts`.
    - `r03`: `bun typecheck` from `packages/opencode`.
    - `r04`: `bun typecheck` from `packages/plugin`.
    - `r05`: `OPENCODE_VERSION=1.18.3 bun turbo run build --filter=opencode` from worktree root.

### Phase 4: Replay (cherry-pick, in topological order)

10. Cherry-pick `00ebeb266b9cfcd19cff9891d49690c3b427b49f` with `-x`; resolve conflicts inside `packages/opencode/**`.
11. Cherry-pick `9187ca39f25b71e747080763a539c376f06b2bcb` with `-x`; resolve conflicts inside `packages/opencode/**` and `packages/plugin/**`.
12. Cherry-pick `3d26252cded4c110f525e1082ee591b4963cba5f` with `-x`.
    - On conflict on `README.md`, force wholesale replacement: `git show 3d26252cded4c110f525e1082ee591b4963cba5f:README.md > README.md && git add README.md && git cherry-pick --continue`.
    - Verify: `diff <(git show 3d26252cded4c110f525e1082ee591b4963cba5f:README.md) README.md` is empty and `grep -q "Context Bonsai" README.md`.
13. Verify provenance trailers:
    - `test "$(git log --format='%b' 127bdb30784d508cc556c71a0f32b508a3061517..HEAD | grep -cE '^\(cherry picked from commit [0-9a-f]{40}\)$')" = "3"`

### Phase 5: Post-Replay Validation

14. Run the canonical validation set from the worktree.
15. Baseline-delta gate: post-replay `r01` must be no worse than baseline `r01`.
16. Scope check: `git diff --name-status 127bdb30784d508cc556c71a0f32b508a3061517..HEAD` must list only paths in the union of replay-set `target_paths`.
17. Generated-artifact exclusion: `git diff --name-status 127bdb30784d508cc556c71a0f32b508a3061517..HEAD | grep -E '(\.d\.ts$|/generated/|/__generated__/|openapi|\.gen\.|/dist/)' | wc -l` must return `0`.

### Phase 6: Tag, Final Verification, and Parent Pin-Advance Branch

18. Create the rebase-point tag at the worktree tip:
    - `git tag bonsai/v1-on-opencode-1.18.3 HEAD`
19. Pushability dry-run (no actual push):
    - `git push --dry-run origin refs/tags/bonsai/v1-on-opencode-1.18.3` exits 0.
    - `git push --dry-run origin replay/context-bonsai-on-opencode-1.18.3` exits 0.
20. Final verification (record in completion report):
    - `git merge-base 127bdb30784d508cc556c71a0f32b508a3061517 HEAD` returns `127bdb30784d508cc556c71a0f32b508a3061517`.
    - `git rev-list --count 127bdb30784d508cc556c71a0f32b508a3061517..HEAD` returns `3`.
    - `git log --format='%H %s' 127bdb30784d508cc556c71a0f32b508a3061517..HEAD` lists exactly the three replayed commits with subjects matching the replay set.
    - Provenance trailer count equals `3`.
    - `git diff --name-status 127bdb30784d508cc556c71a0f32b508a3061517..HEAD` lists only paths in the union of replay-set `target_paths`.
    - Generated-artifact exclusion count is `0`.
21. In the parent repo, create the pin-advance branch from the current `HEAD`:
    - `git checkout -b pin-advance/opencode-1.18.3` (or `git switch -c pin-advance/opencode-1.18.3`)
    - Update the `opencode` submodule pointer to the rebased tip commit SHA (the commit at `HEAD` of the worktree, not the tag object).
    - Commit the submodule pin advance with message: `cadence: advance opencode submodule to bonsai/v1-on-opencode-1.18.3`.
    - Do not push the parent branch.

### Phase 7: E2E Behavioral Gate and Pre-Publish Install Gate

22. Wire the rebased binary to the plugin:
    - Built binary: `packages/opencode/dist/opencode-linux-x64/bin/opencode` (worktree).
    - Plugin: `/home/basil/projects/context-bonsai-agents/opencode_context_bonsai_plugin/` (parent submodule).
    - Add the top-level `"plugin"` key to `.opencode/opencode.jsonc` in the worktree, pointing to `file:///home/basil/projects/context-bonsai-agents/opencode_context_bonsai_plugin/src/index.ts`. The file is JSONC; preserve the existing comments. A safe way is to use a JSONC-aware parser (e.g., `node -e` with `jsonc-parser` if available) or, because the file is small, replace the final line `}` with `,\n  "plugin": [\n    "file:///home/basil/projects/context-bonsai-agents/opencode_context_bonsai_plugin/src/index.ts"\n  ]\n}`. Do not commit this file; it is worktree-local.
    - Verify wiring: `grep -A2 '"plugin"' .opencode/opencode.jsonc` shows the plugin entry.
23. Set provider env vars from Phase 0 in the shell that will run the E2E procedure. Do not export them to any file.
24. Run Protocol A (Secret Prune Oracle) from `docs/opencode-e2e-runbook.md` under `.agent_tmp/e2e-on-v1.18.3/protocol-a/`.
25. Run Protocol B (Retrieve Roundtrip) from `docs/opencode-e2e-runbook.md` under `.agent_tmp/e2e-on-v1.18.3/protocol-b/`.
26. If either protocol fails, do not seal. Fix the regression or escalate.
27. Run the pre-publish install gate from `docs/opencode-e2e-runbook.md` Part 2 / `docs/installation-e2e-template.md` in pre-publish mode against the pin-advanced pair. Record the result as `PASS`, `FAIL`, or `BLOCKED`. If `FAIL` or `BLOCKED`, do not seal; fix the README or environmental precondition and re-run.
28. After the E2E and install gates complete, restore the worktree-local `.opencode/opencode.jsonc` to its original state: `git checkout -- .opencode/opencode.jsonc`.

### Phase 8: Cleanup, Local `opencode_dev` Installation, and Seal

29. Remove the cycle's replay worktree after its branch and tag are recorded:
    - `git -C /home/basil/projects/context-bonsai-agents/opencode worktree remove --force /home/basil/projects/context-bonsai-agents/opencode/.agent_tmp/rebase-on-v1.18.3`
30. From `LOCAL_INSTALL_DIR` (`/home/basil/projects/opencode_context_management/opencode`), add a local remote to the actual submodule gitdir if needed:
    - `git remote add local-cb /home/basil/projects/context-bonsai-agents/.git/modules/opencode` (idempotent; ignore if it already exists)
    - `git fetch local-cb refs/tags/bonsai/v1-on-opencode-1.18.3:refs/tags/bonsai/v1-on-opencode-1.18.3`
    - `git checkout bonsai/v1-on-opencode-1.18.3` (detached HEAD is acceptable)
    - If the local installation has uncommitted pre-existing changes that would be overwritten, record them in the exception ledger with a decision citation before discarding. Do not silently lose user work.
31. Ensure the plugin wiring in `LOCAL_INSTALL_DIR/.opencode/opencode.jsonc` points to the resolved `LOCAL_PLUGIN_DIR` path (`/home/basil/projects/opencode_context_management/opencode_context_bonsai_plugin/src/index.ts`). If `LOCAL_PLUGIN_DIR` is a symlink, resolve it (`readlink -f`) before writing the path. Update the `"plugin"` entry using a JSONC-safe method. Do not commit this file.
32. If `LOCAL_PLUGIN_DIR` is a separate clone (not a symlink), update it to the parent submodule pin commit (`576f21dd3794c512bfe61d0c41abc90746173fa4`) via a local fetch from `/home/basil/projects/context-bonsai-agents/opencode_context_bonsai_plugin/.git`. If it is a symlink, no separate update is needed.
33. Hydrate and build in `LOCAL_INSTALL_DIR`:
    - `test -d node_modules || bun install`
    - `OPENCODE_VERSION=1.18.3 bun turbo run build --filter=opencode`
34. Verify the binary exists and is executable:
    - `test -x /home/basil/projects/opencode_context_management/opencode/packages/opencode/dist/opencode-linux-x64/bin/opencode`
35. Verify the shell function `opencode_dev` in `~/.bashrc` still launches `OPENCODE_DEV_BINARY` with `OPENCODE_DISABLE_PRUNE=true`. If the binary path is unchanged, no edit is needed. If a different path is required, update the function and record the change.
36. Verify the invoked binary version:
    - `OPENCODE_DISABLE_PRUNE=true /home/basil/projects/opencode_context_management/opencode/packages/opencode/dist/opencode-linux-x64/bin/opencode --version` outputs a string containing `1.18.3`.
37. Verify Context Bonsai behavior on the invoked binary with a minimal smoke (no credentials required for tool registration):
    - `OPENCODE_DISABLE_PRUNE=true /home/basil/projects/opencode_context_management/opencode/packages/opencode/dist/opencode-linux-x64/bin/opencode run "List the names of all tools available to you, one per line, then stop." --print-logs --log-level DEBUG 2>/tmp/opencode-dev-tool-list.log | tee /tmp/opencode-dev-tool-list.txt`
    - `grep -c 'context-bonsai-prune' /tmp/opencode-dev-tool-list.txt` must be at least `1`.
    - `grep -c 'context-bonsai-retrieve' /tmp/opencode-dev-tool-list.txt` must be at least `1`.
    - Alternatively, run the full Protocol B roundtrip from the local installation directory and record the result.
38. Seal: once all prior gates and the local verification pass, record the cycle as sealed and perform §1.16 routine maintenance.

## Testing Strategy

- Cherry-pick provenance proves replay equivalence; do not rely on source-SHA equality.
- Patch-id fallback (`git patch-id`) may be used if conflict resolution requires line-level edits.
- The existing chain carries the regression tests (`context-bonsai.test.ts`, `message-v2.test.ts`, `registry.test.ts`); no new tests are required for this cycle.
- Build evidence (`OPENCODE_VERSION=1.18.3 bun turbo run build --filter=opencode`) must produce a runnable binary for both the worktree E2E gate and the local installation update.
- The local installation smoke confirms the same binary path the user invokes via `opencode_dev` works end-to-end.

## Validation Commands

All commands below state the directory they run from. `WORKTREE` refers to `/home/basil/projects/context-bonsai-agents/opencode/.agent_tmp/rebase-on-v1.18.3`. `PARENT` refers to `/home/basil/projects/context-bonsai-agents`. `OC` refers to `/home/basil/projects/context-bonsai-agents/opencode`. `LOCAL` refers to `/home/basil/projects/opencode_context_management/opencode`.

### Frozen-SHA verification

- From `OC`: `git rev-parse refs/heads/replay/context-bonsai-on-opencode-1.17.13` -> `3d26252cded4c110f525e1082ee591b4963cba5f`
- From `OC`: `git rev-parse refs/tags/v1.18.3` -> `127bdb30784d508cc556c71a0f32b508a3061517`
- From `OC`: `git merge-base 127bdb30784d508cc556c71a0f32b508a3061517 3d26252cded4c110f525e1082ee591b4963cba5f` -> `6697cf3fd81d44fc8c3f72d32edb0e2549d24003`
- From `PARENT`: `jq -c < .agents/plans/validation/replay-set-3d26252cded4c110f525e1082ee591b4963cba5f.json | sha256sum | cut -d' ' -f1` -> `00e80b73639c2d9152fdf2a7340f47316a407a2d2a5f42137027551c4b010fed`
- From `PARENT`: `jq -c < .agents/plans/validation/manual-review-approvals-3d26252cded4c110f525e1082ee591b4963cba5f.json | sha256sum | cut -d' ' -f1` -> `568ed1978a5a0f046c972ea045d885704f611a0a15e18094159e6d68877c14dd`

### Inventory (deterministic; from `OC`)

- `git log --topo-order --reverse --format='%H|%P|%s' 127bdb30784d508cc556c71a0f32b508a3061517..3d26252cded4c110f525e1082ee591b4963cba5f`
- `git log --name-status --find-renames --format='%H|%s' 127bdb30784d508cc556c71a0f32b508a3061517..3d26252cded4c110f525e1082ee591b4963cba5f`
- `git cherry -v 127bdb30784d508cc556c71a0f32b508a3061517 3d26252cded4c110f525e1082ee591b4963cba5f`
- `git log --merges 127bdb30784d508cc556c71a0f32b508a3061517..3d26252cded4c110f525e1082ee591b4963cba5f` (must be empty)

### Bootstrap (from `WORKTREE`)

- `test -d node_modules || bun install` (from worktree root)

### Canonical validation set (from `WORKTREE` after replay)

- From `packages/opencode`: `bun test test/tool/registry.test.ts test/session/message-v2.test.ts test/session/session.test.ts`
- From `packages/opencode`: `bun test test/session/context-bonsai.test.ts`
- From `packages/opencode`: `bun typecheck`
- From `packages/plugin`: `bun typecheck`
- From worktree root: `OPENCODE_VERSION=1.18.3 bun turbo run build --filter=opencode`

### Final verification (from `WORKTREE`)

- `git merge-base 127bdb30784d508cc556c71a0f32b508a3061517 HEAD` -> `127bdb30784d508cc556c71a0f32b508a3061517`
- `git rev-list --count 127bdb30784d508cc556c71a0f32b508a3061517..HEAD` -> `3`
- `git log --format='%H %s' 127bdb30784d508cc556c71a0f32b508a3061517..HEAD` lists the three replayed commits with matching subjects
- `test "$(git log --format='%b' 127bdb30784d508cc556c71a0f32b508a3061517..HEAD | grep -cE '^\(cherry picked from commit [0-9a-f]{40}\)$')" = "3"`
- `git diff --name-status 127bdb30784d508cc556c71a0f32b508a3061517..HEAD` lists only paths in the union of replay-set `target_paths`
- `git diff --name-status 127bdb30784d508cc556c71a0f32b508a3061517..HEAD | grep -E '(\.d\.ts$|/generated/|/__generated__/|openapi|\.gen\.|/dist/)' | wc -l` -> `0`
- `git push --dry-run origin refs/tags/bonsai/v1-on-opencode-1.18.3` exits 0
- `git push --dry-run origin replay/context-bonsai-on-opencode-1.18.3` exits 0

### Local installation verification (from `LOCAL`)

- `git rev-parse HEAD` equals the rebased tip commit (same as worktree `HEAD` after tag).
- `test -x packages/opencode/dist/opencode-linux-x64/bin/opencode`
- `OPENCODE_DISABLE_PRUNE=true packages/opencode/dist/opencode-linux-x64/bin/opencode --version` contains `1.18.3`.
- `OPENCODE_DISABLE_PRUNE=true packages/opencode/dist/opencode-linux-x64/bin/opencode run "List the names of all tools available to you, one per line, then stop." --print-logs --log-level DEBUG 2>/tmp/opencode-dev-tool-list.log | tee /tmp/opencode-dev-tool-list.txt` then `grep -c 'context-bonsai-prune' /tmp/opencode-dev-tool-list.txt` >= 1 and `grep -c 'context-bonsai-retrieve' /tmp/opencode-dev-tool-list.txt` >= 1.

### Spec immutability (from `PARENT`)

- `test -f docs/agent-specs/forward-port-spec.md`
- `git diff --name-only -- docs/agent-specs/forward-port-spec.md` is empty

## E2E Gate

- Authoritative procedure: `docs/context-bonsai-e2e-template.md` (shared in-repo template).
- OpenCode command bindings: `docs/opencode-e2e-runbook.md`.
- Required protocols for this cycle: Protocol A (Secret Prune Oracle) AND Protocol B (Retrieve Roundtrip). Both must produce pass evidence.
- The procedures are executed against the binary produced by `OPENCODE_VERSION=1.18.3 bun turbo run build --filter=opencode` in the worktree.
- Plugin wiring: via `.opencode/opencode.jsonc` in the worktree, pointing to the parent submodule `opencode_context_bonsai_plugin`.
- Provider/model: per Phase 0.
- Pass evidence (transcripts, exports, exit codes) is recorded under `.agent_tmp/e2e-on-v1.18.3/protocol-a/` and `.agent_tmp/e2e-on-v1.18.3/protocol-b/` in the worktree (uncommitted).
- Seal is blocked until both protocols produce pass evidence or an explicit reviewer+judge-approved exception is recorded.

## Worktree Artifact Check

- Checked At: `2026-07-18` (planner)
- Planned Target Files (parent repo writes by planner):
  - `.agents/plans/story-rebase-cycle-3d26252cded4c110f525e1082ee591b4963cba5f.md` (this file)
  - `.agents/plans/validation/replay-set-3d26252cded4c110f525e1082ee591b4963cba5f.json`
  - `.agents/plans/validation/manual-review-approvals-3d26252cded4c110f525e1082ee591b4963cba5f.json`
  - `.agents/plans/validation/exceptions-3d26252cded4c110f525e1082ee591b4963cba5f.json`
- Planned Target Files (worktree writes by implementor):
  - `.agents/plans/validation/baseline-3d26252cded4c110f525e1082ee591b4963cba5f.json` (parent repo)
  - `.agents/plans/validation/exceptions-3d26252cded4c110f525e1082ee591b4963cba5f.json` (parent repo, updated if needed)
  - inside worktree: `packages/opencode/src/session/message-v2.ts`, `packages/opencode/src/tool/registry.ts`, `packages/plugin/src/tool.ts`, `packages/opencode/test/session/message-v2.test.ts`, `packages/opencode/test/session/context-bonsai.test.ts`, `packages/opencode/test/tool/registry.test.ts`, `README.md` (replay targets, not direct edits)
  - inside worktree: `.opencode/opencode.jsonc` (worktree-local plugin wiring, uncommitted)
  - inside worktree: `.agent_tmp/e2e-on-v1.18.3/` (uncommitted evidence)
  - inside worktree: `replay/context-bonsai-on-opencode-1.18.3` branch and `bonsai/v1-on-opencode-1.18.3` tag
- Overlaps Found (parent repo): none; `.agents/plans/` paths are new files.
- Overlaps Found (opencode worktree): `TARGET_WORKTREE` path does not currently exist; `replay/context-bonsai-on-opencode-1.18.3` branch does not currently exist; `bonsai/v1-on-opencode-1.18.3` tag does not currently exist. Existing worktrees/branches from prior cycles (e.g., `replay/context-bonsai-on-opencode-1.15.7`, `replay/context-bonsai-on-opencode-1.17.13`) are enumerated as untouchable.
- Escalation Status: none.
- Decision Citation: planner judgment under the user instruction to drive the OpenCode forward-port cycle from `3d26252cded4c110f525e1082ee591b4963cba5f` to `v1.18.3` and update `opencode_dev`.

## Plan Approval and Commit Status

- Approval Status: approved
- Approval Citation: Approved by bonsai-judge on 2026-07-18 for iteration 1 of story `rebase-cycle-3d26252cded4c110f525e1082ee591b4963cba5f`. Verdict: **APPROVED AS-IS**. All 11 reviewer findings (2 critical, 3 high, 3 medium, 3 low) are resolved in the revised plan. The bonsai-reviewer target-resolution rehearsal passed all canonical validation commands on a disposable scratch worktree at `127bdb30784d508cc556c71a0f32b508a3061517` with no regressions.
- Plan Commit Hash: recorded by Phase -1 gate; see the commit landing this file
- Ready-for-Orchestration: yes (after plan + validation artifacts + judgement report are committed)

## Validation Loop Results

- Iteration 1 (2026-07-18):
  - Subagent: `bonsai-reviewer` (fresh session).
  - Missing-details check: 2 critical findings (replay-set `target_paths` omitted `packages/schema/src/v1/session.ts`; version assertion required `OPENCODE_VERSION=1.18.3` on builds). 3 high findings (pre-publish install gate missing, replay worktree cleanup missing, tag/E2E ordering inverted). 3 medium findings (credential variable names, `.opencode/opencode.jsonc` restoration, plugin symlink case). 3 low findings (local remote path, baseline provenance working directory, JSONC-safe edit method). All findings have been addressed in this revision.
  - Ambiguity check: resolved by adding explicit commands and edge-case handling (symlink detection, JSONC-safe edit, cleanup, install gate, version override).
  - Target-resolution rehearsal: passed. The bonsai-reviewer created a disposable worktree at `127bdb30784d508cc556c71a0f32b508a3061517`, hydrated dependencies, cherry-picked all three replay rows cleanly, verified 3 provenance trailers, ran the canonical validation set (all 5 commands green), and confirmed generated-artifact count is 0. The rehearsed binary reported `0.0.0--202607182005` without `OPENCODE_VERSION`; the plan now binds `OPENCODE_VERSION=1.18.3` on all builds.
  - Replay-set update: added `packages/schema/src/v1/session.ts` to the `00ebeb266...` row and recomputed the checksum to `00e80b73639c2d9152fdf2a7340f47316a407a2d2a5f42137027551c4b010fed`.
- Bindings-freshness consultation: OpenCode's level-2 bindings live in Part 4 of `docs/agent-specs/forward-port-spec.md` and are maintained by this spec's cycle machinery; no separate `bindings-reverification-*.md` pass record exists. Recorded as a vacuous consultation.
- Iterations run: 1.
- Remaining blockers: judge approval.

## Completion Checklist

- [x] All acceptance criteria met
- [x] Validation commands pass
- [ ] Plan approved and committed before orchestration begins
- [ ] User-model ambiguities resolved or escalated
- [ ] Worktree artifact overlaps resolved (approved direction or explicit deferral)
- [ ] Replay-set checksum verified pre-replay and unchanged at seal
- [ ] Baseline artifact complete; no null `provenance_ref` rows
- [ ] Replay commits carry `cherry picked from commit` provenance trailers
- [ ] Replay diff scope bounded by replay-set `target_paths` union
- [ ] No generated SDK/API files in replay diff
- [x] E2E behavioral gate passes (Protocols A and B) or exception approved
- [x] Tag `bonsai/v1-on-opencode-1.18.3` present locally at the rebased tip (remote pushability not exercised per local-only authorization)
- [x] Parent pin-advance branch `pin-advance/opencode-1.18.3` created with updated submodule pointer
- [x] Local installation `opencode_dev` updated and verified
- [x] `docs/agent-specs/forward-port-spec.md` unchanged at seal
