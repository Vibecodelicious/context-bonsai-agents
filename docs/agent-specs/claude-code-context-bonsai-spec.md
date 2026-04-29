# Claude Code Context Bonsai Spec

## Purpose

This document specializes the shared Context Bonsai contract for Anthropic's Claude Code (the CLI / IDE agent host). Unlike the other four ports, Claude Code is closed-source — there is no agent repo to fork or patch. The integration surface is exclusively MCP plus optional source-patching of the locally-installed Claude Code binary via the [`tweakcc`](https://github.com/Piebald-AI/tweakcc) Piebald-AI fork. The bonsai implementation lives in the [`tweakcc_context_bonsai/`](/home/basil/projects/context-bonsai-agents/tweakcc_context_bonsai) side repo (the `ccsnap` CLI plus the `context-bonsai` MCP server).

## User Model

### User Gamut

- Claude Code CLI users in long terminal/IDE sessions
- Users who can install MCP servers via `~/.claude/settings.json` but cannot modify Claude Code itself
- Users willing to apply the optional tweakcc patch for higher-fidelity transcript rendering
- Operators relying on Claude Code's session JSONL exports for resumption and audit

### User-Needs Gamut

- Deterministic prune/retrieve over Claude Code's persisted session JSONL
- Archive metadata that survives session reload, restart, and `claude --resume`
- Pattern-matching that reaches tool-call name, args, and output (per Pattern Matching Contract bullet 1, MUST since commit `9f1ca61`)
- Fail-closed behavior when the JSONL session file cannot be located or written
- Optional tweakcc patches for placeholder-rendering and gauge UI; functionality without the patches must still be correct (just less polished)

### Ambiguities From User Model

- Whether the gauge can be delivered in-band without a tweakcc patch. Claude Code does not expose a public token-budget API to MCP servers; in-band gauge delivery requires the patch or a workaround (e.g. injecting gauge text into prune/retrieve tool responses).
- Whether system guidance can be injected at all from MCP. Claude Code has no MCP-side system-prompt API; the prune/retrieve tool descriptions are the only model-visible MCP-controlled text. Guidance currently relies on the model's prior knowledge plus tool descriptions.

## Capability Evidence Matrix

| Area | Status | Notes |
|---|---|---|
| MCP tool registration | Verified | `~/.claude/settings.json` `mcpServers.<name>.command/args` registers stdio MCP servers |
| Persistent transcript | Verified | `~/.claude/projects/<project-hash>/<session-id>.jsonl` is append-only JSONL of `tool_use` / `tool_result` / text blocks |
| Session discovery from MCP | Verified | `/proc/<pid>` walk finds the parent Claude Code process; cmdline contains `--resume <session-id>` (see `src/lib/session.ts`) |
| In-band gauge | Partial | No public token-budget API. tweakcc patch can read internal state; otherwise gauge is delivered only as text inside prune/retrieve tool responses |
| System-guidance injection | Gap | No MCP-side system-prompt API. Tool descriptions are the only model-visible MCP-controlled text |
| Transcript mutation | Verified (with caveat) | The MCP server can rewrite the JSONL on disk to insert placeholder messages and mark archived ranges. The optional tweakcc `archivedFilter` patch hides archived ranges in the live transcript view |
| Archive persistence across resume | Verified | Archive marker file at `~/.claude/archived-<session-id>.json` is read by tweakcc's `archivedFilter` on session reload |

## Verified Host Primitives

- MCP server registration: `~/.claude/settings.json` `mcpServers.context-bonsai.{command,args}` — stdio MCP transport; tool names exposed as `mcp__context-bonsai__context-bonsai-prune` / `mcp__context-bonsai__context-bonsai-retrieve` per Claude Code's MCP-prefix convention.
- Session JSONL location: `~/.claude/projects/<project-hash>/<session-id>.jsonl`. Each line is one of `{ type: "user" | "assistant" | "summary", uuid, parentUuid, timestamp, message?, summary?, ... }`. See `tweakcc_context_bonsai/src/types.ts` for the canonical `SessionMessage` union.
- Process discovery: `/proc/<pid>` walk from the MCP server's parent process up the chain, parsing `cmdline` for `--resume <session-id>` to identify the live Claude Code session. See `tweakcc_context_bonsai/src/lib/session.ts:findCurrentSession` and `findSessionPath`.
- Archive marker file: `~/.claude/archived-<session-id>.json` — written by `addArchivedMarkerEntries` in `tweakcc_context_bonsai/src/lib/compact.ts`. Read by the optional tweakcc `archivedFilter` patch to hide archived ranges in the live transcript.

