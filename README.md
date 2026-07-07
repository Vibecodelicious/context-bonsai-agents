# Context Bonsai

Anyone who runs long sessions with an LLM coding agent knows the shape of a dying one. It gets slower, then sloppier, then starts making choices that only make sense if it had been reading a different conversation — and in a way, it has: the context is full of dead ends, stale plans, and tool output nobody needs anymore. Eventually auto-compaction arrives and replaces the session with a summary that is missing details you established hours ago.

Context Bonsai gives the model a better option. When a stretch of the conversation is finished — a debugging detour that has been closed out, forty pages of build output that served its purpose — the model archives it (a *prune*), leaving a short summary in its place. The conclusions stay in view, the dead weight leaves the prompt, and the full content can be pulled back later if it turns out to matter. Less like throwing out your notes, more like putting them in a labeled drawer.

It works today in several coding agents. OpenCode is the reference implementation and has had the most exercise; ports exist for Claude Code, Pi, Codex, Cline, and Kilo, each behaving the same way. The table under [Agent Harnesses](#agent-harnesses) says plainly how tested each one is.

## Why It Helps

Standard context overflow handling waits until the window is already under pressure, then compresses broadly — including details the model did not know would matter later. Context Bonsai is more selective:

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

**Verified** means the port was installed and exercised end to end in the target harness against the pinned upstream version and date shown.

Validation notes use [Protocol A](docs/context-bonsai-e2e-template.md#protocol-a-secret-prune-oracle) as the shared live prune/retrieve check. Pinned-target semantic patch evidence means the integration patch was checked against a recorded target host version and artifact, not against an unversioned local install.

| Agent harness | Status | Notes | Install and usage |
| --- | --- | --- | --- |
| OpenCode | Verified | Reference implementation on OpenCode `v1.17.13`; Protocol A passed 2026-07-07 UTC. Evidence: [`forward-port-spec` §3.6](docs/agent-specs/forward-port-spec.md) (the hardened protocol; durable public record of the re-verification). | [opencode-context-bonsai installation](https://github.com/Vibecodelicious/opencode_context_bonsai_plugin#installation) |
| Claude Code via tweakcc | Verified | Claude Code native `2.1.201`, verified 2026-07-05 via the tweakcc patch-application flow and MCP server. Install, prune/retrieve, marker persistence, resume, Protocol A, and pinned-target semantic patch evidence passed; gauge cadence was not driven live. Evidence: [`e2e-results-2026-07-05-2.1.201.md`](https://github.com/Vibecodelicious/tweakcc_context_bonsai/blob/main/docs/e2e-results-2026-07-05-2.1.201.md). | [tweakcc Context Bonsai installation](https://github.com/Vibecodelicious/tweakcc_context_bonsai#installation) |
| Pi | Verified | Standalone Pi extension — no Pi fork (the parent's `pi` submodule is a vanilla upstream checkout used for testing, carrying no port code); installs into Pi's user-global extension directory and loads from any working directory. Verified against Pi `0.73.1` on 2026-07-06: install, live prune, and secret-oracle recall passed. Evidence: [`binding-verification-0.73.1.md`](https://github.com/Vibecodelicious/pi_context_bonsai/blob/main/docs/binding-verification-0.73.1.md). | [Pi Context Bonsai installation](https://github.com/Vibecodelicious/pi_context_bonsai#installation) |
| Codex | Verified | Codex fork on upstream `rust-v0.125.0`, verified 2026-07-06: tool registration, ambiguity rejection, prune/retrieve, Protocol A, gauge cadence, and resume persistence passed. Evidence: [`e2e-results-2026-07-06-live.md`](https://github.com/Vibecodelicious/codex_context_bonsai/blob/feat/spec-compliance/docs/e2e-results-2026-07-06-live.md). | [Codex Context Bonsai installation](https://github.com/Vibecodelicious/codex_context_bonsai#installation) |
| Cline | Verified | Cline fork on upstream `v2.17.0-cli`, verified 2026-07-06: prune/retrieve, ambiguity rejection, resume persistence, gauge cadence, and Protocol A passed. The VS Code checkpoint-restore path remains manual. Evidence: [`e2e-results-2026-07-06-cline-2.17.0-live.md`](https://github.com/Vibecodelicious/cline_context_bonsai/blob/feat/spec-compliance/docs/e2e-results-2026-07-06-cline-2.17.0-live.md). | [Cline Context Bonsai installation](https://github.com/Vibecodelicious/cline_context_bonsai#installation) |
| Kilo | Verified | Kilo fork on Kilo `v7.2.20`, verified 2026-07-06 against a live Kilo CLI build: tool registration, prune/retrieve, and boundary rejection passed. Evidence: [`e2e-results-2026-07-06-live.md`](https://github.com/Vibecodelicious/kilo_context_bonsai/blob/feat/spec-compliance/docs/e2e-results-2026-07-06-live.md). | [Kilo Context Bonsai installation](https://github.com/Vibecodelicious/kilo_context_bonsai#installation) |

A Gemini CLI integration exists in a fork but has not been live-validated. It is not published as a usable port yet, so it is not listed above and no install path is offered.

## For Maintainers

Maintainer workflow, repo layout, patch-series rules, and documentation rules are in [DEVELOPMENT.md](DEVELOPMENT.md).

## Reference Material

The shared behavior contract and implementation references live under `docs/`:

- [Shared Context Bonsai agent spec](docs/context-bonsai-agent-spec.md)
- [Per-agent implementation specs](docs/agent-specs/README.md)
- [End-to-end validation template](docs/context-bonsai-e2e-template.md)
