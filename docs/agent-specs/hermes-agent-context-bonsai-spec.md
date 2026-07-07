# Hermes Agent Context Bonsai Spec

## Purpose

This document specializes the shared Context Bonsai contract (`../context-bonsai-agent-spec.md`) for Hermes Agent, a Python CLI agent from Nous Research.
Hermes is a strong fit for a pure plugin implementation because it exposes a native pluggable **context engine**: a plugin-registered `ContextEngine` subclass becomes the harness's authoritative compaction component — core itself performs the persisted transcript rewrite and the in-memory baseline rewrite around the engine's `compress()` return, engine-declared tools join the session tool catalog, and the engine owns the token-gauge state the loop reads. The main implementation constraints are not host capability; they are the duties that come with displacing the built-in compressor (see Compaction Duty Displacement below) and the fact that the in-memory message list the engine works on is an id-less OpenAI-format sequence.

This is the **contract half** of the per-harness spec pair: the obligations and posture decisions that change only when the product's behavior contract changes or an integration-posture re-run revises them. The structural facts that realize these obligations — harness file paths, function names, storage locations — live in the sibling [`hermes-agent-context-bonsai-bindings.md`](hermes-agent-context-bonsai-bindings.md) and are referenced here by `binding: <key>`; the bindings document is the derivation pipeline's rewritable layer (`derivation-pipeline-spec.md` §2.2) and may change without an edit here so long as each referenced obligation still holds.

## User Model

### User Gamut

- Hermes CLI users running long coding or research sessions in the terminal REPL or through the gateway/TUI/ACP servers
- Hermes plugin authors using bonsai as the worked example of a plugin-registered context engine
- security-minded operators auditing what a plugin that owns transcript compaction reads and persists
- release-gate reviewers who need model-visible evidence rather than UI-only status

### User-Needs Gamut

- surgical context reclamation without losing recoverability, in a harness whose only built-in relief is summarizing compaction
- durable archive state across `/resume`, session switching, and process restart (Hermes persists sessions in a canonical SQLite store)
- pattern matching over message text and tool-call structures, not text-only transcripts
- gauge signals delivered in-band to the model
- installation as a plugin plus config edit, with no modification to the Hermes source tree

### Ambiguities From User Model

- Whether the port should implement the shared contract's same-step retrieve guard (a SHOULD). This spec adopts the guard: prune realization is deferred to the compaction boundary (see Prune and retrieve contract), so a same-step retrieve would race its own prune's realization; rejecting it deterministically is the simpler and safer behavior.
- What users who relied on Hermes's built-in summarizing auto-compaction should expect once the bonsai engine displaces it. This spec resolves that in Compaction Duty Displacement: overflow relief becomes model-driven pruning urged by the gauge; the port never destructively summarizes on the host's behalf.

## Integration Posture

### Required architecture stance

- Hermes Context Bonsai MUST be implemented as a standalone plugin package in a `hermes_context_bonsai` side repository, loaded through Hermes's general plugin system (binding: `plugin-loading`) with no modification to the hermes-agent source tree. Hermes requires no fork.
- The port's core is a **context engine**: a `ContextEngine` subclass (binding: `engine-abc`) registered via the plugin API and selected by `context.engine` in the user's config (binding: `engine-registration`). This is a plugin-only posture with no core seam — the Stage 2 decision rule's row-5-Verified branch (Kilo and Pi precedents), because the context-engine interface is Hermes's native, plugin-reachable channel for authoritative transcript replacement: core calls the engine's `compress()` and itself performs the persisted rewrite and the in-memory baseline rewrite around the returned list (binding: `prune-realization`).
- Authoritative prune MUST flow through the engine `compress()` path. No component may write the transcript store behind the running loop's back or attempt to mutate the conversation loop's message locals: the bindings record why generic hooks and middleware cannot do this coherently, and any such bypass would desynchronize the loop's flush-identity tracking.
- Adopting the engine displaces Hermes's built-in `ContextCompressor`, so the port MUST also satisfy the engine's host duties: maintain the token-state fields the run layer reads, answer `should_compress()`, and keep `get_status()` accurate (binding: `engine-abc`). The behavioral consequences are specified in Compaction Duty Displacement.
- If a future capability genuinely cannot be delivered through the engine + plugin/middleware surfaces, a narrow core change is the last resort per the shared spec's Change-Minimization Rule, and the missing primitive MUST be identified before implementation.

