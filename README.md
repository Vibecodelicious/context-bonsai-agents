# Context Bonsai Agents

This repository is the planning workspace for cross-agent Context Bonsai work.

The goal is to define a shared behavioral contract for Context Bonsai, then specialize that contract per agent so each host can get an implementation plan that preserves the same user-facing behavior while minimizing upstream changes.

## What This Repo Contains

- A shared cross-agent spec in [docs/context-bonsai-agent-spec.md](/home/basil/projects/context-bonsai-agents/docs/context-bonsai-agent-spec.md)
- A generalized e2e template in [docs/context-bonsai-e2e-template.md](/home/basil/projects/context-bonsai-agents/docs/context-bonsai-e2e-template.md)
- Per-agent specs in [docs/agent-specs/README.md](/home/basil/projects/context-bonsai-agents/docs/agent-specs/README.md)

## Active Agent Targets

- `cline`
- `codex`
- `context-bonsai-kilo`
- `gemini-cli`

These agent directories are local source checkouts used for inspection and reference only. They are intentionally ignored by this planning repository.

## Working Rules

- Prefer plugin-side, extension-side, hook-side, or MCP-side delivery over upstream/core changes.
- Treat upstream/core seams as last resort capability enablers, not default implementation locations.
- Base every per-agent decision on repository evidence, not analogy.
- Keep behavioral parity model-visible: prune, retrieve, placeholders, guidance, and gauge matter more than code-level similarity.

## Current State

- Shared spec: drafted
- Generalized e2e template: drafted
- Per-agent specs: drafted for the active targets
- Deep-research seam resolution completed for Codex

## Intended Next Step

Use the shared spec plus the per-agent specs to create concrete implementation plans for each remaining target.
