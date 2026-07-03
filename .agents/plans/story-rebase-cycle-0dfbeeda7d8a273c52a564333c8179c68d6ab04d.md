# Story: Forward-Port OpenCode Context Bonsai Chain onto v1.17.13

## Goal

Replay the frozen Context Bonsai OpenCode patch chain at `0dfbeeda7d8a273c52a564333c8179c68d6ab04d` onto frozen upstream tag `v1.17.13` (`10c894bdeef3618f5666fb506ef7f9491bb964d8`) using the git-fork shape in `docs/agent-specs/forward-port-spec.md`. The sealed outcome is a target branch based on the frozen upstream, containing only the approved replay set, tagged `bonsai/v1-on-opencode-1.17.13`, validated through runtime e2e, parent pin advancement, the pre-publish install gate, the publish ladder, and parent `main` fast-forward.

**Generation provenance**: this plan was generated and validated on the stronger (Fable-class) tier per the tiering decision recorded in `docs/meta-loop-direction.md` §"Next Step" (owner decision, 2026-07-03). The executor of this plan is the GPT-5.5 process orchestrator; every command below is bound so that execution requires no judgment call this plan does not resolve.

## Non-Goal

Do not change Context Bonsai behavior, do not edit `docs/agent-specs/forward-port-spec.md` during cycle execution, do not touch `opencode_context_bonsai_plugin/` except for the install-gate result artifacts allowed by the §4.2 Evidence-paths slot, and do not stage, commit, revert, or otherwise absorb the pre-existing dirty `tweakcc_context_bonsai` submodule pin.

## Execution Outcome Statement

Final OpenCode `HEAD` on `replay/context-bonsai-on-opencode-1.17.13` must have merge-base `10c894bdeef3618f5666fb506ef7f9491bb964d8`, exactly three replay commits, and no generated artifacts. Parent `main` advances only after the local pin-advance branch has passed the pre-publish install gate and the harness branch/tag/submodule pushes have completed in the §2.9 order.

## Frozen Inputs

- `SOURCE_REF`: `refs/heads/replay/context-bonsai-on-opencode-1.15.7`
- `SOURCE_HEAD_SHA`: `0dfbeeda7d8a273c52a564333c8179c68d6ab04d`
- `UPSTREAM_REF`: `refs/tags/v1.17.13`
- `UPSTREAM_HEAD_SHA`: `10c894bdeef3618f5666fb506ef7f9491bb964d8`
- `BASE_SHA`: `6bee6ee7557072a81eed030edcf021acc0faf3c6` (computed: `git merge-base 10c894bdeef3618f5666fb506ef7f9491bb964d8 0dfbeeda7d8a273c52a564333c8179c68d6ab04d`)
- `TARGET_WORKTREE`: `/home/basil/projects/context-bonsai-agents/opencode/.agent_tmp/rebase-on-v1.17.13`
- `TARGET_BRANCH`: `replay/context-bonsai-on-opencode-1.17.13`
- `TARGET_TAG_AT_TIP`: `bonsai/v1-on-opencode-1.17.13`
- `PARENT_PIN_BRANCH`: `pin-advance/opencode-1.17.13`
- `PLUGIN_FROZEN_COMMIT`: `b2ce708c88ff111cdbe5ea6e3bd150ba9fe8dd5a` (side repo `opencode_context_bonsai_plugin/`, currently detached at this commit)
- `PLUGIN_INSTALL_E2E_BRANCH`: `install-e2e/opencode-1.17.13`, created from `PLUGIN_FROZEN_COMMIT` when the install gate writes its result artifact (Phase 7 step 6)
- `VALIDATION_MODE`: `committed-final`
- Toolchain pin: upstream v1.17.13's root `package.json` records `"packageManager": "bun@1.3.14"`; this cycle requires `bun --version` to report exactly `1.3.14` (Phase 0). A mismatch is STOP-and-escalate (environmental), not a version to upgrade mid-cycle.
- Range scope: all commits in `UPSTREAM_HEAD_SHA..SOURCE_HEAD_SHA`, no author filter.
- Pre-existing dirty parent status enumerated by the invoker (§1.10): ` M tweakcc_context_bonsai` only; untouchable.

All commands below use these frozen identities. Do not substitute moving refs, `HEAD`-relative resolution of the inputs, `latest`, or a newly resolved tag.

## Allowlists and Planned Targets

- Runtime allowlist: `packages/opencode/**`, `packages/plugin/**`.
- Docs allowlist: `.agents/plans/**`, `.opencode/context_bonsai/**`.
- State-only: metadata/state artifacts outside both allowlists.
- Fork-owned wholesale file: root `README.md` — outside the allowlists by design, classified `manual_review`, resolved through the approvals artifact per cycle (§2.3); content probe `grep -q "Context Bonsai" README.md`.
- Parent repo planned files: this plan; the replay-set, manual-review-approvals, and exceptions artifacts under `.agents/plans/validation/` (committed with this plan); the baseline artifact `baseline-0dfbeeda7d8a273c52a564333c8179c68d6ab04d.json` (created and committed during Phase 2); the `opencode/` submodule pin and `opencode_context_bonsai_plugin/` submodule pin on `pin-advance/opencode-1.17.13`; maintenance report under `.agents/pilot/`.
- OpenCode replay targets: the union of replay-set `target_paths` for non-dropped rows.
- Plugin side-repo planned files: `docs/install-e2e-results-<DATE>.md` on `install-e2e/opencode-1.17.13` only (`<DATE>` = UTC date of the install-gate run, `YYYY-MM-DD`).
- Explicit non-targets: `docs/agent-specs/forward-port-spec.md` during cycle execution; the source branch in place; prior `opencode/.agent_tmp/` worktrees; `tweakcc_context_bonsai`; `opencode.json`/host global config beyond the install-gate's backed-up-and-restored edit.

## User Model

### User Gamut

- OpenCode maintainers reviewing a compact carried patch chain above a tagged release.
- Context Bonsai users who need prune/retrieve continuity through OpenCode plugin tools.
- Release operators who need deterministic local evidence before force-updating the replay branch.
- Reviewers and judges auditing provenance, exception discipline, and e2e proof.
- Downstream installers consuming the parent repo after the submodule pins advance.

### User-Needs Gamut

- Minimal, reviewable cherry-pick replay with tight path scope.
- Deterministic evidence that dropped release metadata was already upstream.
- Runtime proof from host state, not model claims or green typechecks alone.
- Pre-publish install validation from local state only, before any push.
- Clear STOP behavior when credentials, e2e, scope, or publish dry-runs block the ladder.

### Ambiguities From User Model

- Release-commit treatment is resolved by §2.3 precedence: `already_in_upstream` beats path allowlists because `git cherry -v` marks the release commit `-`.
- README treatment is resolved by §2.3 and §4.2: keep it `manual_review` with a per-cycle approval; do not widen allowlists.
- Replay strategy is cherry-pick first. `re-implement` requires reviewer+judge approval and the §2.5 behavioral-contract table before use.

## Validation Artifact References