### Prune and retrieve contract

- The model-facing tools MUST be `context-bonsai-prune` and `context-bonsai-retrieve`, exposed as engine tools via the engine's tool-schema surface and dispatched through its tool-call handler, which receives the live in-memory message list (binding: `tool-registration`).
- The prune tool MUST use pattern boundaries with required `from_pattern`, `to_pattern`, `summary`, and `index_terms`, plus optional `reason`, per the shared spec's Prune Tool input rules — including deterministic rejection of ID-based selectors and no mutation on any validation or resolution failure.
- Pattern matching MUST operate over message text and stable representations of every completed tool-call's name, input, and output (binding: `searchable-text`), per the shared Pattern Matching Contract.
- Per the shared Pattern Matching Contract, ambiguous pattern handling MUST apply the prior prune-wrapper filter before returning ambiguity, so retry attempts are not poisoned by echoed `from_pattern` / `to_pattern` / `summary` text.
- Archive records MUST include anchor identifier, range-end identifier, summary, index terms, optional reason, and enough correlation metadata to re-locate the range in both the persisted store and the id-less in-memory list (binding: `message-correlation`).
- **Realization timing (Stage 3 decision)**: a `context-bonsai-prune` call validates, resolves boundaries, and persists the archive record at tool-execution time, and reports success in its tool result — but the transcript-affecting replacement is realized through the engine `compress()` path, which the engine triggers by answering `should_compress()` true once archive work is pending. The realization MUST complete before the next provider-bound request is assembled, so the next model turn sees the placeholder (shared spec Execution rules: "the next transformed transcript shows a placeholder"). The engine MUST NOT attempt same-instant mutation of the live message list from inside the tool call; the list it receives there is for boundary resolution, not authoritative rewrite. Stage 4's first integration contact MUST verify that the host's compaction check actually runs between tool execution and the next provider call (binding: `prune-realization`); if it does not, that is a posture defect to bring back to this record, not a thing to patch around.
- Retrieve returns the archived content as its tool result and clears the archive's placeholder effect at the same realization boundary. A retrieve naming an anchor whose prune realization is still pending in the same model step MUST be rejected with the deterministic same-step guard error (shared spec Retrieve Execution rules).
- Failure output MUST be plain text, deterministic, and actionable, and MUST be surfaced through the host's tool-error channel so it is never presented as a successfully-completed operation.

### Transcript mutation path

- Persisted replacement MUST go through core's in-place compaction around the engine's `compress()` return — non-destructive soft-archive plus compacted-set insert under the same session id (binding: `prune-realization`).
- The port MUST require in-place compaction mode (`compression.in_place: true`) and MUST verify it before the first mutation: the rotation (legacy) path forks a child session id, which breaks anchor correlation and persistence across resume. If in-place mode is not configured, prune MUST fail closed with a deterministic compatibility error naming the config key; the operator documentation MUST cover setting it.
- The placeholder message emitted into the compacted list MUST retain the canonical information: anchor id, range-end id, summary, and index terms, in the shared spec's placeholder shape.
- The `compress()` return MUST remain a valid OpenAI-format message sequence: an archived range is hidden as one coherent interval, with no orphaned tool-call/tool-result adjacency (shared spec Execution rules on provider-visible validity).
- Per-request presentation via `llm_request` middleware (binding: `presentation-middleware`) is per-request only and MUST NOT be used as the authoritative replacement path; it MAY supplement rendering only if Stage 4 finds a need beyond the persisted rewrite.

### System guidance path

- **Channel split (Stage 3 decision)**: the standing bonsai guidance — tool existence, pattern-boundary semantics, protected-context rules, prune prioritization, recency/drift rules, non-destructiveness — lives in the engine tool descriptions (binding: `guidance-channel`), which reach the model in every request as part of the tool catalog. The per-turn `pre_llm_call` append channel (binding: `gauge-channel`) is reserved for the gauge and cadence-driven advisories. No plugin hook mutates the system prompt itself, and the port MUST NOT patch the system-prompt builder.
- Guidance semantics MUST remain aligned with the shared spec's System Guidance section: protected context, ranking, drift, and execution rules keep their meaning even where wording adapts to Hermes.
- If Stage 4 finds these channels insufficient for a contract obligation, that is a posture defect to bring back to this record, not a reason to patch the harness's prompt assembly.

