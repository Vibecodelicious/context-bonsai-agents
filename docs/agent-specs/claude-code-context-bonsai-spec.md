# Claude Code Context Bonsai Spec

## Purpose

This document specializes the shared Context Bonsai contract for Anthropic's Claude Code (the CLI / IDE agent host). Unlike the other four ports, Claude Code is closed-source — there is no agent repo to fork or patch. The integration surface is MCP plus a transcript-rewrite seam in the locally-installed Claude Code binary via [`tweakcc`](https://github.com/Piebald-AI/tweakcc), or an equivalent seam. The bonsai implementation lives in the [`tweakcc_context_bonsai/`](/home/basil/projects/context-bonsai-agents/tweakcc_context_bonsai) side repo: the `context-bonsai` MCP server, tweakcc patch apply/restore tooling, and shared TypeScript libraries.

## User Model

### User Gamut

- Claude Code CLI users in long terminal/IDE sessions
- Users who can install MCP servers via `~/.claude.json` and can apply a local transcript-rewrite seam to Claude Code
- Users who need the tweakcc patch, or an equivalent seam, for the context-reduction guarantee
- Operators relying on Claude Code's session JSONL exports for resumption and audit

### User-Needs Gamut

- Deterministic prune/retrieve over Claude Code's persisted session JSONL
- Archive metadata that survives session reload, restart, and `claude --resume`
- Pattern-matching that reaches tool-call name, args, and output (per Pattern Matching Contract bullet 1, MUST since commit `9f1ca61`)
- Fail-closed behavior when the JSONL session file cannot be located or written
- A required transcript-rewrite seam that ensures archived follower messages are removed from the model-facing transcript

### Ambiguities From User Model

- Whether the gauge can be delivered in-band without a tweakcc patch. Claude Code does not expose a public token-budget API to MCP servers; in-band gauge delivery requires the patch or a workaround (e.g. injecting gauge text into prune/retrieve tool responses).
- Whether system guidance can be injected at all from MCP. Claude Code has no MCP-side system-prompt API; the prune/retrieve tool descriptions are the only model-visible MCP-controlled text. Guidance currently relies on the model's prior knowledge plus tool descriptions.

## Capability Evidence Matrix

| Area | Status | Notes |
|---|---|---|
| MCP tool registration | Verified | Story 7 confirmed current Claude Code 2.1.x uses `~/.claude.json`: top-level `mcpServers` is a map, and per-project entries under `projects` can also contain `mcpServers` maps. |
| Persistent transcript | Verified | `~/.claude/projects/<project-hash>/<session-id>.jsonl` is append-only JSONL of `tool_use` / `tool_result` / text blocks |
| Session discovery from MCP | Verified | `mcp-server/index.ts` walks `/proc/<pid>` to find the Claude Code ancestor process. Session id comes from `--resume <session-id>` when present; otherwise discovery falls back to a cwd-based match against `history.jsonl`, so it does not depend on `--resume`. The patch-presence guard identifies the running binary via each ancestor's `/proc/<pid>/exe`, independent of launch shape |
| In-band gauge | Partial | No public token-budget API. tweakcc patch can read internal state; otherwise gauge is delivered only as text inside prune/retrieve tool responses |
| System-guidance injection | Gap | No MCP-side system-prompt API. Tool descriptions are the only model-visible MCP-controlled text |
| Transcript mutation | Verified (with caveat) | The MCP server can rewrite the JSONL on disk to insert placeholder messages and mark archived ranges. A transcript-rewrite seam, currently the tweakcc `archivedFilter` patch or an equivalent, is required to hide archived ranges in the live transcript view |
| Archive persistence across resume | Verified | Archive marker file at `~/.claude/archived-<session-id>.json` is read by tweakcc's `archivedFilter` on session reload |

## Verified Host Primitives

- MCP server registration: `~/.claude.json` `mcpServers.context-bonsai.{command,args}` or per-project `projects.<project>.mcpServers.context-bonsai.{command,args}` — stdio MCP transport; tool names exposed as `mcp__context-bonsai__context-bonsai-prune` / `mcp__context-bonsai__context-bonsai-retrieve` per Claude Code's MCP-prefix convention.
- Session JSONL location: `~/.claude/projects/<project-hash>/<session-id>.jsonl`. Each line is one of `{ type: "user" | "assistant" | "summary", uuid, parentUuid, timestamp, message?, summary?, ... }`. See `tweakcc_context_bonsai/src/types.ts` for the canonical `SessionMessage` union.
- Process discovery: `/proc/<pid>` walk from the MCP server's parent process up the chain. Session discovery parses `cmdline` for `--resume <session-id>` when present, and otherwise falls back to a cwd-based `history.jsonl` match, so it works for directly-launched sessions with no `--resume`. The patch-presence guard identifies the running binary by reading each ancestor's `/proc/<pid>/exe` link, independent of `argv[0]` naming or `--resume`. See `tweakcc_context_bonsai/mcp-server/index.ts`.
- Archive marker file: `~/.claude/archived-<session-id>.json` — written by `addArchivedMarkerEntries` in `tweakcc_context_bonsai/src/lib/compact.ts`. Read by the required transcript-rewrite seam to hide archived ranges in the live transcript. Marker coverage MUST include every original archived-interval JSONL row with a string `uuid`, including UUID-bearing `type: "system"` rows such as `local_command`, `turn_duration`, and `away_summary`; the appended summary placeholder is outside the original interval and MUST NOT be added to the marker for that prune.

