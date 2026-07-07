# Epic: Port Context Bonsai to Hermes Agent as a plugin-registered context engine

**Goal:** Implement the Hermes Agent port specified by `docs/agent-specs/hermes-agent-context-bonsai-spec.md` (contract half) and `docs/agent-specs/hermes-agent-context-bonsai-bindings.md` (bindings half): a `hermes_context_bonsai` side repository containing a Hermes plugin that registers a Context Bonsai `ContextEngine`, with prune/retrieve engine tools, compress()-boundary realization, an in-band gauge, and zero modification to the hermes-agent source tree.
**Depends on:** Stage 1–3 artifacts (the spec pair above, committed at parent `a03f80d`).
**Parallel with:** None — stories are sequential; each builds on the prior story's code in the same scratch side repo.
**Complexity:** High
**Pipeline context:** This is Stage 4 of `docs/agent-specs/derivation-pipeline-spec.md` (§7). Stage 5 (e2e slot binding, live-model Protocol A) and Stage 6 (Part 4 emission) follow separately and are non-goals here.

## Frozen inputs

- Harness identity: git `https://github.com/NousResearch/hermes-agent`, tag `v2026.7.1`, SHA `7c1a029553d87c43ecff8a3821336bc95872213b`. Every harness citation in the stories resolves against this SHA.
- Behavior contract: `docs/context-bonsai-agent-spec.md` (shared spec). The per-harness spec pair is the derivation of it that binds this epic; where the stories say "shared spec", they mean this document.
- Reference implementations (read-only precedent, not copy targets — Hermes is Python, these are TypeScript): `opencode_context_bonsai_plugin/src/` (pattern matcher, prune-wrapper ambiguity filter), `pi_context_bonsai/src/` (pure-extension shape, id-less correlation).

## Execution environment (all stories)

Work root: `/tmp/hermes-bonsai-stage4/`. The executor never touches the real repositories under `/home/basil/projects/context-bonsai-agents/`; landing the result there is a separate owner-tier act at epic seal.

- `/tmp/hermes-bonsai-stage4/hermes-agent/` — fresh clone of the harness at the frozen SHA. Provision (idempotent, run at every story start):
  `git clone https://github.com/NousResearch/hermes-agent /tmp/hermes-bonsai-stage4/hermes-agent 2>/dev/null; cd /tmp/hermes-bonsai-stage4/hermes-agent && git checkout 7c1a029553d87c43ecff8a3821336bc95872213b && git rev-parse HEAD`
  The printed SHA MUST equal the frozen SHA; STOP if not. Then hydrate: `uv sync` (uv is on PATH; the repo pins `requires-python >=3.11,<3.14`, uv fetches an interpreter as needed). Do NOT use the preserved derivation clone at `/tmp/hermes-bonsai-derivation/` — it is another procedure's state.
- `/tmp/hermes-bonsai-stage4/hermes_context_bonsai/` — the side repo being built. Story 1 runs `git init` here; later stories continue in it and commit their own work (subject + body commit messages). This scratch repo persists across the epic's stories (it is the work product, not per-run scratch) and is removed only after the owner-tier re-home at epic seal (`forward-port-spec.md` §1.19).
- `/tmp/hermes-bonsai-stage4/hermes-home/` — scratch `HERMES_HOME` for real-entry-point drives. Every `hermes` invocation in this epic sets `HERMES_HOME=/tmp/hermes-bonsai-stage4/hermes-home` so nothing reads or writes the operator's real `~/.hermes`.
- `/tmp/hermes-bonsai-stage4/logs/` — run logs and baseline artifacts; outside both repos.

Hermes is invoked from the harness clone via its console script: `cd /tmp/hermes-bonsai-stage4/hermes-agent && HERMES_HOME=/tmp/hermes-bonsai-stage4/hermes-home uv run hermes -z "<prompt>"` (`pyproject.toml` `[project.scripts] hermes = "hermes_cli.main:main"`; `-z/--oneshot` is the non-interactive one-shot mode, `hermes_cli/_parser.py:99-112`).

## Architecture stance (fixed by the Stage 2/3 record — do not re-decide)

The contract half's Integration Posture section governs. Summary for executors, with the epic-level design decisions the stories share:

- **Plugin package shape.** The side repo carries a self-contained Hermes plugin directory `context-bonsai/` (the unit an operator copies or symlinks to `$HERMES_HOME/plugins/context-bonsai/`): `plugin.yaml` plus `__init__.py` exposing `register(ctx)` (loader contract: `hermes_cli/plugins.py:1703-1731`; directory discovery `:1271-1326`). All port modules (engine, archive store, pattern matcher, gauge) live inside that directory so the loader's `importlib` path (`_load_directory_module`, `hermes_cli/plugins.py:1783-1822`) imports them without installation. Plugins must be allow-listed: config `plugins.enabled: [context-bonsai]` (`hermes_cli/plugins.py:225-268`).
- **Engine registration.** `register(ctx)` calls `ctx.register_context_engine(BonsaiContextEngine())` (`hermes_cli/plugins.py:614-642`; isinstance-checked against `agent/context_engine.py`'s ABC; only one engine may register). Selection: config `context.engine: bonsai` (`agent/agent_init.py:1575-1622`). The engine's `name` property returns `"bonsai"`.
- **Deep-copy hazard (fail-closed requirement).** Hermes deep-copies the registered engine per agent and silently falls back to the built-in compressor on copy failure (`agent/agent_init.py:1606-1626`). The engine implements `__deepcopy__` (resetting any uncopyable state); `bind_session_state(session_db=..., session_id=...)` is duck-typed and called on the selected copy after selection (`agent/agent_init.py:1673-1678`), so per-session handles are bound post-copy, never held across copies.
- **Archive persistence.** Side-owned, never a write to the host's `state.db`: one JSON file per session at `$HERMES_HOME/context_bonsai/session-<session_id>.json`. The host store is read-only to the port (correlation checks). Rehydration on `on_session_start`/`bind_session_state`.
- **Realization timing.** Prune/retrieve tool calls validate, resolve boundaries, and persist archive records at tool-execution time; the transcript-affecting rewrite happens when the host next calls `compress()` — `should_compress()` returns true iff realization work is pending (contract half, Prune and retrieve contract + Compaction Duty Displacement). The host runs a post-tool-call check (`agent/conversation_loop.py:4614`, after `_execute_tool_calls` at `:4530`, before the loop re-enters the provider call) and a preflight check in `agent/turn_context.py` (~`:355-380`, before the `pre_llm_call` hook at `:431-456`). Story 2 verifies this timing through the real loop (the posture re-checkpoint).
- **In-place mode.** `compress_context` reads `compression.in_place` (`agent/conversation_compression.py:444-450`; `agent/agent_init.py:1430-1433` reads it with code default false, while the config defaults dict supplies `in_place: True` at `hermes_cli/config.py:1361`). The port never assumes: it verifies the effective value before the first mutation and fails closed with a deterministic error naming the key when in-place mode is off.
- **Zero-credential real-entry-point evidence.** A scripted OpenAI-compatible stub server (side repo test infra, stdlib-only) serves `POST /v1/chat/completions` responses (content, `tool_calls`, `usage`) from scenario files. Scratch config points Hermes at it: `model.provider: custom`, `model.base_url: http://127.0.0.1:<port>/v1`, placeholder `api_key` (`cli-config.yaml.example:36-46`; no real key is validated). This drives the genuine `run_conversation`/`turn_context` production path — tool dispatch, compaction checks, hook invocation — with no credentials. The stub records every request body it receives; those recorded requests are the model-visible-context evidence channel (what the "model" sees IS the request payload). The pipeline's credentials wake (HAND_OFF) is therefore NOT triggered by this epic; live-model drives belong to Stage 5.

## Stage 4 obligations from the pipeline spec (§7) — how this epic realizes them

- **Declared iteration budget:** 5 dev/review/judge iterations per story. Exhaustion is a recorded STOP escalated to the owner tier, not a silent retry.
- **Persisted regression baseline:** at each story's start, the executor runs the story's Validation Commands once against the starting state and writes the results (command, exit code, last 50 lines of output) to `/tmp/hermes-bonsai-stage4/logs/baseline-story<N>.json`. Every iteration's judge compares against that artifact, not prose memory. Story 1's baseline is the empty-repo trivial case (recorded as such).
- **Scope discipline:** each iteration's judge runs `git diff --name-only` in the side repo against the story's planned-target list; out-of-list paths require a recorded justification or the iteration fails.
- **Real-entry-point rule:** a finding closes only on evidence driven through `uv run hermes` against the stub provider (or, for pure library units, pytest — but every story's acceptance includes at least one real-CLI drive). Tests that hand-build engine state, manually advance counters, or bypass the plugin loader are not closure evidence.
- **Posture re-checkpoint:** Story 1 verifies engine selection liveness through the real loader/selector; Story 2 verifies the compaction-check timing claim. A seam the spec called usable that implementation cannot use is a posture defect: STOP and report (the owner tier reopens the Stage 2/3 record); do not route around it.
- **Binding Sites completion:** each story's completion report lists the realized side-repo sites (file, function, storage location) for every `binding:` key it implements; the owner tier folds them into the bindings document's Binding Sites table at seal.

## Executor tiering and run mechanics

Stories are executed by an Opus-4.8-low subagent per the calibration loop (`tweakcc_context_bonsai/HAND_OFF.md` §"The calibration loop"): launch prompt states the mode, the work root, the story plan path, an intent-log path seeded with a `RUN-START` UTC timestamp, and the log directory — nothing more. The Fable tier observes without contaminating, verifies claims after the run, attributes stumbles SPEC-GAP vs EXECUTOR-FAIL, and repairs plans on findings. Run-continuity duties per `forward-port-spec.md` §1.18 (append intent-log entries at every phase boundary and STOP).

## User Model

### User Gamut
- Hermes CLI users in long terminal sessions (REPL, gateway/TUI/ACP) who hit the built-in summarizing compaction and want surgical, recoverable pruning instead.
- Hermes plugin authors reading this port as the worked example of a plugin-registered context engine.
- Security-minded operators auditing what a compaction-owning plugin reads and persists.
- The meta-loop's routine executor (a lower-capability model) that will later maintain this port through release cycles — the code and docs are also for it.

### User-Needs Gamut
- Context reclamation without lost recoverability; durable archive state across `/resume` and restarts.
- Pattern matching over message text AND tool-call structures.
- In-band gauge signals; silence when usage data is absent.
- Install as plugin-dir copy plus config lines; clean uninstall; honest security disclosure.
- Deterministic fail-closed errors for every unsupported state (engine fallback, in-place off, unresolved boundaries).

### Ambiguities From User Model
- Same-step retrieve: the contract half adopts the guard (deterministic rejection) — decided at Stage 3, not re-open here.
- Built-in auto-summarization users: Compaction Duty Displacement (contract half) resolves what replaces it; the operator docs must state it plainly.

## Stories

### Story 1: Side-repo scaffold, plugin + engine skeleton, selection liveness
**Size:** Medium
**Description:** `git init` the side repo; create the `context-bonsai/` plugin dir with `plugin.yaml`, `register(ctx)`, and a `BonsaiContextEngine` skeleton satisfying every ABC duty (token-state fields, `update_from_response`, `should_compress` returning False, identity `compress`, `__deepcopy__`, optional `bind_session_state`, `get_status`); the in-place-mode fail-closed check helper; the stub provider server + scenario format; pytest/ruff scaffolding; a real-CLI smoke proving the engine (not the silent fallback) is live — the stub asserts the request's tool catalog… (Story 1 registers one placeholder no-op engine tool solely so liveness is provable from the request payload; Story 2 replaces it with the real prune tool.) Posture re-checkpoint part 1 recorded.
**Implementation Plan:** `.agents/plans/epic-hermes-bonsai-port/story-hermes-bonsai-port.1-scaffold-engine-liveness.md`

### Story 2: Prune tool, archive store, pattern matching, compress() realization
**Size:** Large
**Description:** The port's core: `context-bonsai-prune` engine tool (schema per shared spec), text extraction over message text + tool-call name/input/output, pattern boundary resolution with deterministic ambiguity failure and the prune-wrapper filter, per-session JSON archive store, pending-realization queue, `should_compress()`/`compress()` realization inserting the canonical placeholder and eliding followers while keeping the returned list a valid OpenAI-format sequence, in-place-mode gate, id-less correlation scheme. Real-CLI drive: scripted prune through the stub; assert the NEXT provider request shows the placeholder and no longer contains the archived text; assert the session store soft-archived rows. Posture re-checkpoint part 2 (timing) recorded.
**Implementation Plan:** `.agents/plans/epic-hermes-bonsai-port/story-hermes-bonsai-port.2-prune-and-realization.md`

### Story 3: Retrieve tool and same-step guard
**Size:** Small
**Description:** `context-bonsai-retrieve` engine tool: anchor lookup, archived content returned in the tool result, restoration realized at the same `compress()` boundary, same-step guard rejecting a retrieve whose anchor's prune realization is still pending, deterministic missing-anchor errors. Real-CLI drive through the stub.
**Implementation Plan:** `.agents/plans/epic-hermes-bonsai-port/story-hermes-bonsai-port.3-retrieve.md`

### Story 4: Context gauge
**Size:** Medium
**Description:** Gauge state from `update_from_response(usage)` + `update_model` context length; four locked severity bands; cadence every 5 turns; delivery via a `pre_llm_call` hook that routes to the LIVE per-agent engine copy (the deep-copy hazard: a closure over the registered singleton reads stale state — the story must source-verify the hook payload's path to the active agent and fail closed if none exists); silence when usage or context length is unknown; `get_status()` accuracy. Real-CLI drive: stub supplies usage climbing through the bands; assert gauge text appears appended to the user message in the recorded requests at the right cadence and severity.
**Implementation Plan:** `.agents/plans/epic-hermes-bonsai-port/story-hermes-bonsai-port.4-gauge.md`

### Story 5: Scenario matrix, persistence-across-resume, operator docs
**Size:** Medium
**Description:** Consolidation: a scripted scenario matrix through the stub covering the contract half's E2E Priorities that are automatable without a live model (prune success, ambiguous rejection with no mutation, retrieve, same-step guard, in-place-off compatibility error, gauge cadence/silence, persistence across process restart and `/resume`, and the payload form of the secret oracle: post-prune requests never contain the secret string); operator README (install, post-install verification, security disclosure, uninstall — Operator Documentation Contract) plus DEVELOPMENT.md; full regression re-run; Binding Sites completion data for every key.
**Implementation Plan:** `.agents/plans/epic-hermes-bonsai-port/story-hermes-bonsai-port.5-scenarios-and-docs.md`

## Dependencies and Integration

- Prerequisites: none beyond the frozen clone — all six capability-matrix rows are Verified (bindings doc).
- Enables: Stage 5 (e2e slot binding + live-model Protocol A), Stage 6 (Part 4 emission).
- Integration points: none in the harness — the port loads through `$HERMES_HOME/plugins/` and user config only. The parent repo gains the side repo as a submodule at the owner-tier seal, not during story execution.

## Non-goals

- No hermes-agent fork, no harness source edits, no writes to the host `state.db` by port code.
- No live-provider runs, no credentials, no network beyond `git clone`/`uv sync`/PyPI.
- No Stage 5/6 deliverables (installation/runtime e2e docs, Part 4 slot table).
- No summarizing compaction of any kind (Compaction Duty Displacement).

## Validation Loop Results

- Iteration 1 (2026-07-07): independent repository-inspecting missing-details and ambiguity reviewers. Blocking finding: Story 4's routing example cited a nonexistent `agent` kwarg in the `pre_llm_call` hook payload — rewritten to the verified kwargs list (`agent/turn_context.py:427-449`) with a prescribed `session_id`-keyed live-engine registry. Material findings fixed: placeholder now keeps the anchor's original role; `realization-failed` pinned terminal (no auto-retry); `scripts/drive-prune.sh` mandated by name; gauge cadence/escalation semantics pinned. Pins converted from "source-verify" deferrals: `model.default`, `model.context_length` (short-circuits probing — no stub models endpoint needed), exact `compress()` signature, stub `call-<n>` tool-call ids, `hermes -z --resume <session>` for row 8, baseline tail = 50 lines.
- Iteration 2 (2026-07-07): all eight fixes re-verified against the frozen SHA; zero blocking or material findings. Two minors fixed in place (Story 4 no-registry-entry unit test; `compacted` column citation `hermes_state.py:763-764`). Loop closed.
- Bindings-freshness consultation (§1.15): the Hermes bindings document is Stage-3-fresh (parent `a03f80d`, 2026-07-07), no DEMOTED or UNVERIFIED rows; no `bindings-reverification-*.md` pass record predates it that could apply — consultation vacuous by construction for a Stage-4 first implementation.

## Epic seal (owner tier, after story 5's terminal APPROVED)

1. Verify executor claims against reality (frozen clone pristine at the SHA; no writes outside the work root; scenario evidence reproducible).
2. Re-home: clone the scratch side repo to `/home/basil/projects/context-bonsai-agents/hermes_context_bonsai`, add as parent submodule, commit (local only — standing order: local landings are routine; push is owner-gated).
3. Fold realized Binding Sites rows into `docs/agent-specs/hermes-agent-context-bonsai-bindings.md`; commit.
4. Remove `/tmp/hermes-bonsai-stage4/` (§1.19). The derivation clone at `/tmp/hermes-bonsai-derivation/` stays until Stage 6 seals.
