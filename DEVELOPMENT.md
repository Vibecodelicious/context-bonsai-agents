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

Published side repos should use `origin` for the `Vibecodelicious` repo. They should not have `upstream`. A temporary local-bare `origin` is acceptable only before the published remote is wired. Only `opencode_context_bonsai_plugin` and `tweakcc_context_bonsai` may also have a `local` remote that points to earlier local source lineage.

## Carrying Patches on Upstream

Each harness fork carries a small set of integration patches on top of the upstream harness's current release. The fork's default branch is the patch series on current upstream — rewritten every time we adopt a new upstream release. The pattern matches Debian's kernel patches and Asahi Linux's kernel fork: the branch ref means "our patches on current upstream," not "an immutable history."

### Per-Cycle Steps

For each harness fork, per upstream release adopted:

1. **Fetch upstream** in the harness fork (`git fetch upstream`) and identify the new release tag.
2. **Rebase the patch series** onto the new upstream tag. Conflicts are usually surgical because the patch series is small.
3. **Validate the rebased build.** Unit and integration tests in the harness must pass.
4. **Tag the rebase point** with a name that pins both versions, e.g., `bonsai/v1-on-opencode-0.5.34`. The tag gives the rebased state a durable name independent of the branch ref that will be rewritten again next cycle.
5. **Run Protocol A** from [`docs/context-bonsai-e2e-template.md`](docs/context-bonsai-e2e-template.md) against the rebuilt binary. A rebase conflict can resolve to passing type and unit tests while still breaking the host-side hooks Context Bonsai depends on. Protocol A is the load-bearing check before publishing.
6. **Force-push the harness branch** with `--force-with-lease`.
7. **Advance the parent's submodule pin** to the new harness tip on a non-`main` working branch.
8. **End-to-end-validate the submodule pair.** Clone the parent on a fresh machine, follow the published install README, run Protocol A against the binary built from the parent's pinned state. This is the "thoroughly tested" gate.
9. **Fast-forward parent `main`** to the validated pin advance. Parent `main` advances only when step 8 has passed — never on theory.

### Disciplines

- **Keep the patch series clean.** Each commit is a single concern, properly separated and reviewable on its own. No fix or fixup commits: if a rebase exposes a problem with a patch, fold the correction into the patch that introduced it.
- **The harness fork's default branch is intentionally git-history-unstable.** Anyone bookmarking a specific commit should use the tag from step 4 instead of the branch ref.
- **Preserve retired chains with descriptive branch names** like `surgical_compaction_pre_plugin` when replacing an old patch series. Don't rely on GC reachability for commits someone might want to revisit.

## Documentation Rules

The root [`README.md`](README.md) owns the shared explanation of Context Bonsai. Side-repo READMEs should link back to it instead of duplicating that material.

Side-repo READMEs should focus on:

- installation and usage for that agent harness
- current tested or untested status
- harness-specific implementation notes
- links to the side repo's `DEVELOPMENT.md`

Side-repo `DEVELOPMENT.md` files should contain maintainer details, build/test commands, implementation boundaries, and links back to the shared spec.

## Backlog

- Automated per-agent rebase/re-implementation to make sure Context Bonsai works on the latest release of each supported agent.
- Forward-port planning contract: before implementing a port against a new host release, require the parent epic to pin the exact target release and define reproducible validation artifacts. For patched, minified, or closed-source hosts, the plan must record the host version/platform, extraction tool/version, reproduction command, artifact checksum, and evidence expected from that artifact. Local installs may be used only to recreate the pinned target artifact, not as ambient truth; credentials must never be part of validation artifacts.
- Automated e2e test for per-agent user-installation instructions.
- Automated propagation of spec changes from the main spec to per-agent specs.
- Submodule `opencode_context_bonsai_plugin`: clean commit history rewrite.
