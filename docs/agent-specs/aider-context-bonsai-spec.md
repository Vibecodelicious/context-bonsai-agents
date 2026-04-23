# Aider Context Bonsai Spec

## Purpose

This document specializes the shared Context Bonsai contract for Aider.
The target is behavioral parity where feasible, with the additional constraint that upstream changes should be minimized. Aider does not currently expose a proven general plugin or transcript-transform extension surface, so plans should assume that a small core seam may be required, but only after lighter-weight host-side options are ruled out.

## User Model

### User Gamut

- terminal-first Aider users running long repo sessions
- users relying on Aider's persistent chat history across restarts
- users switching among edit formats and model providers
- operators who need low-risk prompt surgery rather than broad agent redesign

### User-Needs Gamut

- prune stale history without losing recoverability
- preserve Aider's existing editing transports and repo-map behavior
- avoid brittle coupling to one edit format such as unified diff
- keep failures explicit when live prompt mutation cannot be guaranteed

### Ambiguities From User Model

- The transport used to implement the bonsai tools in Aider remains open, but the model-facing contract does not: the model must still see `context-bonsai-prune` and `context-bonsai-retrieve`.

## Capability Evidence Matrix

| Area | Status | Notes |
|---|---|---|
| Persistent history | Verified | Markdown chat history persists to `.aider.chat.history.md` and is reloadable |
| In-memory transcript assembly | Verified | `done_messages` and `cur_messages` are assembled into final prompt chunks |
| Native model tool plumbing | Partial | OpenAI-style function/tool plumbing exists, but function coders are currently deprecated |
| Transcript transform hook | Missing | No general plugin or middleware hook was found |
| System prompt injection point | Verified | System prompt and reminder construction are centralized in coder prompt assembly |
| Token accounting | Verified | Aider tracks token counts, model limits, and history summarization thresholds |

## Verified Host Primitives

- Chat history persists via [io.py](/home/basil/projects/context-bonsai-agents/aider/aider/io.py) and can be reconstructed from markdown.
- Final prompt construction happens through chat chunks in [chat_chunks.py](/home/basil/projects/context-bonsai-agents/aider/aider/coders/chat_chunks.py) and [base_coder.py](/home/basil/projects/context-bonsai-agents/aider/aider/coders/base_coder.py).
- Model calls flow through [models.py](/home/basil/projects/context-bonsai-agents/aider/aider/models.py), which already understands tool-style request envelopes.
- Aider already has its own history summarization path in [history.py](/home/basil/projects/context-bonsai-agents/aider/aider/history.py).

## Unverified Or Weak Areas

- There is no verified first-class transcript rewrite hook equivalent to OpenCode's message transform.
- The deprecated function-coder path means a bonsai tool contract cannot assume stable native tool registration without additional core work.
- The persisted markdown history is sufficient for recovery, but not automatically sufficient for authoritative in-memory transcript mutation.

## Integration Posture

### Required architecture stance

- Plugin-side or sidecar-side delivery SHOULD be preferred wherever Aider exposes a usable seam.
- Aider Context Bonsai MUST minimize upstream changes and use the smallest viable integration seam.
- The patch target is the prompt-construction and history-management path, not any single edit format.
- Editing transport and history-management transport MUST be treated as separate concerns.

### Prune and retrieve contract

- `context-bonsai-prune` and `context-bonsai-retrieve` remain the desired model-facing contract.
- If native tool registration proves unstable, the implementation MAY use alternate internal plumbing, but the model must still receive the exact `context-bonsai-prune` and `context-bonsai-retrieve` tool contract.

### Transcript mutation path

- The authoritative mutation point SHOULD be before the LLM payload is emitted from `format_chat_chunks` or equivalent prompt assembly.
- Persisted archive state SHOULD live separately from raw markdown chat history so retrieval is deterministic and does not require reparsing free-form summaries only.

### System guidance path

- Bonsai guidance SHOULD be injected through Aider's existing system/reminder prompt construction rather than through ad hoc user-message stuffing.

### Gauge path

- Gauge injection SHOULD happen during prompt assembly, ideally as reminder-style text attached to the active user-side prompt chunk.
- Token usage SHOULD reuse Aider's existing token counting and model-limit logic.

## Fail-Closed Requirements

- If prompt mutation cannot be applied for a turn, prune MUST fail with deterministic compatibility text.
- If archive persistence is unavailable, prune and retrieve MUST not pretend success.
- If gauge injection cannot be computed from known token data, the gauge remains silent.

## Parity Gaps Against Shared Spec

- Missing native transcript-transform hook is the largest gap.
- Native tool contract is not yet robust enough to assume plugin-style registration.
- Aider already summarizes history; the bonsai implementation must avoid fighting or duplicating that mechanism blindly.

## Specified Implementation Direction

- Preferred: prove first that no lighter-weight host-side seam can authoritatively mutate live prompt context, then use the smallest possible core patch in prompt assembly plus explicit archive state storage.
- Acceptable: wrapped command/tool hybrid if model-visible prune/retrieve semantics remain intact.
- Not acceptable: external sidecar only, because it cannot authoritatively rewrite live prompt context.

## E2E Priorities

- prune success against live prompt history
- retrieve roundtrip across Aider restart or session restore
- gauge visibility in model-facing prompt, not just token logs
- compatibility failure when patch points drift

## Key References

- [io.py](/home/basil/projects/context-bonsai-agents/aider/aider/io.py)
- [base_coder.py](/home/basil/projects/context-bonsai-agents/aider/aider/coders/base_coder.py)
- [chat_chunks.py](/home/basil/projects/context-bonsai-agents/aider/aider/coders/chat_chunks.py)
- [models.py](/home/basil/projects/context-bonsai-agents/aider/aider/models.py)
- [history.py](/home/basil/projects/context-bonsai-agents/aider/aider/history.py)