## Unverified Or Weak Areas

- No public token-budget API for the gauge. The tweakcc patch can extract internal state; without the patch, gauge delivery is restricted to text inside prune/retrieve tool responses (out-of-band of the natural prompt flow).
- No MCP-side system-prompt injection. The bonsai guidance text in the cross-agent spec §1 cannot be force-injected; it depends on tool-description text and the model's prior knowledge.
- Atomic JSONL rewrite under concurrent Claude Code writes is non-trivial. The MCP server uses `writeJsonlAtomic` (write-and-rename) but Claude Code may append between read and write. Failure mode is documented; mitigation is to perform prune/retrieve only when the model is paused (the natural state during a tool call).
- Claude Code may evolve its JSONL schema between versions. The MCP server depends on the current shape; a major Claude Code update could break it. The fail-closed contract requires the MCP server to detect schema drift and refuse to mutate.

## Integration Posture

### Required architecture stance

- Claude Code Context Bonsai MUST be MCP-first. There is no agent-repo to mirror; the MCP server is the only authoritative integration seam.
- The optional tweakcc patches (applied via `npx tweakcc --apply`) are RECOMMENDED but not required. The MCP server's behavior MUST be correct without the patches — the patches only improve placeholder-rendering fidelity and surface the gauge UI.
- All bonsai logic lives in the side repo (`tweakcc_context_bonsai`); Claude Code itself is never modified.

### Prune and retrieve contract