- Replay set: `.agents/plans/validation/replay-set-0dfbeeda7d8a273c52a564333c8179c68d6ab04d.json`
- Replay-set checksum (SHA-256 of `jq -c` canonical JSON): `136fb08d9854f92c5704e33dbf30aa3ebadefa01ddfe00d845fa9a237231c6f9`
- Manual-review approvals: `.agents/plans/validation/manual-review-approvals-0dfbeeda7d8a273c52a564333c8179c68d6ab04d.json`
- Manual-review approvals checksum: `32a9a2c71598593f5c0736b830d5c9518d5a847f4632a687d953caedab6cdddf` (final post-approval content: `resolution_state=approved` with the reviewer+judge refs recorded 2026-07-03, before plan commit)
- Exception ledger: `.agents/plans/validation/exceptions-0dfbeeda7d8a273c52a564333c8179c68d6ab04d.json` (empty by default; checksum `37517e5f3dc66819f61f5a7bb8ace1921282415f10551d2defa5c3eb0985b570`)
- Baseline artifact to create in Phase 2: `.agents/plans/validation/baseline-0dfbeeda7d8a273c52a564333c8179c68d6ab04d.json`

## Source Commit Classification

| sha | subject | bucket | replay_action | target_paths | mapping_type | evidence | rationale | approver |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `5451227deb5a502afe44e1664e81df7ecb208ed1` | release: v1.15.7 | `already_in_upstream` | `drop` | release/version files enumerated in the replay set | `drop` | `git cherry -v 10c894… 0dfbee…` marks `-` | Old release metadata is patch-equivalent in v1.17.13; replaying would regress versions. | plan approval |
| `712175fd95d2923c91e082c1c02708d648832cdd` | Persist Context Bonsai message metadata through parsing and storage | `required_runtime` | `cherry-pick` | `packages/opencode/src/session/message-v2.ts`; `packages/opencode/test/session/context-bonsai.test.ts`; `packages/opencode/test/session/message-v2.test.ts` | `1:1` | `git cherry -v` marks `+`; `git log --name-status` shows only `packages/opencode/**` paths | Required metadata persistence for Context Bonsai archives. | plan approval |
| `bedf144c066448d8668179ffd1a2cdb2a31b6207` | Expose safe message-metadata updates to plugin tools | `required_runtime` | `cherry-pick` | `packages/opencode/src/tool/registry.ts`; `packages/opencode/test/tool/registry.test.ts`; `packages/plugin/src/tool.ts` | `1:1` | `git cherry -v` marks `+`; paths inside runtime allowlists | Required plugin-tool metadata bridge. | plan approval |
| `0dfbeeda7d8a273c52a564333c8179c68d6ab04d` | docs(README): replace upstream README with Context Bonsai signpost | `manual_review` | `cherry-pick` | `README.md` | `1:1` | root README outside all allowlists; approval recorded in the approvals artifact | Fork-owned signpost carried each cycle; on conflict replace wholesale from source. | reviewer+judge per approvals artifact |

Merge scan: `git log --merges 10c894bdeef3618f5666fb506ef7f9491bb964d8..0dfbeeda7d8a273c52a564333c8179c68d6ab04d` is empty (verified at generation).

## Reviewer-Simplicity Evaluation

- Runtime rows `712175fd` and `bedf144c`: cherry-pick preferred — narrow runtime targets, source provenance preserved. Cherry-pick plus line-level fixups is allowed only inside that row's `target_paths`. Re-implementation is disallowed unless cherry-pick cannot be resolved without out-of-scope changes; if that occurs, STOP and obtain reviewer+judge approval before writing the §2.5 behavioral contract.
- README row `0dfbeeda`: cherry-pick preferred. On conflict, replace wholesale from source: `git show 0dfbeeda7d8a273c52a564333c8179c68d6ab04d:README.md > README.md && git add README.md && git cherry-pick --continue`; verify `diff <(git show 0dfbeeda7d8a273c52a564333c8179c68d6ab04d:README.md) README.md` is empty and `grep -q "Context Bonsai" README.md` succeeds. Do not use `git checkout --theirs`.

## Re-Implementation Behavioral Contracts

None at generation time. If any row switches to `re-implement`, populate all §2.5 required fields before the deviating action: `source_primitive_or_intent`, `current_upstream_boundary`, `return_shape`, `runtime_bridge_pattern`, `allowed_mutation_surface`, `approved_metadata_schema`, `metadata_runtime_validation`, `atomicity_requirement`, `generated_artifact_decision`, `public_api_exposure_decision`, `validation_evidence`.

## Acceptance Criteria

- [ ] Plan approval and commit gate closed before replay orchestration starts.
- [ ] Parent preflight shows only ` M tweakcc_context_bonsai`; `opencode/` and `opencode_context_bonsai_plugin/` clean before their phases.
- [ ] Frozen source and upstream refs still resolve to the frozen SHAs; drift triggers §1.9, never a patch to this plan.
- [ ] Replay-set and manual-approval checksums verified before replay and again at seal.
- [ ] Baseline artifact exists before replay, has all five rows with no placeholder fields, and `r01` is green on clean upstream.
- [ ] Exactly three cherry-picked replay commits on `TARGET_BRANCH` from `UPSTREAM_HEAD_SHA`; the dropped release commit absent.
- [ ] Replay diff limited to replay-set target paths; generated-artifact probe returns zero.
- [ ] Canonical validation set passes; post-replay results no worse than baseline.
- [ ] Runtime e2e Protocol A and Protocol B PASS against the freshly built binary, or a reviewer+judge-approved exception is recorded before seal.
- [ ] Manual-review README row `0dfbeeda…` carries `resolution_state=approved` with reviewer+judge refs in the approvals artifact (checksum above) — this is the §1.5 hard-block release for the only hard-blocking row.
- [ ] Rebase-point tag exists locally; branch and tag push dry-runs green; pin-advance branch passes the pre-publish install gate; install-gate result recorded and pins bumped in the Phase 7 order; pushes execute in §2.9 order; parent `main` fast-forwards.
- [ ] `test -f docs/agent-specs/forward-port-spec.md` passes and `git diff --name-only -- docs/agent-specs/forward-port-spec.md` is empty through the seal gate.
- [ ] No unresolved manual-review rows; no unresolved exception rows.

## Implementation Phases with Commands

Working directories: "From parent" = `/home/basil/projects/context-bonsai-agents`; "From `opencode`" = `/home/basil/projects/context-bonsai-agents/opencode`; "From worktree root" = `TARGET_WORKTREE`; "From plugin" = `/home/basil/projects/context-bonsai-agents/opencode_context_bonsai_plugin`.

### Phase 0: Credential, Toolchain, and Clean-State Preflight

- From parent: `git status --short` output must contain only ` M tweakcc_context_bonsai` (plus nothing else once this plan and its artifacts are committed).
- From `opencode`: `git status --short` must be empty.
- From plugin: `git status --short` must be empty, and `git rev-parse HEAD` must equal `b2ce708c88ff111cdbe5ea6e3bd150ba9fe8dd5a`.
- `command -v bun`; `command -v jq`; `command -v sha256sum`; `command -v python3`.
- `test "$(bun --version)" = "1.3.14"` — on failure STOP and escalate (toolchain/environment, not a cycle change).
- Credential presence for the e2e gates: `test -n "$OPENCODE_PROVIDER"`; `test -n "$OPENCODE_MODEL"`; `test -n "$OPENCODE_API_KEY"`. Never log or persist the values. If any check fails, phases 0–4 and 6 may still run; every live e2e scenario (Phase 5, Phase 7 gate) is `BLOCKED` with reason `credentials-missing-in-harness`, and the cycle must not seal or publish: resolve credentials and re-run the blocked scenarios, or record a reviewer+judge-approved gate-11 exception before any seal claim.

### Phase 1: Freeze Verification and Workspace Preparation