## Unverified Or Weak Areas

- No public token-budget API for the gauge. The tweakcc patch can extract internal state; without the patch, gauge delivery is restricted to text inside prune/retrieve tool responses (out-of-band of the natural prompt flow).
- No MCP-side system-prompt injection. The bonsai guidance text in the cross-agent spec §1 cannot be force-injected; it depends on tool-description text and the model's prior knowledge.
- Atomic JSONL rewrite under concurrent Claude Code writes is non-trivial. The MCP server uses `writeJsonlAtomic` (write-and-rename) but Claude Code may append between read and write. Failure mode is documented; mitigation is to perform prune/retrieve only when the model is paused (the natural state during a tool call).
- Claude Code may evolve its JSONL schema between versions. The MCP server depends on the current shape; a major Claude Code update could break it. The fail-closed contract requires the MCP server to detect schema drift and refuse to mutate.

## Integration Posture

### Required architecture stance

- Claude Code Context Bonsai MUST be MCP-first. There is no agent-repo to mirror; the MCP server is the only authoritative integration seam.
- A transcript-rewrite seam is REQUIRED for the context-reduction guarantee in the shared spec: after prune, archived follower messages must be omitted from the next model-facing transcript. The current seam is the tweakcc `archivedFilter` patch; an equivalent seam may satisfy the same requirement.
- The MCP server alone is not sufficient to guarantee context reduction. When the required seam is absent or cannot be verified, prune MUST fail closed with a deterministic plain-text error and MUST NOT write archive state.
- All bonsai logic lives in the side repo (`tweakcc_context_bonsai`); the local Claude Code install is modified only at the minimal transcript-rewrite seam needed to satisfy the shared spec.

### Prune and retrieve contract