### Gauge path

- Gauge input is native to the engine: `update_from_response(usage)` per API response plus the mandatory token-state fields (binding: `usage-api`).
- Gauge delivery MUST be in-band via the `pre_llm_call` append channel (binding: `gauge-channel`), which the host appends to the user message — the shared spec's preferred delivery shape.
- The gauge MUST use the shared spec's four locked bands: `<30%`, `30-60%`, `61-80%`, and `>80%` with `PRUNE NOW` in the urgent band.
- Gauge cadence SHOULD be every 5 turns by default.
- If usage data is unavailable or the model's context length is unknown, the gauge MUST remain silent (shared spec Gauge fallback behavior).
- `get_status()` and any human-visible status display MAY reflect gauge state, but they do not satisfy the in-band requirement.

## Compaction Duty Displacement (harness-unique)

This section exists because registering a context engine in Hermes is not additive: it **replaces** the built-in summarizing compressor, so the port inherits the host's compaction duty. The pipeline spec (§6) permits this one harness-unique extension for a genuinely harness-unique concern.

- The engine's `should_compress()` MUST return true when — and only when — the port has pending realization work (an unrealized prune or retrieve). The port does not signal compression on raw token pressure; overflow relief is model-driven pruning urged by the gauge's escalating bands.
- When core invokes `compress()`, the engine applies pending archive/retrieve realizations (placeholder insertion, follower elision, restoration) and returns the resulting list. It MUST NOT destructively summarize, drop, or rewrite content beyond realizing bonsai state — the shared spec's non-goal of replacing host compaction is honored by never imitating it.
- If the host invokes `compress()` with no pending bonsai work (a manually triggered compaction, or any host path the port does not control), the engine MUST return the message list with current bonsai state rendered and otherwise unchanged, and SHOULD note in its status output that bonsai does not perform summarizing compaction.
- The engine MUST keep the mandatory token-state fields accurate at all times regardless of this policy, because the run layer reads them directly (binding: `engine-abc`).
- The operator documentation MUST state plainly that selecting the bonsai engine turns off Hermes's built-in auto-summarization and what replaces it.

## Fail-Closed Requirements

- If required host primitives are unavailable or incompatible — engine registration rejected, engine selection silently falling back to the built-in compressor, in-place compaction mode not configured, session-state binding absent (binding: `host-compat-surface`) — prune and retrieve MUST fail closed with explicit deterministic compatibility errors.
- The engine-selection fallback is the sharpest hazard: Hermes deep-copies the registered engine per agent and, if the copy fails, **falls back to the built-in compressor with only a log-level warning** — invisible to the model and to normal session output. The port MUST make this state detectable — the side repo's engine MUST support the deep copy (implementing `__deepcopy__` if it holds uncopyable state), and post-install verification MUST confirm the bonsai engine (not the fallback) is live before any prune is trusted.
- A failed prune or retrieve MUST leave archive state, the persisted transcript, and the in-memory baseline unchanged.
- Unsupported runtime states MUST NOT silently no-op while the model believes pruning succeeded.
- Gauge capability gaps degrade to partial parity; prune/retrieve capability gaps MUST be explicit errors.

## Parity Gaps Against Shared Spec

- Host capability gaps are minimal: all six matrix rows are Verified (bindings Capability Evidence Matrix), and every required capability is reachable from the plugin surface.
- The main parity risk is message identity: the persisted store has durable row identity, but the list the engine receives in `compress()` and in tool dispatch is an id-less OpenAI-format sequence. Archive records must carry correlation metadata that bridges the two (binding: `message-correlation`); positional assumptions across compactions are not acceptable.
- The second risk is realization timing: the prune tool result and the transcript rewrite happen at different instants (see Prune and retrieve contract). The window is invisible to the model only if the host's compaction check runs before the next provider call — a Stage 4 verification obligation.
- The third risk is the silent engine-selection fallback described under Fail-Closed Requirements.
- The same-step retrieve guard is adopted (see Ambiguities From User Model), diverging from Pi's same-turn no-op branch; this matches the shared spec's SHOULD.