- Tool names: `context-bonsai-prune` and `context-bonsai-retrieve`, surfaced through MCP as `mcp__context-bonsai__context-bonsai-prune` and `mcp__context-bonsai__context-bonsai-retrieve` respectively (Claude Code's standard MCP-prefix format).
- Archive metadata MUST persist to `~/.claude/archived-<session-id>.json` so that tweakcc's `archivedFilter` patch (when applied) can hide archived ranges across session reloads.
- Per shared spec Pattern Matching Contract, the prune-wrapper filter on the ambiguity path MUST be implemented in `tweakcc_context_bonsai/mcp-server/index.ts` `loadSearchableMessages` / `resolveUniqueBoundary`. The current implementation flags messages whose `tool_use` block has `name === "context-bonsai-prune"` or `name === "mcp__context-bonsai__context-bonsai-prune"` and excludes them from the candidate set on ambiguity (see the_observer's `prune-call-filtering` story).
- Per shared spec Pattern Matching Contract bullet 1 (MUST since commit `9f1ca61`), `loadSearchableMessages` MUST include each tool call's name, input, and output in the searchable text. Claude Code's JSONL stores `tool_use` blocks with `{ id, name, input }` and `tool_result` blocks with `{ tool_use_id, content }`; the MCP server's `searchableText` walker MUST surface all three (name, input, output content) so pattern matching can target tool-call payloads — see `tweakcc_context_bonsai/mcp-server/index.ts` `searchableText`.

### Transcript mutation path

- The MCP server rewrites the live JSONL to insert a placeholder `summary`-typed entry replacing the archived range. See `markMessagesArchived` and `addArchivedMarkerEntries` in `tweakcc_context_bonsai/src/lib/compact.ts`.
- Without the tweakcc `archivedFilter` patch, the original archived `tool_use`/`tool_result` blocks remain in the JSONL and are visible in subsequent transcript loads. With the patch, they are hidden from the live transcript view.
- Atomic writes use `writeJsonlAtomic` (temp-file + rename). Claude Code's append-during-mutation race is mitigated by performing mutations only during MCP tool calls (when the model is paused).

### System guidance path

- Bonsai guidance is delivered via tool descriptions. Direct system-prompt injection is not available.
- Future enhancement: explore whether the tweakcc patch can inject system-instruction text without breaking Claude Code's update path.

### Gauge path

- Without tweakcc patch: gauge text is appended to prune/retrieve tool response bodies. This violates the cross-agent spec's "in-band" preference but is the only available channel.
- With tweakcc patch: gauge can be rendered in the Claude Code UI status line / sidebar, reading internal token-budget state.
- Cadence and severity bands match the cross-agent spec §7.

## Fail-Closed Requirements

- If the session JSONL cannot be located (no `/proc/<pid>` match, no `~/.claude/projects/.../<session-id>.jsonl`), the MCP tool MUST return a structured error and refuse to mutate.
- If the JSONL schema does not match the expected `SessionMessage` shape (e.g. major Claude Code version drift), the MCP tool MUST refuse to mutate and return a "compatibility error" per the cross-agent spec §"Compatibility error".
- If `~/.claude/archived-<session-id>.json` cannot be written (filesystem permissions, disk full), the MCP tool MUST roll back any partial JSONL mutation and return an error.
- Pattern ambiguity, after the prune-wrapper filter, MUST return the deterministic plain-text error verbatim per the cross-agent spec.

## Parity Gaps Against Shared Spec

- In-band gauge delivery without the tweakcc patch is best-effort (text in tool responses, not a separate signal).
- System guidance is constrained to tool descriptions; the cross-agent spec's six-bullet guidance contract (§1) is delivered partially via the tool description and the model's prior knowledge.
- No agent-repo to verify; behavior is validated entirely through end-to-end testing against a live Claude Code session.

## Specified Implementation Direction

- Preferred: MCP server in `tweakcc_context_bonsai/` ships standalone; tweakcc patch is a documented optional companion.
- Acceptable: shipping without the tweakcc patch but documenting reduced placeholder-rendering fidelity and out-of-band gauge.
- Not acceptable: depending on a tweakcc patch as a hard requirement; the MCP server alone must be functionally complete for prune/retrieve.

## E2E Priorities

- Prune/retrieve roundtrip on a real Claude Code session JSONL
- Pattern-matching by tool name, input, AND output across a transcript with diverse tool-use blocks
- Persistence: archive survives `claude --resume`
- Compatibility error on missing JSONL or schema drift
- Secret-prune oracle: pruned content is not recoverable from active context alone

See `tweakcc_context_bonsai/docs/e2e-protocol.md` for the canonical step-by-step procedure.

## Key References

- [tweakcc_context_bonsai/mcp-server/index.ts](/home/basil/projects/context-bonsai-agents/tweakcc_context_bonsai/mcp-server/index.ts) — MCP server entry; tool registration; prune/retrieve handlers
- [tweakcc_context_bonsai/src/lib/session.ts](/home/basil/projects/context-bonsai-agents/tweakcc_context_bonsai/src/lib/session.ts) — JSONL session loader, `/proc` discovery
- [tweakcc_context_bonsai/src/lib/compact.ts](/home/basil/projects/context-bonsai-agents/tweakcc_context_bonsai/src/lib/compact.ts) — `markMessagesArchived`, `addArchivedMarkerEntries`, `retrieveSession`
- [tweakcc_context_bonsai/src/types.ts](/home/basil/projects/context-bonsai-agents/tweakcc_context_bonsai/src/types.ts) — `SessionMessage`, `CompactMetadata`, `SummaryMessage`
- [tweakcc_context_bonsai/CC_BONSAI.md](/home/basil/projects/context-bonsai-agents/tweakcc_context_bonsai/CC_BONSAI.md), [PRD_CONTEXT_BONSAI_V2.md](/home/basil/projects/context-bonsai-agents/tweakcc_context_bonsai/PRD_CONTEXT_BONSAI_V2.md) — full design spec
- [tweakcc_context_bonsai/docs/e2e-protocol.md](/home/basil/projects/context-bonsai-agents/tweakcc_context_bonsai/docs/e2e-protocol.md) — end-to-end validation procedure
- [tweakcc Piebald-AI fork](https://github.com/Piebald-AI/tweakcc) — optional companion patch for placeholder-rendering and gauge UI
