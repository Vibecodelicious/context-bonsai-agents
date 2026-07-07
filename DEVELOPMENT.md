# Development

This repo coordinates shared Context Bonsai behavior across agent harnesses. It owns the shared spec, per-agent specs, validation templates, harness submodule pins, and side-repo submodule pins.

## Spec-First Workflow

The shared spec is authoritative. Behavior changes must land in the shared spec before implementation work is planned for individual harnesses.

Use this order:

1. Update the shared behavior contract in [`docs/context-bonsai-agent-spec.md`](docs/context-bonsai-agent-spec.md).
2. Update any affected per-agent notes in [`docs/agent-specs/`](docs/agent-specs/).
3. Generate implementation stories for each affected harness or side repo.
4. Implement each story against the updated spec.
5. Validate each implementation with the shared e2e expectations in [`docs/context-bonsai-e2e-template.md`](docs/context-bonsai-e2e-template.md).

Do not treat one harness implementation as the new contract by itself. If behavior should become shared, move it into the spec first, then bring implementations up to spec.

## Repository Layout

Harness repos are the agent runtimes:

- `opencode`
- `cline`
- `codex`
- `gemini-cli`
- `kilo`

Harness remotes should use:

- `origin`: the `Vibecodelicious` fork
- `upstream`: the canonical upstream harness repo

Side repos are Context Bonsai projects owned by this workspace:

- `opencode_context_bonsai_plugin`
- `tweakcc_context_bonsai`
- `cline_context_bonsai`
- `codex_context_bonsai`
- `gemini-cli_context_bonsai`
- `kilo_context_bonsai`
- `pi_context_bonsai`
- `hermes_context_bonsai`

Published side repos should use `origin` for the `Vibecodelicious` repo. They should not have `upstream`. A temporary local-bare `origin` is acceptable only before the published remote is wired. Only `opencode_context_bonsai_plugin` and `tweakcc_context_bonsai` may also have a `local` remote that points to earlier local source lineage.

## Carrying Patches on Upstream

The current forward-port process is specified in [`docs/agent-specs/forward-port-spec.md`](docs/agent-specs/forward-port-spec.md) and [`docs/agent-specs/derivation-pipeline-spec.md`](docs/agent-specs/derivation-pipeline-spec.md); those specs govern how a cycle runs. The rest of this section is the manual background that process is built on.

Each harness fork carries a small chain of commits on top of the upstream harness's current release. The chain is typically two kinds:

- **Integration patches** — narrow host-side modifications that expose hooks the side-repo bonsai code depends on.
- **Fork-only doc commits** — for example, a signpost README on the fork's default branch that points readers at the bonsai-coordinated install path in the parent repo.

All commits in the chain rebase forward together each cycle; the doc commits are not separated out and do not lag the integration patches.

The fork's default branch is this chain on current upstream — rewritten every time we adopt a new upstream release. The pattern matches Debian's kernel patches and Asahi Linux's kernel fork: the branch ref means "our chain on current upstream," not "an immutable history."

### Per-Cycle Steps

For each harness fork, per upstream release adopted:

1. **Fetch upstream** in the harness fork (`git fetch upstream`) and identify the new release tag.
2. **Rebase the chain** onto the new upstream tag. Conflicts are usually surgical because the chain is small.
3. **Validate the rebased build.** Unit and integration tests in the harness must pass.
4. **Tag the rebase point** with a name that pins both versions, e.g., `bonsai/v1-on-opencode-0.5.34`. The tag gives the rebased state a durable name independent of the branch ref that will be rewritten again next cycle.
5. **Run Protocol A** from [`docs/context-bonsai-e2e-template.md`](docs/context-bonsai-e2e-template.md) against the rebuilt binary. A rebase conflict can resolve to passing type and unit tests while still breaking the host-side hooks Context Bonsai depends on. Protocol A is the load-bearing behavioral check against the freshly built binary.
6. **Advance the parent's submodule pin** to the new harness tip on a non-`main` working branch, locally. Do not push yet.
7. **Run the pre-publish install gate.** Run the installation e2e in pre-publish mode against the pin-advanced pair (see [`docs/installation-e2e-template.md`](docs/installation-e2e-template.md) "Run Mode"); nothing is pushed. `PASS` authorizes step 8. `FAIL` means fix the README or install path and re-run before any push. `BLOCKED` means the gate did not run (environmental precondition) — resolve it and re-run; never push on a `BLOCKED`.
8. **Publish.** Only after step 7 is `PASS`: force-push the harness branch with `--force-with-lease`, push the port's submodule, and push the parent working branch. The push is the point of no easy return, so it follows the gate, never precedes it.
9. **Fast-forward parent `main`** to the step-6 working-branch tip (now validated and pushed), then push `main`. Parent `main` advances only when steps 7 and 8 have completed — never on theory.

Steps 5 and 7 are distinct checks: step 5 proves the freshly built binary behaves; step 7 proves a clean machine can install the pinned pair from the documented README and reach that same behavior.

### Disciplines

- **Keep the chain clean.** Each commit is a single concern, properly separated and reviewable on its own. No fix or fixup commits: if a rebase exposes a problem with a commit, fold the correction into the commit that introduced it.
- **The harness fork's default branch is intentionally git-history-unstable.** Anyone bookmarking a specific commit should use the tag from step 4 instead of the branch ref.
- **Preserve retired chains with descriptive branch names** like `surgical_compaction_pre_plugin` when replacing an old chain. Don't rely on GC reachability for commits someone might want to revisit.

## Documentation Rules

The root [`README.md`](README.md) owns the shared explanation of Context Bonsai. Side-repo READMEs should link back to it instead of duplicating that material.

Side-repo READMEs should focus on:

- installation and usage for that agent harness
- current tested or untested status
- harness-specific implementation notes
- links to the side repo's `DEVELOPMENT.md`

Side-repo `DEVELOPMENT.md` files should contain maintainer details, build/test commands, implementation boundaries, and links back to the shared spec.

## AI Self-Maintenance

The ports are kept current by an AI self-maintenance system that forward-ports Context Bonsai onto new upstream releases. The loop detects a new upstream release and checks whether the harness is due (`scripts/detect-pending-target.mjs`, `scripts/check-cycle-cadence.mjs`), starts a cycle and seeds its intent log (`scripts/invoke-routine-cycle.mjs`), wakes on schedule (`scripts/routine-wake.sh`), and escalates when a cycle needs a human (`scripts/dispatch-escalation.mjs`). The routine path and its cadence gate are specified in [`docs/agent-specs/forward-port-spec.md`](docs/agent-specs/forward-port-spec.md) §1.20–§1.21. For the full agent-facing process, see [`docs/agent-specs/README.md`](docs/agent-specs/README.md).

## Backlog

- Automated e2e test for per-agent user-installation instructions.
- Automated propagation of spec changes from the main spec to per-agent specs.
- Submodule `opencode_context_bonsai_plugin`: clean commit history rewrite.