## Specified Implementation Direction

- **Preferred**: side-repo plugin package registering a Context Bonsai `ContextEngine` (prune/retrieve as engine tools, gauge from engine token state, standing guidance via tool descriptions, gauge via `pre_llm_call`), consumed by users as a plugin install plus two config lines (`context.engine` selection, plugin enable). Realizes every capability through surfaces the bindings verify.
- **Acceptable**: the same engine shipped in-repo under the harness's bundled context-engine directory for development convenience, since Hermes resolves that directory first — but the published form is the side-repo plugin; an in-tree copy is a build artifact, not the source of truth.
- **Not acceptable**: patching hermes-agent core (no missing capability licenses a core seam under the Change-Minimization Rule); driving authoritative prune through `llm_request` middleware or direct transcript-store writes from generic hooks (per-request-only, and the loop's locals are unreachable — desynchronizes flush-identity state); an external MCP-server-only port (MCP could host the tools but cannot reach the engine surface that owns rewrite, gauge state, and compaction duty); a text-only pattern matcher that ignores tool-call structures; a UI-only gauge.

## E2E Priorities

- plugin load, engine registration, and engine selection through the user config — including the post-install verification that the bonsai engine (not the silent fallback) is live
- prune success: persisted archive record, soft-archived originals in the session store, and a model-visible placeholder on the next turn
- ambiguous or unresolved boundary rejection with no mutation
- retrieve by anchor: archived content in the tool result and the restored range visible on the next turn
- same-step prune/retrieve guard rejection
- in-place-mode compatibility error when `compression.in_place` is not set
- persistence across `/resume` and process restart (archive records and placeholder rendering survive rehydration)
- gauge cadence and four-band severity text observed in the model-visible context, silent when usage data is absent
- secret/sensitive-content prune oracle proving post-prune recall is unavailable from active context alone

## Level-2 shape decision (Stage 2)

**Part 3 (release-medium binding), pure-extension variant** — the Pi precedent branch. In `forward-port-spec.md`'s vocabulary, Part 3 binds a harness whose released unit is an upstream artifact rather than a maintained git fork (Part 2's shape), and the pure-extension variant means no patch chain exists at all: the port is realized entirely through host-native extension seams. Hermes-agent is an open-source Python package with no npm or PyPI registry artifact — its installer script produces a full git checkout at `$HERMES_HOME/hermes-agent`, so the git tag is the released unit; the harness fork carries no port code and no patch chain, so Part 2 has nothing to operate on. Per Part 3's intro, this record states what realizes the requirements its machinery phrases as patch application:

- **Upstream identity**: the upstream git release tag frozen to its commit SHA (detector family `git-remote-tag`), standing in for Part 3's npm-package-plus-tarball-integrity. Current frozen identity: tag `v2026.7.1`, SHA `7c1a0295…` (bindings header).
- **Patch application / anchor registry**: none — nothing is patched. The corresponding requirement is realized by the side-repo plugin's compatibility surface: the `ContextEngine` ABC, the registration call, the engine-selection config path, and the engine-tool dispatch contract (bindings: `engine-abc`, `engine-registration`, `tool-registration`). A release cycle re-verifies those seams against the new tag instead of re-deriving anchors.
- **Slot table**: Stage 6 binds Hermes into `forward-port-spec.md` Part 4 with this pure-extension realization recorded per slot.

*Standing re-checkpoint*: this posture is re-validated at Stage 4's first integration contact; a seam the matrix calls usable that implementation cannot use reopens this record (pipeline spec §5).

## Key References

Structural references (source files, line-cited primitives, storage locations) live in [`hermes-agent-context-bonsai-bindings.md`](hermes-agent-context-bonsai-bindings.md) — capability matrix, verified primitives, weak areas, and the Binding Sites table this document's `binding:` keys resolve against. The shared behavior contract is [`../context-bonsai-agent-spec.md`](../context-bonsai-agent-spec.md); the pipeline that produced this pair is [`derivation-pipeline-spec.md`](derivation-pipeline-spec.md).
