# Context Bonsai

Context Bonsai gives coding agents a way to manage long conversations without waiting for blunt overflow compaction. It lets the LLM archive older, completed parts of the transcript into compact placeholders, keep working with the important summary in view, and retrieve the full archived content later if it becomes relevant again.

OpenCode is the reference implementation. Other harness implementations follow the same shared behavior contract using the integration points available in each host.

## Why It Helps

Long coding sessions accumulate setup discussion, completed debugging paths, tool output, planning loops, and resolved implementation details. Standard context overflow handling usually waits until the window is already under pressure, then compresses broadly. That can lose details the model did not know would matter later.

Context Bonsai is more selective:

- The model can prune contiguous ranges (one per call, as often as it wants) when it decides those ranges are stale enough to archive.
- The archive keeps a summary and index terms in the live transcript.
- The original content remains recoverable.
- Protected context, active goals, unresolved tasks, and current validation loops stay visible.

The result is lower context pressure with less disruption to the model's working state.

## How It Works

Most coding agents keep a transcript of the session: user messages, assistant messages, tool calls, and tool results. Before each model request, the harness turns that transcript into the prompt sent to the LLM. Context Bonsai works at that harness layer by replacing selected older transcript ranges with compact summary placeholders in the transcript that gets sent to the LLM while keeping the original transcript content recoverable.

Context Bonsai exposes two model-facing operations:

- `context-bonsai-prune`: archives one contiguous transcript range. The model supplies `from_pattern` and `to_pattern` text selectors; each selector must match exactly one message. The inclusive range between those two messages is then hidden from active context and represented by a summary placeholder.
- `context-bonsai-retrieve`: makes a previously pruned range visible to the model again. The model supplies the anchor id from the placeholder, and Context Bonsai clears the archive marker for that range.

The selector requirement matters. A vague selector like `the tests failed` might appear in several messages, so the prune is rejected instead of guessing. The model has to choose specific text from the first and last messages it wants to archive, such as a distinctive command, error line, task title, or sentence.

After a prune, the archived range is represented by a placeholder like:

```text
[PRUNED: <anchor-id> to <range-end-id>]
Summary: <what was archived>
Index: <search terms for later retrieval>
```

The placeholder remains visible to the model while the archived messages are left out of the transcript that gets sent to the LLM. Retrieval removes that archive marker so the original messages can appear in context again.

## How The LLM Uses It

Context Bonsai is designed for autonomous use by the model during a session.

The LLM receives guidance and, where the harness supports it, context-pressure gauge reminders. When pressure increases, the model should identify completed, low-risk ranges that are no longer needed in full detail. It should not prune system/developer instructions, the session goal, unresolved user requests, active implementation work, pending validation loops, or recent context that may still be needed.

The model should prune only after it has picked a safe contiguous range. It writes a concise summary and index terms so future retrieval decisions have enough information. If later work depends on archived details, the model can call `context-bonsai-retrieve` with the anchor id from the placeholder.

Pruning is non-destructive in the intended behavior model: archived content is hidden from active context, not treated as thrown away.

## Agent Harnesses

This repo explains shared behavior. Harness-specific installation, verification, and security notes live in each side repo.

Status meanings:

- **Verified**: installed and exercised end to end in the target harness.
- **Untested**: implementation work exists, but target-harness behavior has not been verified.

Validation notes use [Protocol A](docs/context-bonsai-e2e-template.md#protocol-a-secret-prune-oracle) as the shared live prune/retrieve check. Pinned-target semantic patch evidence means the integration patch was checked against a recorded target host version and artifact, not against an unversioned local install.

| Agent harness | Status | Notes | Install and usage |
| --- | --- | --- | --- |
| OpenCode | Verified | Reference implementation. | [opencode-context-bonsai installation](https://github.com/Vibecodelicious/opencode_context_bonsai_plugin#installation) |
| Claude Code via tweakcc | Verified | Native Claude Code `2.1.143` was exercised end to end with the tweakcc 4.0 patch-application flow and MCP server. Install wiring, prune/retrieve, marker persistence, resume handling, Protocol A, and pinned-target semantic patch evidence passed. Gauge E2E was not exercised. | [tweakcc Context Bonsai installation](https://github.com/Vibecodelicious/tweakcc_context_bonsai#installation) |
| Pi | Verified | A standalone Pi extension — no Pi fork. Installs into Pi's user-global extension directory and loads from any working directory. Pruning confirmed end to end against a live model. | [Pi Context Bonsai installation](https://github.com/Vibecodelicious/pi_context_bonsai#installation) |
| Codex | Verified | Integrated into the Codex fork. A live logged-in test environment verified tool registration, ambiguity rejection, prune/retrieve, and Protocol A. Gauge cadence was not exercised. | [Codex Context Bonsai installation](https://github.com/Vibecodelicious/codex_context_bonsai#installation) |
| Gemini CLI | Untested | Integrated into the Gemini CLI fork. Running a verification needs a Gemini API key or Google sign-in. | [Gemini CLI Context Bonsai installation](https://github.com/Vibecodelicious/gemini-cli_context_bonsai#installation) |
| Cline | Untested | Integrated into the Cline fork. Cline runs as a VS Code extension; there is no automated way to verify it yet. | [Cline Context Bonsai installation](https://github.com/Vibecodelicious/cline_context_bonsai#installation) |
| Kilo | Untested | Integrated into the Kilo fork. Kilo includes an OpenCode-derived CLI runtime used by its VS Code surfaces; live target-harness verification has not run yet. | [Kilo Context Bonsai installation](https://github.com/Vibecodelicious/kilo_context_bonsai#installation) |

## For Maintainers

Maintainer workflow, repo layout, patch-series rules, and documentation rules are in [DEVELOPMENT.md](DEVELOPMENT.md).

## Reference Material

The shared behavior contract and implementation references live under `docs/`:

- [Shared Context Bonsai agent spec](docs/context-bonsai-agent-spec.md)
- [Per-agent implementation specs](docs/agent-specs/README.md)
- [End-to-end validation template](docs/context-bonsai-e2e-template.md)