- Tool names: `context-bonsai-prune` and `context-bonsai-retrieve`, surfaced through MCP as `mcp__context-bonsai__context-bonsai-prune` and `mcp__context-bonsai__context-bonsai-retrieve` respectively (Claude Code's standard MCP-prefix format).
- Archive metadata MUST persist to `~/.claude/archived-<session-id>.json` so that the transcript-rewrite seam can hide archived ranges across session reloads.
- Prune marker writes MUST include every string-`uuid` row from the original archived interval, not just `user`/`assistant` rows, because the provider-bound patch filters by `__cbMessage.uuid` after Claude Code maps some JSONL metadata rows into provider-visible entries.
- Retrieve MUST remove marker entries for the same restored inclusive interval derived from the summary `compactMetadata`, including UUID-bearing system/meta rows, while preserving unrelated marker entries from other pruned ranges.
- Per shared spec Pattern Matching Contract, the prune-wrapper filter on the ambiguity path MUST be implemented in `tweakcc_context_bonsai/mcp-server/index.ts` `loadSearchableMessages` / `resolveUniqueBoundary`. The current implementation flags messages whose `tool_use` block has `name === "context-bonsai-prune"` or `name === "mcp__context-bonsai__context-bonsai-prune"` and excludes them from the candidate set on ambiguity (see the_observer's `prune-call-filtering` story).
- Per shared spec Pattern Matching Contract bullet 1 (MUST since commit `9f1ca61`), `loadSearchableMessages` MUST include each tool call's name, input, and output in the searchable text. Claude Code's JSONL stores `tool_use` blocks with `{ id, name, input }` and `tool_result` blocks with `{ tool_use_id, content }`; the MCP server's `searchableText` walker MUST surface all three (name, input, output content) so pattern matching can target tool-call payloads — see `tweakcc_context_bonsai/mcp-server/index.ts` `searchableText`.

### Transcript mutation path

- The MCP server rewrites the live JSONL to insert a placeholder `summary`-typed entry replacing the archived range. See `markMessagesArchived` and `addArchivedMarkerEntries` in `tweakcc_context_bonsai/src/lib/compact.ts`.
- Without the transcript-rewrite seam, the original archived `tool_use`/`tool_result` blocks remain in the JSONL and are visible in subsequent transcript loads; prune must therefore fail closed before writing archive state. With the seam, they are hidden from the live transcript view.
- The tweakcc provider filter must hide all provider-bound rows inside the archived interval, including JSONL `type: "system"` metadata rows that the host maps through its provider-side `api_system` branch. Filtering only `user`/`assistant` rows can leave orphan provider `system` messages and violate Anthropic ordering rules.
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
- If the transcript-rewrite seam is absent or cannot be verified, the prune tool MUST return a deterministic plain-text error and MUST NOT write `~/.claude/archived-<session-id>.json` or mutate the session JSONL.
- If `~/.claude/archived-<session-id>.json` cannot be written (filesystem permissions, disk full), the MCP tool MUST roll back any partial JSONL mutation and return an error.
- Pattern ambiguity, after the prune-wrapper filter, MUST return the deterministic plain-text error verbatim per the cross-agent spec.
- Every deterministic prune/retrieve failure or refusal MUST be returned as an MCP result with `isError: true` so Claude Code does not render the refusal as a successfully-completed tool call. This sets the error flag only; the body stays plain text per the cross-agent spec §2 Output rules. The patch-presence guard that decides whether a prune may proceed MUST identify the running Claude binary independent of launch shape — directly-invoked version-named native binary, `claude` shim, or `claude --resume` — and MUST fail closed when no Claude ancestor binary can be identified.

## Patch-Anchor Evidence Requirements

- Claude Code patch anchors MUST be chosen by semantic analysis of the pinned target bundle, not by trusting a generic matcher. For each anchor, the implementation must explain which Claude Code behavior the code controls and why that behavior is the required seam.
- `archived-filter` must anchor to the actual provider-bound transcript visibility path. `message-content-ids` must anchor to the actual provider-bound message-content construction path. `context-bonsai-gauge` must anchor to the actual model-visible gauge/reminder/attachment paths required by its story.
- Required evidence must identify plausible nearby or similar-looking Claude Code candidates and explain why they are wrong; ambiguous or no-match cases must fail closed.
- Synthetic fixtures may test helper mechanics, but happy-path or made-up fixtures are not acceptance evidence for Claude Code anchor correctness. A check that only shows a sentinel appears exactly once is necessary but not sufficient, because the sentinel proves insertion at the selected location rather than semantic correctness of the selected anchor.
- Reviewers should report missing semantic anchor analysis, missing rejection of plausible wrong anchors, or reliance on synthetic fixtures/sentinel checks as HIGH findings by default, and CRITICAL findings when the evidence is used to claim the native Claude Code release gate passed.
- Fail-closed thresholds such as `minScore` and `minMargin` must remain mandatory; do not lower them or bypass ambiguity errors to make the pinned target pass.

## Parity Gaps Against Shared Spec

- In-band gauge delivery without the tweakcc patch is best-effort (text in tool responses, not a separate signal).
- System guidance is constrained to tool descriptions; the cross-agent spec's six-bullet guidance contract (§1) is delivered partially via the tool description and the model's prior knowledge.
- No agent-repo to verify; behavior is validated entirely through end-to-end testing against a live Claude Code session.

## Specified Implementation Direction

- Preferred: MCP server in `tweakcc_context_bonsai/` plus the tweakcc transcript-rewrite patch, with prune guarded by patch-presence verification.
- Acceptable: replacing the tweakcc patch with an equivalent transcript-rewrite seam that satisfies the shared spec's placeholder and follower-omission requirements.
- Not acceptable: shipping prune as successful when no transcript-rewrite seam is present; that silently leaves archived content in the model-facing transcript.

## E2E Priorities

- Prune/retrieve roundtrip on a real Claude Code session JSONL
- Pattern-matching by tool name, input, AND output across a transcript with diverse tool-use blocks
- Persistence: archive survives `claude --resume`
- Compatibility error on missing JSONL or schema drift
- Secret-prune oracle: pruned content is not recoverable from active context alone

See `tweakcc_context_bonsai/docs/e2e-protocol.md` for the canonical step-by-step procedure.

## Key References

- [tweakcc_context_bonsai/mcp-server/index.ts](/home/basil/projects/context-bonsai-agents/tweakcc_context_bonsai/mcp-server/index.ts) — MCP server entry; tool registration; prune/retrieve handlers
- [tweakcc_context_bonsai/src/lib/session.ts](/home/basil/projects/context-bonsai-agents/tweakcc_context_bonsai/src/lib/session.ts) — JSONL session loader and session path helpers
- [tweakcc_context_bonsai/src/lib/compact.ts](/home/basil/projects/context-bonsai-agents/tweakcc_context_bonsai/src/lib/compact.ts) — `markMessagesArchived`, `addArchivedMarkerEntries`, `retrieveSession`
- [tweakcc_context_bonsai/src/types.ts](/home/basil/projects/context-bonsai-agents/tweakcc_context_bonsai/src/types.ts) — `SessionMessage`, `CompactMetadata`, `SummaryMessage`
- [tweakcc_context_bonsai/README.md](/home/basil/projects/context-bonsai-agents/tweakcc_context_bonsai/README.md), [PRD_CONTEXT_BONSAI_V2.md](/home/basil/projects/context-bonsai-agents/tweakcc_context_bonsai/PRD_CONTEXT_BONSAI_V2.md) — operator docs and design background
- [tweakcc_context_bonsai/docs/e2e-protocol.md](/home/basil/projects/context-bonsai-agents/tweakcc_context_bonsai/docs/e2e-protocol.md) — end-to-end validation procedure
- [tweakcc](https://github.com/Piebald-AI/tweakcc) — patching tool used to provide the required transcript-rewrite seam
