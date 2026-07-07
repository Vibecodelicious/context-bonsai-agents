# Story: Side-repo scaffold, plugin + engine skeleton, selection liveness

**Epic:** epic-hermes-bonsai-port (read `epic-hermes-bonsai-port.md` first — it defines the work root, frozen harness identity, provisioning commands, architecture stance, iteration budget, baseline, scope, and real-entry-point rules that bind this story)
**Size:** Medium
**Dependencies:** None

## Story Description

Create the `hermes_context_bonsai` side repository and prove the whole loading chain end-to-end before any business logic lands: plugin discovered → `register(ctx)` runs → `BonsaiContextEngine` registered → config selects it → the deep copy succeeds → the engine (not the silent built-in fallback) is live inside a real `hermes -z` run → its tool schema reaches the provider request. Also build the stub provider server every later story drives through.

## User Model

### User Gamut / User-Needs Gamut
Inherited from the epic. The user this story serves most directly is the later-story executor and the operator running post-install verification: both need a deterministic "is bonsai actually live?" answer, because Hermes's engine-selection failure mode is a silent fallback with only a log-line warning.

### Design Implications
- Liveness must be provable from the provider request payload (engine tools present in the tool catalog), not from logs alone.
- The engine skeleton must satisfy every host duty from day one so later stories only add behavior, never retrofit ABC compliance.

## Acceptance Criteria

