# Kilo Context Bonsai Spec

## Purpose

This document specializes the shared Context Bonsai contract for Kilo CLI, the OpenCode-derived runtime under `context-bonsai-kilo/kilocode`.
Kilo is the strongest native-fit host in this workspace because it already exposes the core transform hooks bonsai needs. The main constraint is fork discipline: plugin-first, shared-core-touch only as a last resort.

## User Model

### User Gamut

- Kilo CLI users running long terminal sessions
- VS Code users relying on the bundled Kilo runtime through the extension
- maintainers minimizing divergence from upstream OpenCode
- operators who need bonsai behavior in the shared CLI engine, not in one UI shell only

### User-Needs Gamut

- full bonsai parity using existing native hooks where possible
- durable archive state aligned with Kilo session storage
- gauge visibility to the model without depending on UI-only status affordances
- minimal shared-core drift from upstream OpenCode

### Ambiguities From User Model

- Whether any Kilo-specific persistence or multi-session UX needs should diverge from upstream OpenCode behavior. This spec says no unless a concrete Kilo-only requirement forces it.

## Capability Evidence Matrix

| Area | Status | Notes |
|---|---|---|
| Persistent transcript | Verified | Session/message/part tables and session entries exist |
| Tool execution layer | Verified | Registry and execution wrapping exist |
| Message transform hook | Verified | `experimental.chat.messages.transform` exists |
| System transform hook | Verified | `experimental.chat.system.transform` exists |
| Token/context tracking | Verified | Usage and overflow checks exist |
| Upstream compatibility pressure | Verified | Repo explicitly minimizes divergence from OpenCode |

## Verified Host Primitives

- Session persistence is in [session.sql.ts](/home/basil/projects/context-bonsai-agents/context-bonsai-kilo/kilocode/packages/opencode/src/session/session.sql.ts) and [message-v2.ts](/home/basil/projects/context-bonsai-agents/context-bonsai-kilo/kilocode/packages/opencode/src/session/message-v2.ts).
- Tool registry and execution are in [tool/registry.ts](/home/basil/projects/context-bonsai-agents/context-bonsai-kilo/kilocode/packages/opencode/src/tool/registry.ts) and [tool/tool.ts](/home/basil/projects/context-bonsai-agents/context-bonsai-kilo/kilocode/packages/opencode/src/tool/tool.ts).
- Plugin hooks are declared in [packages/plugin/src/index.ts](/home/basil/projects/context-bonsai-agents/context-bonsai-kilo/kilocode/packages/plugin/src/index.ts).
- System transform is applied in [session/llm.ts](/home/basil/projects/context-bonsai-agents/context-bonsai-kilo/kilocode/packages/opencode/src/session/llm.ts).
- Message transform is applied in [session/prompt.ts](/home/basil/projects/context-bonsai-agents/context-bonsai-kilo/kilocode/packages/opencode/src/session/prompt.ts).

## Unverified Or Weak Areas

- The main uncertainty is not host capability; it is how to keep the Kilo fork aligned with upstream OpenCode while adding bonsai behavior.
- Kilo-specific products on top of the CLI may introduce extra UX expectations, but that should not force CLI-core divergence unless necessary.

## Integration Posture

### Required architecture stance

- Kilo Context Bonsai MUST be plugin-first.
- Shared core modifications are allowed only when a required capability cannot be expressed through the native plugin hooks.
- Any shared-core change SHOULD be isolated, minimal, and Kilo-marked per repo policy.
- Bonsai-specific logic SHOULD live in plugin-side code unless a tiny capability-enabling core seam is unavoidable.

### Prune and retrieve contract

- The model-facing tools MUST remain `context-bonsai-prune` and `context-bonsai-retrieve`.
- Archive state SHOULD be implemented in the same style as the OpenCode reference unless Kilo session differences require a narrow adaptation.

### Transcript mutation path

- Placeholder rendering and archived-range elision SHOULD be implemented entirely through `experimental.chat.messages.transform`.

### System guidance path

- Bonsai guidance SHOULD be injected through `experimental.chat.system.transform`.

### Gauge path

- Gauge SHOULD reuse Kilo's token usage and model limit data and be injected in-band through transcript transformation.

## Fail-Closed Requirements

- If required plugin hooks are unavailable at runtime, the plugin must return explicit compatibility errors.
- If a Kilo-only patch would create unnecessary upstream drift, the implementation plan must justify it explicitly.

## Parity Gaps Against Shared Spec

- Host capability gaps are minimal.
- The real constraint is fork-maintenance cost and minimizing divergence from shared OpenCode files.

## Specified Implementation Direction

- Preferred: direct port of the OpenCode bonsai design through Kilo's plugin hooks.
- Acceptable: narrow shared-core change only where plugin hooks are insufficient.
- Not acceptable: broad Kilo-only divergence in shared OpenCode runtime code without a proven blocker.

## E2E Priorities

- OpenCode-parity prune/retrieve/gauge scenarios in the Kilo CLI runtime
- persistence across session reload and client surfaces that reuse the CLI engine
- regression checks that shared-core modifications remain minimal

## Key References

- [session.sql.ts](/home/basil/projects/context-bonsai-agents/context-bonsai-kilo/kilocode/packages/opencode/src/session/session.sql.ts)
- [message-v2.ts](/home/basil/projects/context-bonsai-agents/context-bonsai-kilo/kilocode/packages/opencode/src/session/message-v2.ts)
- [registry.ts](/home/basil/projects/context-bonsai-agents/context-bonsai-kilo/kilocode/packages/opencode/src/tool/registry.ts)
- [tool.ts](/home/basil/projects/context-bonsai-agents/context-bonsai-kilo/kilocode/packages/opencode/src/tool/tool.ts)
- [packages/plugin/src/index.ts](/home/basil/projects/context-bonsai-agents/context-bonsai-kilo/kilocode/packages/plugin/src/index.ts)
- [AGENTS.md](/home/basil/projects/context-bonsai-agents/context-bonsai-kilo/kilocode/AGENTS.md)
