# Context Bonsai Agents

This repository is the planning workspace for cross-agent Context Bonsai work.

The goal is to define a shared behavioral contract for Context Bonsai, then specialize that contract per agent so each host can get an implementation plan that preserves the same user-facing behavior while minimizing upstream changes.

## What This Repo Contains

- A shared cross-agent spec in [docs/context-bonsai-agent-spec.md](/home/basil/projects/context-bonsai-agents/docs/context-bonsai-agent-spec.md)
- A generalized e2e template in [docs/context-bonsai-e2e-template.md](/home/basil/projects/context-bonsai-agents/docs/context-bonsai-e2e-template.md)
- Per-agent specs in [docs/agent-specs/README.md](/home/basil/projects/context-bonsai-agents/docs/agent-specs/README.md)

## Active Agent Targets

Each target has a tracked agent submodule (the host source) plus a side submodule (`<agent>_context_bonsai/`) where bonsai logic lives:

- `cline` + `cline_context_bonsai` (TypeScript, native tool registration)
- `codex` + `codex_context_bonsai` (Rust, narrow core seam + side crate)
- `kilo` + `kilo_context_bonsai` (TypeScript, OpenCode-style plugin)
- `gemini-cli` + `gemini-cli_context_bonsai` (TypeScript, hooks-first + MCP-assisted)
- Claude Code (closed-source) — `tweakcc_context_bonsai/` ships the `ccsnap` CLI plus the `context-bonsai` MCP server. There is no agent submodule for Claude Code; the optional [tweakcc Piebald-AI fork](https://github.com/Piebald-AI/tweakcc) is applied separately by users.

## Working Rules

- Prefer plugin-side, extension-side, hook-side, or MCP-side delivery over upstream/core changes.
- Treat upstream/core seams as last resort capability enablers, not default implementation locations.
- Base every per-agent decision on repository evidence, not analogy.
- Keep behavioral parity model-visible: prune, retrieve, placeholders, guidance, and gauge matter more than code-level similarity.

## Current State

- Shared spec at [docs/context-bonsai-agent-spec.md](/home/basil/projects/context-bonsai-agents/docs/context-bonsai-agent-spec.md): authoritative; Pattern Matching Contract bullet 1 upgraded to MUST at commit `9f1ca61`.
- Per-agent specs: complete for all five targets (Cline, Codex, Kilo, Gemini, Claude Code).
- v1 ports closed: Cline (`1a44e64`), Codex (`31bbc92`), Gemini (`fd38ad7`), Kilo (`8684602`).
- Spec-compliance epic closed: K1/K2, C1/C2/C3, CO1/CO2, G1/G2 — all 9 stories APPROVED AS-IS, work pinned on `feat/spec-compliance` branches in each submodule pair.
- tweakcc (Claude Code): v0.1.0 initial release in `tweakcc_context_bonsai/` (extracted from `the_observer`); deterministic test coverage for E2E-01/02/03, partial E2E-05; live E2E-04/06/07 deferred to user-driven runs per `tweakcc_context_bonsai/docs/e2e-protocol.md`.

## Intended Next Step

- Drive the deferred E2E-04/06/07 scenarios for tweakcc.
- Address the 21 pre-existing typecheck errors in `tweakcc_context_bonsai/src/lib/compact.ts` for a v0.2.0 cut.
- Decide which v1+spec-compliance branches in the four agent submodules merge upstream vs. stay forked.
