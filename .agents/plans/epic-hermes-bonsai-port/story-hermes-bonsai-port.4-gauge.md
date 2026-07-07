# Story: Context gauge

**Epic:** epic-hermes-bonsai-port (read `epic-hermes-bonsai-port.md` first)
**Size:** Medium
**Dependencies:** Stories 1–2 (engine, stub, drives; Story 3 not required)

## Story Description

The in-band context-pressure gauge: severity text computed from the engine's token state, delivered on a cadence through the `pre_llm_call` hook channel (which the host appends to the user message — `agent/turn_context.py:431-456`), silent whenever usage or context length is unknown. Standing guidance stays in the tool descriptions (Story 2's schemas); this channel carries only the gauge and cadence-driven advisories (contract half, System guidance path — channel split).

## The live-engine routing hazard (this story's hard part)

The plugin registers hooks and one engine instance at load time, but Hermes deep-copies the engine per agent (`agent/agent_init.py:1606-1626`) — a `pre_llm_call` callback that closes over the registered singleton reads token state the live agent never updates. The `pre_llm_call` invocation passes NO agent or engine object; its kwargs are `session_id, task_id, turn_id, user_message, conversation_history, is_first_turn, model, platform, sender_id` (`agent/turn_context.py:427-449`; verified at the frozen SHA). The prescribed routing: a module-level registry `session_id → live engine instance`, populated by the live per-agent copy itself when the host calls `bind_session_state(session_db=..., session_id=...)` on it (and refreshed in `on_session_start`); the hook callback resolves the registry entry for its `session_id` kwarg, verifies `isinstance(..., BonsaiContextEngine)`, and reads gauge state from that instance. If no registry entry exists for the session (bind never happened), the hook returns nothing (silent gauge) and the condition is surfaced in `get_status()`; if implementation finds `bind_session_state` is not invoked at all on the selected engine copy, THAT is a posture defect against binding `gauge-channel`: STOP and report — never deliver the gauge from stale singleton state, and do not invent an alternative channel.

## Design bindings

- Bands (locked, shared spec): `<30%` informational; `30-60%` prune-ready advisory; `61-80%` stronger reminder with recency/drift cues; `>80%` urgent including the literal `PRUNE NOW`. Percent = `last_prompt_tokens / context_length * 100` (the host's own canonical computation, `agent/context_engine.py:205-208`).
- Cadence: every 5 turns (a turn = one `pre_llm_call` firing for the session), first gauge on the 5th turn. Urgent escalation: crossing INTO the `>80%` band fires once immediately off-cadence and RESETS the counter (next mandatory gauge 5 turns later); turns that remain above 80% without a fresh crossing do not re-fire outside the reset cadence. Cadence state lives on the live engine copy.
- Delivery: the hook returns text wrapped in a system-reminder-style wrapper (match the OpenCode gauge text semantics; adapt wording minimally). The host appends it to the user message — that satisfies in-band delivery (binding `gauge-channel`).
- Silence: if `last_prompt_tokens` is 0/absent or `context_length` is 0/unknown, the hook returns nothing. `get_status()` remains accurate regardless (host duty).
- Context length source: `update_model(...)` receives `context_length` from the host, which resolves config `model.context_length` first, short-circuiting all probing (`agent/agent_init.py:1480-1496`; `agent/model_metadata.py:1811-1813`). The gauge drive uses the scratch config's `model.context_length` (Story 1); the silence drive uses a scratch config that OMITS `model.context_length` — genuine host-path silence, never a value faked inside the engine.

## Acceptance Criteria

- [ ] Band computation and text generation unit-tested at boundary values (29/30/60/61/80/81%), including `PRUNE NOW` presence only in the urgent band.
- [ ] Cadence logic unit-tested (5-turn period, urgent-escalation override, per-session state).
- [ ] Silence fallback unit-tested (missing usage; missing context length).
- [ ] Hook routing: source-verified payload path to the live engine documented in the completion report with citations; a unit test proves a stale-singleton scenario would be detected (e.g. the routing helper raises/returns-nothing when it cannot reach a live `BonsaiContextEngine`); a second unit test proves the no-registry-entry path (bind never happened for the session) returns nothing and surfaces the condition in `get_status()`.
- [ ] Real-CLI drive (`scripts/drive-gauge.sh`): a multi-turn scenario whose scripted `usage` climbs through the bands with a stub-supplied context length. Asserts from stub-recorded requests: gauge text appears appended to the user message at the expected turns only; band text matches the scripted usage percentages; the `>80%` request contains `PRUNE NOW`. Plus a silence drive: no context length available through the real path → no gauge text in any request.
- [ ] `update_from_response` correctness against the host's usage dict shape (source-verify the dict keys the host passes — row 4 primitives, `agent/context_compressor.py:1043-1047`).
- [ ] pytest + ruff green; baseline compared.

## Context References

- Spec pair: Gauge path; System guidance path (channel split). Bindings keys: `gauge-channel`, `usage-api`. Shared spec: Gauge Requirement (semantics, bands, fallback).
- Harness: `agent/turn_context.py:355-456`; `hermes_cli/plugins.py` (`invoke_hook`, hook registration); `agent/context_engine.py:64, 205-208`; `agent/context_compressor.py:1043-1047`; `run_agent.py:2208-2221`; providers/ context-length resolution.
- Reference: `opencode_context_bonsai_plugin/src/gauge.ts` (band text), `pi_context_bonsai/src/gauge.ts`.

### New Files to Create

`context-bonsai/gauge.py`, `scripts/drive-gauge.sh`, scenario files, tests. Modified: `context-bonsai/engine.py`, `context-bonsai/__init__.py` (hook registration), `tools/stub_provider.py` / `scripts/setup-scratch-home.sh` (context-length path).

## Testing Strategy

Unit tests for bands/cadence/silence/routing; the gauge and silence drives are the closure evidence for in-band delivery.

## Validation Commands

From the side repo root:

- `HERMES_AGENT_ROOT=/tmp/hermes-bonsai-stage4/hermes-agent uv run --project /tmp/hermes-bonsai-stage4/hermes-agent pytest tests -q`
- `uvx ruff@0.15.10 check .`
- `bash scripts/smoke.sh`
- `bash scripts/drive-gauge.sh`

## Worktree Artifact Check

Clean `git status` at story start or STOP.

## Plan Approval and Commit Status

- Approval Status: approved (same citations as Story 1)
- Ready-for-Orchestration: yes (after plan commit)

## Completion Checklist

- [ ] Acceptance criteria met with drive evidence; routing verification documented
- [ ] Validation commands pass vs baseline; scope diff clean
- [ ] Completion report: Binding Sites rows for `gauge-channel`, `usage-api`; SPEC-GAP/EXECUTOR-FAIL candidates
- [ ] Intent log updated at phase boundaries