- [ ] Side repo initialized at `/tmp/hermes-bonsai-stage4/hermes_context_bonsai` with `git init`; all work committed with subject+body messages.
- [ ] `context-bonsai/plugin.yaml` + `context-bonsai/__init__.py` with `register(ctx)` calling `ctx.register_hook` (none needed yet — omit if unused) and `ctx.register_context_engine(BonsaiContextEngine())`.
- [ ] `BonsaiContextEngine` (in `context-bonsai/engine.py` or similar) subclasses `agent.context_engine.ContextEngine` and implements: `name` property returning `"bonsai"`; `update_from_response(usage)` maintaining `last_prompt_tokens`/`last_completion_tokens`/`last_total_tokens`; `should_compress(...)` returning False (no pending work yet); `compress(self, messages, current_tokens=None, focus_topic=None)` — the exact host-call-compatible signature (`agent/context_engine.py:86-104`; the host calls it duck-typed, so a parameter-name mismatch breaks silently) — returning the list unchanged; `update_model(...)` via the ABC default or equivalent (must keep `context_length`/`threshold_tokens` accurate); `get_status()` accurate; `__deepcopy__` that survives `copy.deepcopy` including after `bind_session_state` has bound a live sqlite handle (reset/re-derive uncopyable state); optional `bind_session_state(session_db=..., session_id=...)` storing the handle and session id; `on_session_start`/`on_session_end` hooks (may be minimal but must accept the host's kwargs — see `tests/agent/test_context_engine_host_contract.py` in the harness for the kwargs shape).
- [ ] One placeholder engine tool exposed via `get_tool_schemas()` — name `context-bonsai-prune`, minimal honest description, schema per the shared spec's Prune Tool inputs (`from_pattern`, `to_pattern`, `summary`, `index_terms`, optional `reason`) — with `handle_tool_call` returning a deterministic JSON error string `{"error": "context-bonsai-prune is not yet implemented"}`. (Story 2 implements it; registering the real name now makes liveness evidence meaningful and locks the schema.)
- [ ] In-place gate helper: a function that answers whether effective `compression.in_place` is on, sourced the same way the host sources it (config read path — cite `agent/agent_init.py:1428-1433` and `hermes_cli/config.py:1361`), plus a unit test. (Enforcement at prune time is Story 2.)
- [ ] Stub provider: `tools/stub_provider.py` (side repo), stdlib-only, serving `POST /v1/chat/completions` from a JSON scenario file (ordered list of responses; each response specifies `content` or `tool_calls`, plus `usage` numbers; scripted tool calls carry deterministic ids `call-<n>`, monotonic across the scenario file — later stories' correlation logic relies on this), recording every received request body to a JSONL file. No models/context-length GET endpoint is needed: config `model.context_length` short-circuits all probing (`agent/agent_init.py:1480-1496`; `agent/model_metadata.py:1811-1813` step 0). Implement additional endpoints only if a real run demonstrably requires them, and record which.
- [ ] Scratch HERMES_HOME assembled by a repeatable script (`scripts/setup-scratch-home.sh`): writes `config.yaml` with `model.provider: custom`, `model.base_url` pointing at the stub, a placeholder `api_key`, `model.default: stub-model` (`cli-config.yaml.example:9-11` — `default` is the canonical key), `model.context_length: 200000`, `context.engine: bonsai`, `compression.in_place: true`, `plugins.enabled: [context-bonsai]`, and symlinks/copies `context-bonsai/` into `plugins/`.
- [ ] Real-entry-point smoke (`scripts/smoke.sh`): starts the stub with a trivial one-response scenario, runs `HERMES_HOME=... uv run hermes -z "hello"` from the harness clone, then asserts from the stub's recorded request that (a) the run completed with the scripted content on stdout and (b) the request's tool catalog contains `context-bonsai-prune` — the liveness proof that the bonsai engine, not the fallback, is live. The script exits non-zero on any assertion failure.
- [ ] Negative liveness test: with `context.engine` left at its default, the smoke asserts `context-bonsai-prune` is ABSENT from the request — proving the assertion actually discriminates.
- [ ] pytest suite green; conftest inserts the harness clone (env `HERMES_AGENT_ROOT`, default `/tmp/hermes-bonsai-stage4/hermes-agent`) into `sys.path` and fails loudly if absent. Unit tests cover: ABC compliance (isinstance), deepcopy survival with bound state, token-state updates from a usage dict, in-place gate helper.
- [ ] Ruff clean at the harness's pinned version (0.15.10).
- [ ] Posture re-checkpoint part 1 recorded in the completion report: engine registration, selection, deep copy, `bind_session_state`, and tool-catalog joining all observed through the real loader/selector — or a posture defect STOP.

## Context References

Must-read before implementing (paths relative to their repos):

- `docs/agent-specs/hermes-agent-context-bonsai-spec.md` — the contract half; Integration Posture and Fail-Closed Requirements bind this story.
- `docs/agent-specs/hermes-agent-context-bonsai-bindings.md` — Binding Sites keys `plugin-loading`, `engine-abc`, `engine-registration`, `host-compat-surface`.
- Harness (frozen clone): `agent/context_engine.py:32-231` (the ABC — read fully); `hermes_cli/plugins.py:614-642, 1109-1144, 1271-1326, 1518-1600, 1703-1822` (registration + loader); `agent/agent_init.py:1575-1678, 1710-1744` (selection, deep copy, bind_session_state, tool joining); `plugins/security-guidance/` (minimal plugin precedent); `tests/agent/test_context_engine_host_contract.py` (host-contract kwargs shapes); `cli-config.yaml.example`; `hermes_cli/_parser.py:99-112` (`-z`).

### New Files to Create (planned-target list for scope discipline)

Inside `/tmp/hermes-bonsai-stage4/hermes_context_bonsai/` only: `context-bonsai/plugin.yaml`, `context-bonsai/__init__.py`, `context-bonsai/engine.py`, `context-bonsai/host_compat.py`, `tools/stub_provider.py`, `scripts/setup-scratch-home.sh`, `scripts/smoke.sh`, `tests/conftest.py`, `tests/test_engine.py`, `tests/test_host_compat.py`, `pyproject.toml`, `.gitignore`, `README.md` (stub — full operator docs are Story 5). Reasonable additional module files under `context-bonsai/` or `tests/` are in scope if listed in the iteration's report.

## Implementation Tasks

1. Provision per the epic's Execution environment section (clone-verify-sync; record baseline — trivially empty for this story, record it as such per the epic).
2. Scaffold the repo (pyproject with dev tooling only — the package is consumed as a plugin dir, not installed; `[tool.ruff]` config; `.gitignore` for `__pycache__` etc.).
3. Implement engine + plugin entry + in-place helper with unit tests (run via `uv run --project /tmp/hermes-bonsai-stage4/hermes-agent pytest tests -q` from the side repo, so harness deps resolve).
4. Implement the stub provider; source-verify the custom-provider startup requests and the model-selection config key; implement `setup-scratch-home.sh`.
5. Implement and pass `smoke.sh` (positive + negative liveness).
6. Commit; write the completion report (realized Binding Sites rows, posture re-checkpoint evidence, baseline comparison).

## Testing Strategy

- Unit: pytest as above.
- Real entry point: `smoke.sh` through `uv run hermes -z` against the stub — this is the story's closure evidence; pytest alone closes nothing that touches the loader/selector.

## Validation Commands

Run from `/tmp/hermes-bonsai-stage4/hermes_context_bonsai` unless noted. Source of truth for baseline and completion rerun; no substitution.

- `HERMES_AGENT_ROOT=/tmp/hermes-bonsai-stage4/hermes-agent uv run --project /tmp/hermes-bonsai-stage4/hermes-agent pytest tests -q`
- `uvx ruff@0.15.10 check .`
- `bash scripts/smoke.sh` (must print its positive and negative liveness assertions and exit 0)

## Worktree Artifact Check

- Checked At: generation time (2026-07-07)
- Planned Target Files: all under `/tmp/hermes-bonsai-stage4/hermes_context_bonsai/` (new repo; nothing exists before this story)
- Overlaps Found: none possible (fresh `git init` in a fresh directory; the executor MUST verify the directory does not already exist at story start — if it does, a prior run left state: STOP and report rather than reusing it)
- Escalation Status: none

## Plan Approval and Commit Status

- Approval Status: approved
- Approval Citation: owner directive via showrunner 2026-07-07 ("add context bonsai to Hermes agent", HAND_OFF Active Thread) + standing orders LOCAL LANDINGS ARE ROUTINE and DRIVE (2026-07-05)
- Plan Commit Hash: 2a39654 (follow-up hash-recording commit excluded)
- Ready-for-Orchestration: yes (after plan commit)

## Completion Checklist

- [ ] All acceptance criteria met with real-entry-point evidence
- [ ] Validation commands pass; results compared against the persisted baseline artifact
- [ ] Scope diff clean against planned-target list
- [ ] Completion report written (Binding Sites rows, posture re-checkpoint part 1, SPEC-GAP/EXECUTOR-FAIL candidates)
- [ ] Intent log updated at every phase boundary (§1.18)
