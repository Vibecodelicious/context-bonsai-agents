# Epic: Context Bonsai Agent Ports

**Goal:** Produce implementation-ready plans for the remaining serious Context Bonsai targets in this workspace: Kilo, Gemini CLI, Codex, and Cline.
**Depends on:** Shared spec and per-agent specs under `docs/`
**Parallel with:** None
**Complexity:** High

## User Model

### User Gamut
- maintainers trying to land Context Bonsai across multiple agent runtimes without forking each host more than necessary
- operators who run long coding sessions and need prune/retrieve parity across different agent products
- downstream contributors who will execute these plans later and need precise target inventories, test commands, and failure semantics
- reviewers who care more about low-upstream-drift architecture than about one-off demos

### User-Needs Gamut
- concrete implementation plans that respect the shared behavioral contract while staying host-appropriate
- explicit separation between what can live plugin-side, hook-side, or MCP-side versus what truly needs a core seam
- plans that are independently executable and testable per agent
- staged delivery that yields demoable progress per host instead of a vague cross-agent roadmap

### Ambiguities From User Model
- Whether all four ports should expose identical user-facing ergonomics on day one. Resolution: preserve the shared prune/retrieve/gauge contract, but allow host-specific transport and rollout sequencing.

## Stories

### Story 1: Kilo/OpenCode plugin-first implementation plan
**Size:** Large
**Description:** Plan a plugin-first Kilo implementation that ports the OpenCode bonsai behavior with the least possible shared-core drift.
**Implementation Plan:** `.agents/plans/epic-context-bonsai-agent-ports/story-context-bonsai-agent-ports.1-kilo-plugin-first.md`

### Story 2: Gemini CLI hooks-plus-MCP implementation plan
**Size:** Large
**Description:** Plan a Gemini CLI implementation that uses runtime hooks for guidance/gauge, MCP or registry-backed tools for prune/retrieve, and only adds a core seam if hook fidelity proves insufficient.
**Implementation Plan:** `.agents/plans/epic-context-bonsai-agent-ports/story-context-bonsai-agent-ports.2-gemini-hooks-plus-mcp.md`

### Story 3: Codex hybrid implementation plan
**Size:** Large
**Description:** Plan a Codex implementation that keeps guidance and gauge outside core where possible, while adding the narrowest replacement-history core seam for authoritative prune/retrieve.
**Implementation Plan:** `.agents/plans/epic-context-bonsai-agent-ports/story-context-bonsai-agent-ports.3-codex-replacement-history.md`

### Story 4: Cline hybrid implementation plan
**Size:** Large
**Description:** Plan a Cline implementation that keeps hook-side guidance/gauge but extends the canonical history overwrite path for prune/retrieve.
**Implementation Plan:** `.agents/plans/epic-context-bonsai-agent-ports/story-context-bonsai-agent-ports.4-cline-canonical-history.md`

## Architecture Stance (epic-level)

Each port splits work between a new side-project submodule and the agent repo:

- Side-project submodules host the bulk of bonsai logic (plugin source, MCP server, Rust library, or extractable pure-logic helpers) plus project docs and coding standards.
- Agent repos receive only narrow capability-enabling seams (activation/bootstrap, hook-input extensions, replacement-history integration, canonical-history applier wiring).
- Docs for these projects live in the side repos, not in the agent repos.

Side-project submodules:

- `kilo_context_bonsai`
- `gemini-cli_context_bonsai`
- `codex_context_bonsai`
- `cline_context_bonsai`

## Parallelism Rule

- Projects (the four listed above) run in parallel.
- Stories within a given project run sequentially so that changes do not collide inside the same repositories.

## Dependencies and Integration

- Prerequisites:
  - [docs/context-bonsai-agent-spec.md](/home/basil/projects/context-bonsai-agents/docs/context-bonsai-agent-spec.md)
  - [docs/context-bonsai-e2e-template.md](/home/basil/projects/context-bonsai-agents/docs/context-bonsai-e2e-template.md)
  - per-agent specs under [docs/agent-specs/README.md](/home/basil/projects/context-bonsai-agents/docs/agent-specs/README.md)
- Enables:
  - per-agent implementation work with clear target inventories and validation commands
  - future e2e parity protocols and release-readiness checks
- Integration points (agent repos):
  - `/home/basil/projects/context-bonsai-agents/context-bonsai-kilo/kilocode`
  - `/home/basil/projects/context-bonsai-agents/gemini-cli`
  - `/home/basil/projects/context-bonsai-agents/codex`
  - `/home/basil/projects/context-bonsai-agents/cline`
- Integration points (side-project submodules):
  - `/home/basil/projects/context-bonsai-agents/kilo_context_bonsai`
  - `/home/basil/projects/context-bonsai-agents/gemini-cli_context_bonsai`
  - `/home/basil/projects/context-bonsai-agents/codex_context_bonsai`
  - `/home/basil/projects/context-bonsai-agents/cline_context_bonsai`

## Risks and Mitigations

- **Risk:** plans drift toward host-core-first despite the change-minimization rule.
  **Mitigation:** every story explicitly identifies the narrowest non-core path first and treats core seams as capability enablers only.
- **Risk:** target inventories are too vague to support mandatory worktree checks later.
  **Mitigation:** each story enumerates specific files to create or modify.
- **Risk:** testing commands are under-specified and later implementation becomes guesswork.
  **Mitigation:** each story lists exact validation commands by repo.

## Worktree Artifact Check (epic-level rollup)

- Checked At: 2026-04-23
- Planned Target Files: see story plans
- Overlaps Found: none at epic rollup level; all four target repos reported clean `git status --short` during planning
- Escalation Status: none
- Decision Citation: n/a

## Validation Loop Results

- Missing details check: pass after iterative story-level refinement
- Ambiguity check: pass after iterative story-level refinement
- Worktree artifact risk check: pass
- Plan-commit status check: approved at epic and story level; stories record commit hashes after this commit lands
- Iterations run: 5 (added architecture split plus side-project submodules on 2026-04-23)
