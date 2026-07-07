# Hermes Agent Context Bonsai Spec

This is the contract half of the Hermes Agent document pair (`derivation-pipeline-spec.md` §6). At this point it carries the **Stage 2 posture record** — the Integration Posture stance, the Specified Implementation Direction, and the level-2 shape decision. Stage 3 expands it to the full eleven-section skeleton; the sibling bindings half is `hermes-agent-context-bonsai-bindings.md`.

## Integration Posture (Stage 2 posture record, 2026-07-07)

### Required architecture stance

- Hermes Context Bonsai MUST be implemented as a standalone plugin package in a `hermes_context_bonsai` side repository, loaded through Hermes's general plugin system (user `~/.hermes/plugins/` drop-in or pip entry point — bindings row 3) with no modification to the hermes-agent source tree. Hermes requires no fork.
- The port's core is a **context engine**: a `ContextEngine` subclass registered via the plugin API's `register_context_engine` and selected by `context.engine` in the user's config.yaml (bindings row 5 primitives). This is a plugin-only posture with no core seam — the decision rule's row-5-Verified branch (Kilo and Pi precedents), because Stage 2's resolution of the Stage 1 open question established that the context-engine interface is Hermes's native, plugin-reachable channel for authoritative transcript replacement: core calls the engine's `compress()` and itself performs the persisted rewrite (`archive_and_compact`) and the in-memory baseline rewrite around the returned list.
- Authoritative prune MUST flow through the engine `compress()` path. No component may write the transcript store behind the running loop's back or attempt to mutate `run_conversation`'s message locals: the bindings record why generic hooks and middleware cannot do this coherently, and any such bypass would desynchronize the loop's flush-identity tracking.
- Adopting the engine displaces Hermes's built-in `ContextCompressor`, so the port MUST also satisfy the engine's host duties: maintain the token-state fields `run_agent.py` reads, answer `should_compress()`, and keep `get_status()` accurate (bindings row 5 ABC citation).
- If a future capability genuinely cannot be delivered through the engine + plugin/middleware surfaces, a narrow core change is the last resort per the shared spec's Change-Minimization Rule, and the missing primitive MUST be identified before implementation.

### Prune and retrieve contract

- The model-facing tools MUST be `context-bonsai-prune` and `context-bonsai-retrieve`, exposed as engine tools via `get_tool_schemas()` and dispatched through `handle_tool_call`, which receives the live in-memory message list (bindings row 5). Tool names, input schemas, pattern-boundary semantics, ambiguity handling, and archive-record content follow the shared behavior contract; Stage 3 binds the details.
- A model-initiated prune records the decision when the tool call executes, and the transcript-affecting replacement is realized through the engine `compress()` path so core performs the persisted and in-memory rewrite. Whether that realization happens same-turn (engine-triggered `should_compress`) or at the next compaction boundary is a Stage 3/4 decision inside this stance.
- Retrieve returns archived content as the tool result; tombstone/no-op semantics follow the shared contract.

### Transcript mutation path

- Persisted replacement: core's in-place compaction around the engine's `compress()` return — non-destructive soft-archive plus compacted-set insert under the same session id (bindings rows 1 and 5). The port SHOULD require or document `compression.in_place: true`, since the rotation (legacy) path forks a child session id.
- Per-request presentation (placeholder rendering in the outgoing payload, if Stage 3 needs it beyond the persisted rewrite) MAY use `llm_request` middleware (bindings row 3), which is per-request only and never authoritative.

### System guidance path

- Standing Bonsai guidance reaches the model through the plugin-native channels: engine tool descriptions and the per-turn `pre_llm_call` append channel (bindings row 6). No plugin hook mutates the system prompt itself; Stage 3 decides the exact split, and if it finds these channels insufficient for a contract obligation, that is a posture defect to bring back here, not a reason to patch `system_prompt.py`.

### Gauge path

- Gauge input is native to the engine: `update_from_response(usage)` per API response plus the mandatory token-state fields (bindings rows 4 and 5). Delivery is in-band per the shared contract's locked bands; cadence and formatting bind at Stage 3.

## Specified Implementation Direction (Stage 2)

- **Preferred**: side-repo plugin package registering a Context Bonsai `ContextEngine` (prune/retrieve as engine tools, gauge from engine token state, guidance via tool descriptions + `pre_llm_call`), consumed by users as a plugin install plus two config lines (`context.engine`, plugin enable). Realizes every capability through surfaces the bindings verify (rows 3, 4, 5, 6).
- **Acceptable**: the same engine shipped in-repo under `plugins/context_engine/context_bonsai/` for development convenience, since Hermes resolves that directory first — but the published form is the side-repo plugin; an in-tree copy is a build artifact, not the source of truth.
- **Not acceptable**: patching hermes-agent core (contradicts row 5 Verified — no missing capability licenses a core seam under the Change-Minimization Rule); driving authoritative prune through `llm_request` middleware or direct `hermes_state` writes from generic hooks (bindings row 5 boundary: per-request-only, and loop locals are unreachable — desynchronizes flush-identity state); an external MCP-server-only port (row 2 would host the tools, but MCP tools cannot reach the engine surface that owns rewrite, gauge state, and compaction duty).

## Level-2 shape decision (Stage 2)

**Part 3 (release-medium binding), pure-extension variant** — the Pi precedent branch. Hermes-agent is an open-source Python package with no npm or PyPI registry artifact — its installer script produces a full git checkout at `$HERMES_HOME/hermes-agent`, so the git tag is the released unit; the harness fork carries no port code and no patch chain, so Part 2 has nothing to operate on. Per Part 3's intro, this record states what realizes the requirements its machinery phrases as patch application:

- **Upstream identity**: the upstream git release tag frozen to its commit SHA (detector family `git-remote-tag`), standing in for Part 3's npm-package-plus-tarball-integrity. Current frozen identity: tag `v2026.7.1`, SHA `7c1a0295…` (bindings header).
- **Patch application / anchor registry**: none — nothing is patched. The corresponding requirement is realized by the side-repo plugin's compatibility surface: the `ContextEngine` ABC, `register_context_engine`, the engine-selection config path, and the engine-tool dispatch contract (the bindings row 5 primitives). A release cycle re-verifies those seams against the new tag instead of re-deriving anchors.
- **Slot table**: Stage 6 binds Hermes into `forward-port-spec.md` Part 4 with this pure-extension realization recorded per slot.

*Deciding rows*: row 5 (Verified, native plugin surface — the posture-deciding row), rows 3/6 (plugin + guidance channels), row 4 (gauge). *Standing re-checkpoint*: this posture is re-validated at Stage 4's first integration contact; a seam the matrix calls usable that implementation cannot use reopens this record (pipeline spec §5).

## Key References

- `hermes-agent-context-bonsai-bindings.md` — the exploration-derived bindings half (capability matrix, verified primitives, weak areas).
- `derivation-pipeline-spec.md` §5 — the decision rule and gate this record satisfies.
- `forward-port-spec.md` Part 3 intro — the pure-extension variant this shape decision instantiates.
