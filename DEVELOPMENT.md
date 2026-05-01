# Development

This repo is the coordination point for shared Context Bonsai behavior across agent harnesses.

## Spec-First Workflow

The shared spec is authoritative. Behavior changes must land in the shared spec before implementation work is planned for individual harnesses.

Use this order:

1. Update the shared behavior contract in [`docs/context-bonsai-agent-spec.md`](docs/context-bonsai-agent-spec.md).
2. Update any affected per-agent notes in [`docs/agent-specs/`](docs/agent-specs/).
3. Generate implementation stories for each affected harness or side repo.
4. Implement each story against the updated spec.
5. Validate each implementation with the shared e2e expectations in [`docs/context-bonsai-e2e-template.md`](docs/context-bonsai-e2e-template.md).

Do not treat one harness implementation as the new contract by itself. If behavior should become shared, move it into the spec first, then bring implementations up to spec.

## Repo Classes

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

Side repos should use `origin` for the `Vibecodelicious` repo. They should not have `upstream`. Only `opencode_context_bonsai_plugin` and `tweakcc_context_bonsai` may also have a `local` remote that points to their earlier local source lineage.

## Documentation Rules

The root [`README.md`](README.md) owns the shared explanation of Context Bonsai. Side-repo READMEs should link back to it instead of duplicating that material.

Side-repo READMEs should focus on:

- installation and usage for that agent harness
- current tested or untested status
- harness-specific implementation notes
- links to the side repo's `DEVELOPMENT.md`

Side-repo `DEVELOPMENT.md` files should contain maintainer details, build/test commands, implementation boundaries, and links back to the shared spec.