- From `opencode`: `git fetch --all --prune`.
- From `opencode`: `git fetch upstream "refs/tags/v1.17.13:refs/tags/v1.17.13"` (the `upstream` remote's refspec is heads-only; `--all --prune` acquires no tags — §2.1).
- From `opencode`: `test "$(git rev-parse --verify refs/heads/replay/context-bonsai-on-opencode-1.15.7)" = "0dfbeeda7d8a273c52a564333c8179c68d6ab04d"` — on failure this is §1.9 source drift: STOP; a fresh plan keyed to the new SHA is required, never a patch to this one.
- From `opencode`: `test "$(git rev-parse --verify refs/tags/v1.17.13)" = "10c894bdeef3618f5666fb506ef7f9491bb964d8"`.
- From `opencode`: `test "$(git merge-base 10c894bdeef3618f5666fb506ef7f9491bb964d8 0dfbeeda7d8a273c52a564333c8179c68d6ab04d)" = "6bee6ee7557072a81eed030edcf021acc0faf3c6"`.
- From parent: verify artifact checksums against the literal values in "Validation Artifact References":
  - `test "$(jq -c < .agents/plans/validation/replay-set-0dfbeeda7d8a273c52a564333c8179c68d6ab04d.json | sha256sum | cut -d' ' -f1)" = "136fb08d9854f92c5704e33dbf30aa3ebadefa01ddfe00d845fa9a237231c6f9"`
  - `test "$(jq -c < .agents/plans/validation/manual-review-approvals-0dfbeeda7d8a273c52a564333c8179c68d6ab04d.json | sha256sum | cut -d' ' -f1)" = "32a9a2c71598593f5c0736b830d5c9518d5a847f4632a687d953caedab6cdddf"`
  - `test "$(jq -c < .agents/plans/validation/exceptions-0dfbeeda7d8a273c52a564333c8179c68d6ab04d.json | sha256sum | cut -d' ' -f1)" = "37517e5f3dc66819f61f5a7bb8ace1921282415f10551d2defa5c3eb0985b570"`
- From `opencode`: collision checks; any failure is a §1.14 STOP (already-generated/executed cycle), not license to resume or delete:
  - `test ! -e /home/basil/projects/context-bonsai-agents/opencode/.agent_tmp/rebase-on-v1.17.13`
  - `! git show-ref --verify --quiet refs/heads/replay/context-bonsai-on-opencode-1.17.13`
  - `! git show-ref --verify --quiet refs/tags/bonsai/v1-on-opencode-1.17.13`
- From `opencode`: `git worktree add -b replay/context-bonsai-on-opencode-1.17.13 /home/basil/projects/context-bonsai-agents/opencode/.agent_tmp/rebase-on-v1.17.13 10c894bdeef3618f5666fb506ef7f9491bb964d8`.
- From worktree root: `test "$(git rev-parse HEAD)" = "10c894bdeef3618f5666fb506ef7f9491bb964d8"`.
- From worktree root: `test -d node_modules || bun install`.
- From worktree root: `jq -r '.scripts.typecheck' packages/opencode/package.json` and `jq -r '.scripts.typecheck' packages/plugin/package.json` each return a non-empty string other than `null`.
- From worktree root: `bun turbo run build --filter=opencode --dry-run` lists the build task.

### Phase 2: Baseline Capture

Run the five rows below, capturing each row's full output to its `artifact_path` (worktree-local, gitignored under `.agent_tmp/`) and its exit code. Then emit `.agents/plans/validation/baseline-0dfbeeda7d8a273c52a564333c8179c68d6ab04d.json` from the parent root: a JSON array of five row objects with fields in exactly this order: `row_id`, `command`, `frozen_upstream_head_sha` (`10c894bdeef3618f5666fb506ef7f9491bb964d8`), `frozen_source_head_sha` (`0dfbeeda7d8a273c52a564333c8179c68d6ab04d`), `exit_code`, `result`, `artifact_path`, `provenance_ref`. No field may be empty or `n/a`.

| row_id | working directory | command | artifact_path | provenance_ref (record its output) | result mapping |
| --- | --- | --- | --- | --- | --- |
| `r01` | worktree `packages/opencode` | `bun test test/tool/registry.test.ts test/session/message-v2.test.ts test/session/session.test.ts` | `.agent_tmp/baseline/baseline-r01.log` | `git rev-parse HEAD` from worktree root (must print the frozen upstream SHA) | `pass` if exit 0, else `fail`; **must-be-green**: a non-zero exit is STOP-and-escalate (pre-existing upstream regression) |
| `r02` | worktree `packages/opencode` | `test ! -f test/session/context-bonsai.test.ts && echo missing-as-expected \|\| (echo unexpected-presence && false)` | `.agent_tmp/baseline/baseline-r02.log` | `git ls-files packages/opencode/test/session/context-bonsai.test.ts` from worktree root (must print nothing) | stdout string; `unexpected-presence` hard-fails the phase |
| `r03` | worktree `packages/opencode` | `bun typecheck` | `.agent_tmp/baseline/baseline-r03.log` | `jq -r '.scripts.typecheck' packages/opencode/package.json` from worktree root | `pass` if exit 0, else `fail` |
| `r04` | worktree `packages/plugin` | `bun typecheck` | `.agent_tmp/baseline/baseline-r04.log` | `jq -r '.scripts.typecheck' packages/plugin/package.json` from worktree root | `pass` if exit 0, else `fail` |
| `r05` | worktree root | `bun turbo run build --filter=opencode` | `.agent_tmp/baseline/baseline-r05.log` | `bun turbo run build --filter=opencode --dry-run` from worktree root | `pass` if exit 0, else `fail` |

Log-directory note: create it first — from worktree root, `mkdir -p .agent_tmp/baseline`. Every `artifact_path` above is worktree-root-relative; the worktree-local `.agent_tmp/` directory is gitignored (the same location Phase 5's e2e evidence uses), so the logs stay uncommitted inside the disposable worktree. The committed evidence is the baseline JSON.

Validate the emitted artifact from parent root:

```bash
jq -e 'length==5 and all(.[]; (.row_id and .command and .frozen_upstream_head_sha and .frozen_source_head_sha and (.exit_code|type=="number") and .result and .artifact_path and .provenance_ref) and (.provenance_ref != "n/a") and (.artifact_path != "n/a"))' .agents/plans/validation/baseline-0dfbeeda7d8a273c52a564333c8179c68d6ab04d.json
jq -e 'any(.[]; .row_id=="r01" and .exit_code==0 and .result=="pass") and any(.[]; .row_id=="r02" and .result=="missing-as-expected")' .agents/plans/validation/baseline-0dfbeeda7d8a273c52a564333c8179c68d6ab04d.json
```

Then commit the baseline artifact to parent `main` (subject + body per repo commit rules), so the parent tree returns to clean-plus-enumerated before replay:

```bash
git add .agents/plans/validation/baseline-0dfbeeda7d8a273c52a564333c8179c68d6ab04d.json
git commit -m "chore: record v1.17.13 cycle baseline (SOURCE 0dfbeeda)" -m "Five-row baseline captured on clean upstream 10c894bd in the rebase worktree per forward-port-spec §1.6/§2.8; r01 green, r02 missing-as-expected."
```

### Phase 3: Replay

- From worktree root, re-run the worktree artifact check against every replay target path immediately before the first cherry-pick:
  - `git status --short -- README.md packages/opencode/src/session/message-v2.ts packages/opencode/test/session/context-bonsai.test.ts packages/opencode/test/session/message-v2.test.ts packages/opencode/src/tool/registry.ts packages/opencode/test/tool/registry.test.ts packages/plugin/src/tool.ts`
  - `git ls-files --others --exclude-standard -- README.md packages/opencode/src/session/message-v2.ts packages/opencode/test/session/context-bonsai.test.ts packages/opencode/test/session/message-v2.test.ts packages/opencode/src/tool/registry.ts packages/opencode/test/tool/registry.test.ts packages/plugin/src/tool.ts`
  - Any output is a `tracked-dirty` or `existing-untracked` overlap: STOP until reviewer+judge approval or explicit deferral is recorded; never absorb it.
- From worktree root, in this order:
  - `git cherry-pick -x 712175fd95d2923c91e082c1c02708d648832cdd`
  - `git cherry-pick -x bedf144c066448d8668179ffd1a2cdb2a31b6207`
  - `git cherry-pick -x 0dfbeeda7d8a273c52a564333c8179c68d6ab04d` — on README conflict, apply the wholesale replacement from the Reviewer-Simplicity section.
- Conflict-resolution edits must stay inside the conflicting row's `target_paths`; anything wider is an out-of-scope fixup requiring a pre-approved exception row (§1.7) before the edit lands.
- From worktree root: `test "$(git log --format='%b' 10c894bdeef3618f5666fb506ef7f9491bb964d8..HEAD | grep -cE '^\(cherry picked from commit [0-9a-f]{40}\)$')" = "3"`.

### Phase 4: Post-Replay Validation

- From worktree `packages/opencode`: `bun test test/tool/registry.test.ts test/session/message-v2.test.ts test/session/session.test.ts` — must be no worse than baseline r01; net-new failures are hard-fail regressions.
- From worktree `packages/opencode`: `bun test test/session/context-bonsai.test.ts` — must pass (the chain introduces it).
- From worktree `packages/opencode`: `bun typecheck`.
- From worktree `packages/plugin`: `bun typecheck`.
- From worktree root: `bun turbo run build --filter=opencode`.
- From worktree root: `git diff --name-status 10c894bdeef3618f5666fb506ef7f9491bb964d8..HEAD` must list only replay-set `target_paths` of non-dropped rows.
- From worktree root: `git diff --name-status 10c894bdeef3618f5666fb506ef7f9491bb964d8..HEAD | grep -E '(\.d\.ts$|/generated/|/__generated__/|openapi|\.gen\.|/dist/)' | wc -l` must print `0`; any match: STOP and remove those files from the replay commits (§2.7).

### Phase 5: Rebase-Point Tag and Runtime E2E Gate

Tag first so Protocol A/B evidence validates the exact tagged tip §2.9 step 1 requires:

- From worktree root: `git tag bonsai/v1-on-opencode-1.17.13 HEAD`.
- From worktree root: `test "$(git rev-parse bonsai/v1-on-opencode-1.17.13)" = "$(git rev-parse HEAD)"`.

Runtime e2e commands are copied from `docs/opencode-e2e-runbook.md` with its `<tag>` slot bound to `v1.17.13`. Required minimum scenarios: Protocol A (Secret Prune Oracle) and Protocol B (Retrieve Roundtrip). Per-run parameters, chosen fresh and recorded in the run record but never in versioned artifacts: `<SECRET>` — one uncommon word not otherwise present in the session; `<ANCHOR_ID>` — captured at step B3. If a command this plan needs is missing from the runbook, flag the missing binding and STOP (§4.2); do not invent a substitute.

Plugin wiring (§4.2): start from the pinned harness's committed `.opencode/opencode.jsonc` (verified content at `10c894bd…`, which carries no `"plugin"` key) and add the top-level `"plugin"` key. Exact command from worktree root (writes the upstream-committed content plus the plugin entry; worktree-local, never committed — the file is tracked, so the worktree shows ` M .opencode/opencode.jsonc` afterward; that modification must not enter any commit):

```bash
python3 - <<'PY'
from pathlib import Path
Path('.opencode/opencode.jsonc').write_text('''{
  "$schema": "https://opencode.ai/config.json",
  "provider": {},
  "permission": {},
  "references": {
    "effect": {
      "repository": "github.com/Effect-TS/effect-smol",
      "description": "Use for Effect v4 and effect-smol implementation details",
    },
    "opencode-local": {
      "path": "~/.local/share/opencode",
      "description": "Contains opencode logs and data",
    },
  },
  "mcp": {},
  "tools": {
    "github-triage": false,
    "github-pr-search": false,
  },
  "plugin": [
    "file:///home/basil/projects/context-bonsai-agents/opencode_context_bonsai_plugin/src/index.ts"
  ],
}
''')
PY
grep -A2 '"plugin"' .opencode/opencode.jsonc
```

Evidence directories and the shared export inspector (runbook, verbatim with `<tag>` bound):

```bash
mkdir -p .agent_tmp/e2e-on-v1.17.13/protocol-a .agent_tmp/e2e-on-v1.17.13/protocol-b
cat > .agent_tmp/e2e-on-v1.17.13/inspect-export.py <<'EOF'
import json, sys
data = json.load(open(sys.argv[1]))
for msg in data['messages']:
    role = msg['info']['role']
    mid = msg['info']['id']
    bonsai = msg['info'].get('metadata', {}).get('opencode-context-bonsai', {})
    for part in msg['parts']:
        if part['type'] == 'text':
            print(f'--- {role} ({mid}) ---')
            if bonsai:
                print(f'[HAS BONSAI METADATA: {json.dumps(bonsai)[:150]}]')
            print(part['text'][:300])
            print()
        elif part['type'] == 'tool':
            tool_name = part.get('tool', '?')
            if 'bonsai' in tool_name:
                print(f'--- {role} tool: {tool_name} ---')
                print('Input: ' + json.dumps(part.get('state',{}).get('input',{}), indent=2)[:300])
                print('Output: ' + str(part.get('state',{}).get('output',''))[:300])
                print()
EOF
```

Protocol A (runbook, verbatim; `<SECRET>` per the rule above):

```bash
BIN=packages/opencode/dist/opencode-linux-x64/bin/opencode

# A1 — seed the secret in a fresh session (no --continue: new session)
timeout 120 $BIN run \
  "I'm going to tell you a secret code word. Do not say it back unless I explicitly ask 'what is the code word'. The code word is: <SECRET>. Just acknowledge that you've noted it." \
  --print-logs --log-level DEBUG 2>.agent_tmp/e2e-on-v1.17.13/protocol-a/step1.log

# A2 — prune the seeding message without reusing the secret
timeout 120 $BIN run --continue \
  "Use context-bonsai-prune to archive the message where I told you the code word. Only that single message needs to be pruned — not your response. Do not repeat the code word in the tool arguments or in your reply." \
  --print-logs --log-level DEBUG 2>.agent_tmp/e2e-on-v1.17.13/protocol-a/step2.log

# A3 — recall attempt with tool use forbidden
timeout 120 $BIN run --continue \
  "Do not use any tools for the rest of this session. What is the code word?" \
  --print-logs --log-level DEBUG 2>.agent_tmp/e2e-on-v1.17.13/protocol-a/step3.log

# Leak check: must NOT match (exit code 1 = good)
grep -i "<SECRET>" .agent_tmp/e2e-on-v1.17.13/protocol-a/step3.log

# Full-session inspection
$BIN export 2>/dev/null > .agent_tmp/e2e-on-v1.17.13/protocol-a/export.json
python3 .agent_tmp/e2e-on-v1.17.13/inspect-export.py .agent_tmp/e2e-on-v1.17.13/protocol-a/export.json
```

Protocol A verdict (runbook): **PASS** — leak-check grep exits 1, the export's final assistant message states the information is unavailable/archived, and A2 shows prune success with archive metadata on the anchor message. **FAIL** — grep matches in A3's assistant response, prune errored, or the export shows the secret in an active message. **BLOCKED** — launch/provider/plugin-load/timeout failure before the oracle ran (`timeout` exit 124 is BLOCKED, not FAIL).

Protocol B (runbook, verbatim):

```bash
BIN=packages/opencode/dist/opencode-linux-x64/bin/opencode

# B1 — fresh session with a uniquely bounded discussion
timeout 120 $BIN run \
  "Tell me three detailed facts about octopuses. At least a paragraph each." \
  --print-logs --log-level DEBUG 2>.agent_tmp/e2e-on-v1.17.13/protocol-b/step1.log

# B2 — prune the range
timeout 120 $BIN run --continue \
  "That info about octopuses is no longer needed. Please use the context-bonsai-prune tool to archive those messages." \
  --print-logs --log-level DEBUG 2>.agent_tmp/e2e-on-v1.17.13/protocol-b/step2.log

# B3 — capture the anchor id: the message id carrying archive metadata
$BIN export 2>/dev/null > .agent_tmp/e2e-on-v1.17.13/protocol-b/export-pruned.json
python3 -c "
import json, sys
data = json.load(open(sys.argv[1]))
print('\n'.join(m['info']['id'] for m in data['messages'] if m['info'].get('metadata', {}).get('opencode-context-bonsai')))
" .agent_tmp/e2e-on-v1.17.13/protocol-b/export-pruned.json
# Exactly one id must print; record it as <ANCHOR_ID>. Zero or multiple ids is a
# FAIL of the capture step — do not guess among candidates.

# B4 — retrieve by anchor id
timeout 120 $BIN run --continue \
  "Use context-bonsai-retrieve with anchor_id <ANCHOR_ID> to restore the archived messages." \
  --print-logs --log-level DEBUG 2>.agent_tmp/e2e-on-v1.17.13/protocol-b/step3.log

# B5 — verify restoration
$BIN export 2>/dev/null > .agent_tmp/e2e-on-v1.17.13/protocol-b/export-restored.json
python3 .agent_tmp/e2e-on-v1.17.13/inspect-export.py .agent_tmp/e2e-on-v1.17.13/protocol-b/export-restored.json
```

Protocol B verdict (runbook): **PASS** — B2 prune succeeded with archive metadata in `export-pruned.json`, exactly one anchor id at B3, B4 retrieve success, and `export-restored.json` shows the B1 discussion in active text parts again. **FAIL** — zero/multiple B3 ids, retrieve error, or restored export still hides B1 content. **BLOCKED** — as Protocol A.

Evidence stays worktree-local and uncommitted (§4.2). A FAIL on either protocol is a STOP: the seal cannot proceed without a reviewer+judge-approved exception (gate 11), and Protocol A failing on a clean build after prior validation passed is a §1.17 escalation.

### Phase 6: Seal Gates and Push-Readiness

- From parent: re-verify all three artifact checksums against the literal values in "Validation Artifact References" (commands as in Phase 1).
- From parent: `jq -e 'length == 4 and all(.[]; .source_sha and .bucket and .replay_action and .mapping_type and (.target_paths|type=="array") and .rationale and .evidence_ref)' .agents/plans/validation/replay-set-0dfbeeda7d8a273c52a564333c8179c68d6ab04d.json`.
- From parent: `jq -e 'all(.[]; .resolution_state == "approved" and (.approval_refs|length>=2))' .agents/plans/validation/manual-review-approvals-0dfbeeda7d8a273c52a564333c8179c68d6ab04d.json`.
- From parent: `jq -e 'all(.[]; .resolution_state == "resolved")' .agents/plans/validation/exceptions-0dfbeeda7d8a273c52a564333c8179c68d6ab04d.json` (empty array passes).
- From parent: the two baseline `jq` validation commands from Phase 2 both pass.
- From worktree root: `test "$(git merge-base 10c894bdeef3618f5666fb506ef7f9491bb964d8 HEAD)" = "10c894bdeef3618f5666fb506ef7f9491bb964d8"`.
- From worktree root: `test "$(git rev-list --count 10c894bdeef3618f5666fb506ef7f9491bb964d8..HEAD)" = "3"`.
- From worktree root: `git log --format='%H %s' 10c894bdeef3618f5666fb506ef7f9491bb964d8..HEAD` — subjects match the three non-dropped replay-set rows.
- From worktree root: re-run the provenance trailer count from Phase 3, identically.
- From worktree root: `git diff --name-only 10c894bdeef3618f5666fb506ef7f9491bb964d8..HEAD | sort` equals the sorted union of non-dropped replay-set `target_paths` (7 paths).
- From worktree root: the §2.7 generated-artifact probe from Phase 4 prints `0`.
- From worktree root: `git push --dry-run origin replay/context-bonsai-on-opencode-1.17.13` exits 0.
- From worktree root: `git push --dry-run origin refs/tags/bonsai/v1-on-opencode-1.17.13` exits 0.
- From parent: `test -f docs/agent-specs/forward-port-spec.md` and `test -z "$(git diff --name-only -- docs/agent-specs/forward-port-spec.md)"`.

### Phase 7: Parent Pin Advance, Pre-Publish Install Gate, and Result Recording

This phase has a fixed internal order. Steps 1–4 advance the `opencode` pin and run the gate; steps 5–7 record the result and bump the plugin pin; nothing pushes until Phase 8.

**Step 1 — pin-advance branch.** After this plan and its three validation artifacts are committed (the Plan Approval gate) and the Phase 2 baseline commit exists, from parent: `PARENT_BASE_COMMIT=$(git rev-parse main)`. Verify it contains the plan, the three validation artifacts, and the baseline: `test "$(git ls-tree -r --name-only "$PARENT_BASE_COMMIT" -- .agents/plans/story-rebase-cycle-0dfbeeda7d8a273c52a564333c8179c68d6ab04d.md .agents/plans/validation/replay-set-0dfbeeda7d8a273c52a564333c8179c68d6ab04d.json .agents/plans/validation/manual-review-approvals-0dfbeeda7d8a273c52a564333c8179c68d6ab04d.json .agents/plans/validation/exceptions-0dfbeeda7d8a273c52a564333c8179c68d6ab04d.json .agents/plans/validation/baseline-0dfbeeda7d8a273c52a564333c8179c68d6ab04d.json | wc -l)" = "5"` (this plan is not required to contain its own commit hash). Then:

```bash
git switch -c pin-advance/opencode-1.17.13 "$PARENT_BASE_COMMIT"
git -C opencode checkout bonsai/v1-on-opencode-1.17.13   # detached at the sealed tag; the replay branch itself is checked out in the worktree
git add opencode
git diff --cached --name-only   # must print exactly: opencode
git commit -m "chore: advance opencode pin to bonsai/v1-on-opencode-1.17.13" -m "Pin the opencode submodule to the sealed v1.17.13 replay tip (tag bonsai/v1-on-opencode-1.17.13) on the cycle's pin-advance working branch per forward-port-spec §2.9 step 3. Local only; no pushes until the pre-publish install gate passes."
```

**Step 2 — fresh-machine choice (machine-checkable).** If `sprite list` exits 0, use the sprite flow exactly as `docs/installation-e2e-template.md` writes it (bundle upload via `sprite exec --file`, commands via `sprite exec`). Otherwise use the local-clean-dir variant below, and record in the result that the run shared the host toolchain and host OpenCode auth.

**Step 3 — bundles and URL rewrite** (template §"Pre-publish", verbatim with this cycle's substitutions: parent path and working branch `pin-advance/opencode-1.17.13`). The `rm -f`/`rm -rf` lines are §1.10 rerun safety — stale bundles or config from a prior attempt must not leak into this run:

```bash
rm -rf /tmp/bundles
rm -f /tmp/rebase-e2e-gitconfig
mkdir -p /tmp/bundles
# Parent: bundle HEAD plus the pin-advanced working branch (NOT main). HEAD makes the clone
# check out a populated tree; parent must be on pin-advance/opencode-1.17.13 at this point.
git -C /home/basil/projects/context-bonsai-agents bundle create /tmp/bundles/context-bonsai-agents.git HEAD pin-advance/opencode-1.17.13
git -C /home/basil/projects/context-bonsai-agents/opencode bundle create /tmp/bundles/opencode.git --all
git -C /home/basil/projects/context-bonsai-agents/opencode_context_bonsai_plugin bundle create /tmp/bundles/opencode_context_bonsai_plugin.git --all
export GIT_CONFIG_GLOBAL=/tmp/rebase-e2e-gitconfig
git config --global url./tmp/bundles/.insteadOf https://github.com/Vibecodelicious/
# Local file:// submodule clones are refused by default since git 2.38 (CVE-2022-39253);
# the README's `git submodule update --init` needs this or it fails "transport 'file' not allowed".
git config --global protocol.file.allow always
```

Every `.gitmodules` URL is `https://github.com/Vibecodelicious/…` and every bundle file name matches its published URL tail, so this single `insteadOf` prefix rule redirects the parent clone and both submodule inits. Do not add per-repo or SSH (`git@github.com:`) rewrite rules — no owner artifact uses SSH URLs, and hand-rolled variants were run 4's defect.

**Step 4 — install and gate.** Create the clean working directory and run the plugin README's §"Installation" commands verbatim (the README is the artifact under test; if a README command fails or diverges, that is a FAIL finding — fix the README first, then re-run the gate — never substitute). The literal HTTPS clone URL resolves to the bundle via the rewrite. The one sanctioned insertion (template §"Run Mode"): `git checkout pin-advance/opencode-1.17.13` immediately after entering the clone, so the submodule init sees the pin-advanced tree.

```bash
INSTALL_DIR=$(mktemp -d /tmp/opencode-install-e2e-XXXXXX)
cd "$INSTALL_DIR"
git clone https://github.com/Vibecodelicious/context-bonsai-agents.git
cd context-bonsai-agents
git checkout pin-advance/opencode-1.17.13
git submodule update --init opencode opencode_context_bonsai_plugin
cd opencode
bun install
cd packages/opencode
bun run build
```

README global-config wiring — back up the real host config first (the local-clean-dir variant touches it), then write the README's config bound to this fresh clone's absolute plugin path:

```bash
cd "$INSTALL_DIR/context-bonsai-agents"
[ -f ~/.config/opencode/opencode.json ] && cp ~/.config/opencode/opencode.json "$INSTALL_DIR/opencode.json.pre-e2e"
mkdir -p ~/.config/opencode
python3 - <<'PY'
from pathlib import Path
Path.home().joinpath('.config/opencode/opencode.json').write_text('''{
  "$schema": "https://opencode.ai/config.json",
  "plugin": [
    "file://''' + str(Path.cwd() / 'opencode_context_bonsai_plugin/src/index.ts') + '''"
  ]
}
''')
PY
```

Tool registration (runbook Phase 3), from `$INSTALL_DIR/context-bonsai-agents/opencode`:

```bash
timeout 120 packages/opencode/dist/opencode-linux-x64/bin/opencode run \
  "List the names of all tools available to you, one per line, then stop." \
  --print-logs --log-level DEBUG 2>"$INSTALL_DIR/phase3.log" | tee "$INSTALL_DIR/phase3-stdout.txt"
grep -c 'context-bonsai-prune' "$INSTALL_DIR/phase3-stdout.txt"
grep -c 'context-bonsai-retrieve' "$INSTALL_DIR/phase3-stdout.txt"
```

Both greps must report at least 1. Smoke (runbook Phase 4), from the same directory:

```bash
BIN=packages/opencode/dist/opencode-linux-x64/bin/opencode
mkdir -p "$INSTALL_DIR/protocol-b"

timeout 120 $BIN run \
  "Tell me three detailed facts about octopuses. At least a paragraph each." \
  --print-logs --log-level DEBUG 2>"$INSTALL_DIR/protocol-b/step1.log"

timeout 120 $BIN run --continue \
  "That info about octopuses is no longer needed. Please use the context-bonsai-prune tool to archive those messages." \
  --print-logs --log-level DEBUG 2>"$INSTALL_DIR/protocol-b/step2.log"

$BIN export 2>/dev/null > "$INSTALL_DIR/protocol-b/export-pruned.json"
python3 -c "
import json, sys
data = json.load(open(sys.argv[1]))
print('\n'.join(m['info']['id'] for m in data['messages'] if m['info'].get('metadata', {}).get('opencode-context-bonsai')))
" "$INSTALL_DIR/protocol-b/export-pruned.json"
# Exactly one id must print; record it as <ANCHOR_ID>.

timeout 120 $BIN run --continue \
  "Use context-bonsai-retrieve with anchor_id <ANCHOR_ID> to restore the archived messages." \
  --print-logs --log-level DEBUG 2>"$INSTALL_DIR/protocol-b/step3.log"
```

Smoke passes if the prune and retrieve calls both return success outputs. Verdict per the install template: `PASS` / `FAIL` / `BLOCKED` with its reason codes. **Never publish on `FAIL` or `BLOCKED`**: `FAIL` → fix the README or install path, re-run the gate; `BLOCKED` → resolve the environmental precondition, re-run.

**Step 5 — teardown (local-clean-dir variant only).** Restore the host config and drop the scoped git config so later commands in this cycle see the real remotes again:

```bash
if [ -f "$INSTALL_DIR/opencode.json.pre-e2e" ]; then
  cp "$INSTALL_DIR/opencode.json.pre-e2e" ~/.config/opencode/opencode.json
else
  rm -f ~/.config/opencode/opencode.json
fi
unset GIT_CONFIG_GLOBAL
```

Sprite runs tear down per the template's Phase 5 instead (and still `unset GIT_CONFIG_GLOBAL` on the host if it was exported there).

**Step 6 — record the result (mandatory for every install-gate run, PASS or not).** From plugin (currently detached at the frozen commit):

```bash
git -C /home/basil/projects/context-bonsai-agents/opencode_context_bonsai_plugin switch -c install-e2e/opencode-1.17.13 b2ce708c88ff111cdbe5ea6e3bd150ba9fe8dd5a
# write docs/install-e2e-results-<DATE>.md per the install template's Result Recording fields:
# timestamp, sprite name or local-clean-dir statement, branch/commit pinned (pin-advance/opencode-1.17.13
# tip SHA and bonsai/v1-on-opencode-1.17.13 SHA), each install command + exit code + output snippet,
# tool-registration grep counts, smoke verdict, verdict + reason code, notable observations. No credentials.
git -C /home/basil/projects/context-bonsai-agents/opencode_context_bonsai_plugin add docs/install-e2e-results-<DATE>.md
git -C /home/basil/projects/context-bonsai-agents/opencode_context_bonsai_plugin commit -m "docs: record OpenCode v1.17.13 pre-publish install-gate result" -m "Result record for the pre-publish install gate run against parent branch pin-advance/opencode-1.17.13 per docs/installation-e2e-template.md Result Recording; required by forward-port-spec §4.2 Evidence paths."
```

**Step 7 — bump the plugin pin on the parent working branch.** The §4.2 Evidence-paths clause requires the parent working branch to carry this side-repo pin bump before §2.9 step 5. From parent (still on `pin-advance/opencode-1.17.13`):

```bash
git add opencode_context_bonsai_plugin
git diff --cached --name-only   # must print exactly: opencode_context_bonsai_plugin
git commit -m "chore: bump opencode_context_bonsai_plugin pin for install-gate record" -m "Advance the plugin submodule pin to the install-e2e/opencode-1.17.13 result-record commit so the working branch carries the install-gate evidence before the §2.9 step-5 pushes, per forward-port-spec §4.2 Evidence paths."
```

The fixed order is: gate runs against the opencode-pin-advanced branch (steps 3–4) → result artifact committed in the plugin side repo (step 6) → parent pin bump for the plugin submodule (step 7) → only then the Phase 8 pushes. The two post-gate commits add only the result record and its pin; they change nothing the gate validated.

### Phase 8: Publish Ladder and Parent Main Fast-Forward

Only after every prior gate passes, in §2.9 order:

- From worktree root: `git push --dry-run origin replay/context-bonsai-on-opencode-1.17.13` and `git push --dry-run origin refs/tags/bonsai/v1-on-opencode-1.17.13` (re-run; both exit 0), then:
  - `git push --force-with-lease origin replay/context-bonsai-on-opencode-1.17.13`
  - `git push origin refs/tags/bonsai/v1-on-opencode-1.17.13`
- From plugin: `git push origin install-e2e/opencode-1.17.13` (the side repo has a cycle commit — the result record — so this push is real, not the no-op case).
- From parent: `git push origin pin-advance/opencode-1.17.13`.
- From parent: `git switch main && git merge --ff-only pin-advance/opencode-1.17.13 && git push origin main`.

### Phase 9: Routine Maintenance (§1.16 — mandatory after seal or STOP)

- Write `.agents/pilot/gpt55-v1.17.13-maintenance.md`: changed slot-level facts (with the cycle's evidence cited), failure-attribution verdicts (`SPEC-GAP` / `EXECUTOR-FAIL`) for every stumble, and any core/shape gaps flagged for the owner tier.
- If a slot-level fact changed, edit only Part 4 of `docs/agent-specs/forward-port-spec.md`, after the cycle has sealed or stopped, and leave the edit uncommitted, naming the exact edited path in the final report (§1.16 disposition). If nothing changed, record that explicitly.

## Validation Commands

Grouped by working directory; the source of truth for implementation agents.

### Parent (`/home/basil/projects/context-bonsai-agents`)

- `git status --short` — only ` M tweakcc_context_bonsai` allowed beyond this cycle's own planned artifacts pre-commit
- `test "$(jq -c < .agents/plans/validation/replay-set-0dfbeeda7d8a273c52a564333c8179c68d6ab04d.json | sha256sum | cut -d' ' -f1)" = "136fb08d9854f92c5704e33dbf30aa3ebadefa01ddfe00d845fa9a237231c6f9"`
- `test "$(jq -c < .agents/plans/validation/manual-review-approvals-0dfbeeda7d8a273c52a564333c8179c68d6ab04d.json | sha256sum | cut -d' ' -f1)" = "32a9a2c71598593f5c0736b830d5c9518d5a847f4632a687d953caedab6cdddf"`
- `test "$(jq -c < .agents/plans/validation/exceptions-0dfbeeda7d8a273c52a564333c8179c68d6ab04d.json | sha256sum | cut -d' ' -f1)" = "37517e5f3dc66819f61f5a7bb8ace1921282415f10551d2defa5c3eb0985b570"`
- the four `jq -e` structural checks from Phase 6
- `test -f docs/agent-specs/forward-port-spec.md`
- `test -z "$(git diff --name-only -- docs/agent-specs/forward-port-spec.md)"`

### OpenCode Source Checkout (`/home/basil/projects/context-bonsai-agents/opencode`)

- `git rev-parse --verify refs/heads/replay/context-bonsai-on-opencode-1.15.7` → `0dfbeeda7d8a273c52a564333c8179c68d6ab04d`
- `git rev-parse --verify refs/tags/v1.17.13` → `10c894bdeef3618f5666fb506ef7f9491bb964d8`
- `git merge-base 10c894bdeef3618f5666fb506ef7f9491bb964d8 0dfbeeda7d8a273c52a564333c8179c68d6ab04d` → `6bee6ee7557072a81eed030edcf021acc0faf3c6`
- `git log --topo-order --reverse --format='%H|%P|%s' 10c894bdeef3618f5666fb506ef7f9491bb964d8..0dfbeeda7d8a273c52a564333c8179c68d6ab04d`
- `git log --name-status --find-renames --format='%H|%s' 10c894bdeef3618f5666fb506ef7f9491bb964d8..0dfbeeda7d8a273c52a564333c8179c68d6ab04d`
- `git cherry -v 10c894bdeef3618f5666fb506ef7f9491bb964d8 0dfbeeda7d8a273c52a564333c8179c68d6ab04d`
- `git log --merges 10c894bdeef3618f5666fb506ef7f9491bb964d8..0dfbeeda7d8a273c52a564333c8179c68d6ab04d` → empty

### Worktree (`/home/basil/projects/context-bonsai-agents/opencode/.agent_tmp/rebase-on-v1.17.13`)

- `test -d node_modules || bun install`
- From `packages/opencode`: `bun test test/tool/registry.test.ts test/session/message-v2.test.ts test/session/session.test.ts`
- From `packages/opencode`: `bun test test/session/context-bonsai.test.ts`
- From `packages/opencode`: `bun typecheck`
- From `packages/plugin`: `bun typecheck`
- From root: `bun turbo run build --filter=opencode`
- From root: `test "$(git merge-base 10c894bdeef3618f5666fb506ef7f9491bb964d8 HEAD)" = "10c894bdeef3618f5666fb506ef7f9491bb964d8"`
- From root: `test "$(git rev-list --count 10c894bdeef3618f5666fb506ef7f9491bb964d8..HEAD)" = "3"`
- From root: `test "$(git log --format='%b' 10c894bdeef3618f5666fb506ef7f9491bb964d8..HEAD | grep -cE '^\(cherry picked from commit [0-9a-f]{40}\)$')" = "3"`
- From root: `git diff --name-status 10c894bdeef3618f5666fb506ef7f9491bb964d8..HEAD`
- From root: the Phase 5 runtime e2e Protocol A and Protocol B blocks (bound from `docs/opencode-e2e-runbook.md`)
- From root: `git push --dry-run origin replay/context-bonsai-on-opencode-1.17.13`
- From root: `git push --dry-run origin refs/tags/bonsai/v1-on-opencode-1.17.13`

### Plugin (`/home/basil/projects/context-bonsai-agents/opencode_context_bonsai_plugin`)

- `git status --short` (clean at preflight; after Phase 7 step 6, exactly the committed result record on `install-e2e/opencode-1.17.13`)
- `git rev-parse HEAD` → `b2ce708c88ff111cdbe5ea6e3bd150ba9fe8dd5a` at preflight

## E2E Gate

- Authoritative runtime procedure: `docs/context-bonsai-e2e-template.md`, concretely bound by `docs/opencode-e2e-runbook.md`; install gate per `docs/installation-e2e-template.md` (pre-publish mode), same runbook binding.
- Required runtime scenarios: Protocol A (Secret Prune Oracle) and Protocol B (Retrieve Roundtrip) — the §4.2 required minimum; this cycle may not narrow it.
- Evidence paths: worktree `.agent_tmp/e2e-on-v1.17.13/protocol-a/` and `protocol-b/` (uncommitted); install-gate record `opencode_context_bonsai_plugin/docs/install-e2e-results-<DATE>.md` (committed, Phase 7 step 6).
- Credentials: `OPENCODE_PROVIDER`, `OPENCODE_MODEL`, `OPENCODE_API_KEY`, provisioned out of band, verified with `test -n`, never persisted or logged.
- Verdicts come from export/session/log evidence (secret non-leak, archive metadata, restoration), never from model assertions or green typechecks alone.
- COMPOSED runbook sequences get their first live run at these gates: a composed-command failure is a finding against the runbook — fix the runbook, then re-run the gate — not license to improvise a substitute (runbook §"Command provenance").

## Worktree Artifact Check

- Checked At: 2026-07-03 (generation; the executor re-runs the Phase 3 check immediately before its first edit).
- Parent planned target files: this plan and the three validation artifacts (created at generation; committed at plan approval); `baseline-0dfbeeda…​.json` (Phase 2); no collisions found — `.agents/plans/` and `.agents/plans/validation/` carry no `0dfbeeda…` artifacts before generation, and the parent's only dirty path is the enumerated ` M tweakcc_context_bonsai`.
- OpenCode planned target files: the seven non-dropped replay `target_paths` in the isolated worktree. `opencode/` status clean at generation; `TARGET_WORKTREE`, `TARGET_BRANCH`, and `TARGET_TAG_AT_TIP` all verified non-existent at generation (collision commands in Phase 1).
- Plugin planned target file: `docs/install-e2e-results-<DATE>.md` — plugin clean and detached at `b2ce708…` at generation; the branch `install-e2e/opencode-1.17.13` does not exist.
- Overlaps Found: none beyond the enumerated untouchable ` M tweakcc_context_bonsai`.
- Escalation Status: none.
- Decision Citation: `docs/meta-loop-direction.md` §"Next Step" decision record (owner branch-1 instruction, 2026-07-03) — item (1) authorizes this generation; item (2) authorizes handing the approved plan to the GPT-5.5 orchestrator.

## Plan Approval and Commit Status

- Approval Status: approved.
- Approval Citation: §1.15 loop closed at iteration 1 with zero blocking findings from both independent reviewers (reports recorded in Validation Loop Results, 2026-07-03); judge verdict APPROVE — `bonsai-judge <judge@context-bonsai.local>`, 2026-07-03: "the plan contains every §1.14-required section … and its Validation Loop Results section records a closed loop at iteration 1 with zero blocking findings", with the README manual-review row separately approved ("the row's wholesale-replacement resolution matches spec §2.3 … §2.5/§4.2"); refs mirrored in the approvals artifact (checksum above). Routine-path execution authority: `docs/meta-loop-direction.md` decision record items (1)–(2).
- Plan Commit Hash: the commit introducing this plan on parent `main` (a file cannot contain its own hash); the executor resolves and verifies it as `PARENT_BASE_COMMIT` via the Phase 7 step-1 `git ls-tree` check.
- Ready-for-Orchestration: yes (upon this plan's commit to parent `main`, which immediately follows this update).

## Validation Loop Results

- Iteration 0: generated from `docs/agent-specs/forward-port-spec.md` (Parts 1, 2, §4.2), `docs/opencode-e2e-runbook.md`, `docs/installation-e2e-template.md`, `opencode_context_bonsai_plugin/README.md` §Installation, and the archived run-4 plan's reviewer history (`.agents/pilot/archive/run4-v1.17.13/`). The three run-4 iteration-3 residuals are addressed at generation: the install-gate URL rewrite uses the template's single HTTPS prefix rule verbatim (no SSH rules, bundles at `/tmp/bundles`); the plugin pin-bump is bound as concrete commands (Phase 7 steps 6–7); the install-gate result ordering is a fixed numbered sequence (gate → result commit → pin bump → pushes).
- Iteration 1 missing-details review (independent reviewer, repository-inspecting): **zero blocking findings.** Verified live: frozen SHAs, all three artifact checksums, cherry/bucket agreement for all four rows, target-path unions against `git show --stat`, baseline test files present/absent as required, typecheck scripts non-empty, bun 1.3.14 pin match, all collision checks currently clean, plugin detached at the frozen commit, upstream `.opencode/opencode.jsonc` byte-match minus the plugin key, `.gitmodules` all-HTTPS (single `insteadOf` rule suffices), Protocol A/B and install-gate blocks transcribed verbatim from the runbook/README (checked line-by-line). Two non-blocking notes (baseline log path presented twice; "gitignored" claim wrong for the original sibling directory) — fixed: logs moved to the worktree's genuinely ignored `.agent_tmp/baseline/`, single path form.
- Iteration 1 ambiguity review (independent reviewer, repository-inspecting): **zero blocking findings.** The three run-4 residual classes checked explicitly and clean: template-verbatim single HTTPS `insteadOf` rule (parent `origin` being SSH is irrelevant — the gate clones the README's literal HTTPS URL), concrete pin-bump commands with fixed position, result-recording order stated once with no contradicting section. Two non-blocking notes — both applied: `PARENT_BASE_COMMIT` ls-tree check tightened to a `wc -l` equality; baseline table path form collapsed (same fix as above).
- Loop closed at iteration 1 per §1.15's early-stop rule (both passes returned zero blocking findings). Iterations run: 1.

## Completion Checklist

- [ ] Plan validation loop closed with zero blocking findings.
- [ ] Plan and validation artifacts committed before execution; `PARENT_BASE_COMMIT` verification passes.
- [ ] Replay-set, approvals, and exceptions checksums verified at preflight and unchanged at seal.
- [ ] Baseline artifact complete, no placeholders, r01 green, r02 missing-as-expected; baseline committed.
- [ ] Manual-review README row approved (reviewer+judge refs recorded); no unresolved manual-review rows.
- [ ] Exception ledger empty or all rows resolved with prior approval.
- [ ] Exactly three replay commits; provenance trailer count 3; diff scope equals the replay-set union; generated-artifact probe 0.
- [ ] Post-replay validation no worse than baseline; context-bonsai test passes.
- [ ] Runtime e2e Protocol A and Protocol B PASS with evidence on disk.
- [ ] Rebase-point tag at tip; push dry-runs green.
- [ ] Install gate PASS; result recorded on `install-e2e/opencode-1.17.13`; plugin pin bumped on the parent working branch before any push.
- [ ] Publish ladder executed in §2.9 order; parent `main` fast-forwarded and pushed.
- [ ] Spec-immutability gate passes.
- [ ] §1.16 maintenance report written (seal or STOP).
