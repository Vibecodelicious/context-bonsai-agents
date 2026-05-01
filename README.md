# Context Bonsai

Context Bonsai gives coding agents a way to manage long conversations without waiting for blunt overflow compaction. It lets the LLM archive older, completed parts of the transcript into compact placeholders, keep working with the important summary in view, and retrieve the full archived content later if it becomes relevant again.

OpenCode is the reference implementation. The other agent harness implementations follow the same shared behavior contract, but each one uses the integration points available in that harness.

## Why It Helps

Long coding sessions accumulate setup discussion, completed debugging paths, tool output, planning loops, and resolved implementation details. Standard context overflow handling usually waits until the window is already under pressure, then compresses broadly. That can lose details the model did not know would matter later.

Context Bonsai is more selective:

- The model can prune one contiguous range when it decides that range is stale enough to archive.
- The archive keeps a summary and index terms in the live transcript.
- The original content remains recoverable.
- Protected context, active goals, unresolved tasks, and current validation loops stay visible.

The result is lower context pressure with less disruption to the model's working state.

## How It Works

Context Bonsai exposes two model-facing operations:

- `context-bonsai-prune`: archives one contiguous message range using unique boundaries plus a model-written summary and index terms.
- `context-bonsai-retrieve`: restores an archived range by its anchor id.

After a prune, the archived range is represented by a placeholder like:

```text
[PRUNED: <anchor-id> to <range-end-id>]
Summary: <what was archived>
Index: <search terms for later retrieval>
```

The placeholder remains visible to the model, while the archived messages are hidden from the active prompt or marked inactive by the harness-specific implementation. Retrieval removes or clears that archive state so the original content becomes available again.

## How The LLM Uses It

Context Bonsai is designed for autonomous use by the model during a session.

The LLM receives guidance and, where the harness supports it, context-pressure gauge reminders. When pressure increases, the model should identify completed, low-risk ranges that are no longer needed in full detail. It should not prune system/developer instructions, the session goal, unresolved user requests, active implementation work, pending validation loops, or recent context that may still be needed.

The model should prune only after it has picked a safe contiguous range. It writes a concise summary and index terms so future retrieval decisions have enough information. If later work depends on archived details, the model can call `context-bonsai-retrieve` with the anchor id from the placeholder.

Pruning is non-destructive in the intended behavior model: archived content is hidden from active context, not treated as thrown away.

## Agent Harnesses

The main repo explains shared behavior. Harness-specific installation and usage lives in each side repo.

| Agent harness | Status | Install and usage |
| --- | --- | --- |
| OpenCode | Reference implementation | [opencode-context-bonsai installation](https://github.com/Vibecodelicious/opencode_context_bonsai_plugin#installation) |
| Claude Code via tweakcc | Tested Claude Code implementation | [tweakcc Context Bonsai installation](https://github.com/Vibecodelicious/tweakcc_context_bonsai#installation) |
| Cline | Warning: This Context Bonsai implementation has not yet been tested with its target agent harness. | [Cline Context Bonsai installation](https://github.com/Vibecodelicious/cline_context_bonsai#installation) |
| Codex | Warning: This Context Bonsai implementation has not yet been tested with its target agent harness. | [Codex Context Bonsai installation](https://github.com/Vibecodelicious/codex_context_bonsai#installation) |
| Gemini CLI | Warning: This Context Bonsai implementation has not yet been tested with its target agent harness. | [Gemini CLI Context Bonsai installation](https://github.com/Vibecodelicious/gemini-cli_context_bonsai#installation) |
| Kilo | Warning: This Context Bonsai implementation has not yet been tested with its target agent harness. | [Kilo Context Bonsai installation](https://github.com/Vibecodelicious/kilo_context_bonsai#installation) |

## Reference Material

The shared behavior contract and implementation references live under `docs/`:

- [Shared Context Bonsai agent spec](docs/context-bonsai-agent-spec.md)
- [Per-agent implementation specs](docs/agent-specs/README.md)
- [End-to-end validation template](docs/context-bonsai-e2e-template.md)

For maintainer workflow, see [DEVELOPMENT.md](DEVELOPMENT.md).
