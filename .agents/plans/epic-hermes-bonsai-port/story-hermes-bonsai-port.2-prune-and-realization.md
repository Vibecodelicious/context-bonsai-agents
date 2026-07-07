# Story: Prune tool, archive store, pattern matching, compress() realization

**Epic:** epic-hermes-bonsai-port (read `epic-hermes-bonsai-port.md` first)
**Size:** Large
**Dependencies:** Story 1 (scaffold, engine skeleton, stub provider, scratch home)

## Story Description

The port's core. `context-bonsai-prune` becomes real: pattern boundaries resolve over the live in-memory message list, an archive record persists to the side-owned store, and the transcript rewrite is realized at the engine's `compress()` boundary — placeholder in, followers out — before the next provider-bound request. This story also carries the posture re-checkpoint's timing verification: the Stage 3 record claims the host's compaction check runs between tool execution and the next provider call; this story proves it through the real loop or STOPs with a posture defect.

## User Model

Inherited from the epic. The sharpest design implication: the model only ever sees the request payloads, so every model-visible claim in this story (placeholder present, archived text gone) is asserted from the stub's recorded requests, not from internal state.

## Design bindings (decided here, within the Stage 3 stance — implement, don't re-decide)

- **Anchor identity.** The in-memory list is id-less OpenAI-format. Archive records carry synthetic anchor ids `cb-<n>` (`n` monotonic per session, persisted in the store). For each of anchor and range-end the record stores: `role`, a full content snapshot (exact string/structure as extracted for matching), a content hash, tool-call ids when the message carries `tool_calls[].id` / `tool_call_id` (these DO exist in the OpenAI-format list and in persisted rows — prefer them for re-location when present), and the occurrence index of that content among identical-content messages at prune time. Realization re-locates the range in the `compress()` input by tool-call id first, exact-content match with occurrence counting second. Positional indices are never trusted across calls.
- **Realization state machine.** Tool call: validate → resolve both boundaries against the `messages` kwarg `handle_tool_call` receives → persist record with status `pending` → return success text (resolved range summary). `should_compress()` returns True iff any record is `pending` (prune) or `pending-restore` (retrieve, Story 3). `compress(messages, ...)`: for each pending record, re-locate the range; replace the anchor message with the canonical placeholder message — the placeholder keeps the ANCHOR'S ORIGINAL ROLE (both reference ports do this; a fixed role would fabricate turn attribution), carries no `tool_calls`, and its text is the shared spec's placeholder shape: `[PRUNED: <anchor-id> to <range-end-id>]` / `Summary:` / `Index:` — and drop the followers through range end; mark `realized`; return the list. (A dangling `tool`-role anchor cannot occur: an anchor of role `tool` whose paired assistant tool_call sits before the range is exactly the call/result adjacency cut that boundary validation rejects at prune time.) The returned list MUST remain a valid provider sequence: the range is hidden as one coherent interval; an archived range must never orphan a tool-result whose tool-call sits outside the range or vice versa — range validation at prune time rejects boundaries that cut tool-call/tool-result adjacency or incomplete tool history.
- **Realization failure fails safe.** If a pending record cannot be re-located at `compress()` time, the engine returns the list unchanged for that record, marks it `realization-failed` with the reason, and the next bonsai tool call's result surfaces the failure text. `realization-failed` is TERMINAL for automatic realization: the record no longer counts as pending for `should_compress()` and is never retried automatically — it is surfaced via tool-result error text only. Never a partial rewrite.
- **Host-invoked compress with no pending work** (manual `/compress` etc.): return the list with realized bonsai state intact and otherwise unchanged (Compaction Duty Displacement).
- **In-place gate.** Before the FIRST mutation-committing step of any prune (persisting the pending record), the in-place helper (Story 1) is consulted; if effective `compression.in_place` is false, the tool returns the deterministic compatibility error naming the config key and nothing is persisted.
- **Searchable text.** The extraction layer feeding the matcher covers, for every message: text content (including multimodal text parts), and for assistant messages with `tool_calls`: each call's function name and arguments; for `tool` role messages: the tool result content. Pattern resolution that cannot reach any of the three is a spec violation (shared spec, Pattern Matching Contract).
- **Ambiguity + wrapper filter.** A pattern matching more than one boundary fails deterministically with no mutation — but first, candidates whose canonical content is a prior `context-bonsai-prune` tool-use wrapper (the assistant tool_call carrying `from_pattern`/`to_pattern`/`summary`, or its tool result) are excluded; if exactly one non-wrapper candidate remains it is the resolved boundary. Port the semantics from `opencode_context_bonsai_plugin/src/prune-pattern-matcher.ts` (reference reading, not transliteration).
- **Store layout.** `$HERMES_HOME/context_bonsai/session-<session_id>.json`: `{"next_anchor": n, "archives": [record...]}`. Atomic writes (write-temp-rename). Rehydrated in `bind_session_state`/`on_session_start`; a store file that fails to parse fails closed (prune/retrieve error, never silent reset). Records keep `summary`, `index_terms`, optional `reason`, timestamps, status history.

## Acceptance Criteria

- [ ] `context-bonsai-prune` validates inputs per the shared spec (both patterns present; non-empty trimmed `summary`; non-empty `index_terms` of non-empty strings; deterministic rejection of any id-based selector field); every validation/resolution failure returns error text with zero mutation (store byte-identical).
- [ ] Boundary resolution: exactly-one-match required per pattern; start not after end; range does not start/end inside an already-archived range; tool-call adjacency validation; wrapper filter applied before ambiguity failure (unit-tested with a poisoned-retry fixture reproducing the echoed-pattern scenario).
- [ ] Archive store with atomic persistence, rehydration, fail-closed parse errors — unit-tested including a corrupt-file case.
- [ ] Realization at `compress()`: placeholder carries anchor id, range-end id, summary, index terms; followers elided; valid provider sequence (unit-tested over fixtures including tool-call/tool-result pairs and multimodal content).
- [ ] `should_compress()` true iff pending work; host-invoked no-pending compress returns state-rendered-unchanged list.
- [ ] Real-CLI drive in a new required file `scripts/drive-prune.sh` (Story 3's and 5's validation commands reference it by this exact name): scenario scripts ≥3 turns — (1) assistant emits filler content; (2) assistant calls `context-bonsai-prune` over turn-1 content; (3) assistant replies plain text. Asserts from stub-recorded requests: the request AFTER the prune call contains the placeholder text (`[PRUNED: cb-`) and does NOT contain the archived filler text; the prune tool result in that request reports success. Asserts from the scratch session store (`sqlite3` over `$HERMES_HOME/state.db` or the host's documented inspection path): original rows soft-archived (`active=0, compacted=1` — both columns exist in the messages schema, `hermes_state.py:763-764`) and the compacted set live — i.e. core's `archive_and_compact` ran (bindings key `prune-realization`).
- [ ] **Timing re-checkpoint:** the drive's evidence demonstrates the rewrite landed before the next provider request within the same conversation run (the post-tool-call check at `agent/conversation_loop.py:4614` and/or the `turn_context` preflight realized it). If the real loop does NOT run a compaction check between tool execution and the next request, STOP: posture defect, report to owner tier — do not add middleware workarounds.
- [ ] Ambiguity drive: a scenario where the prune pattern matches two messages; assert error tool result, no placeholder in the next request, store unchanged.
- [ ] In-place-off drive: scratch config with `compression.in_place: false`; assert the deterministic compatibility error naming the key and zero mutation.
- [ ] pytest + ruff green; baseline compared.

## Context References

- Spec pair sections: Prune and retrieve contract; Transcript mutation path; Compaction Duty Displacement; Fail-Closed Requirements. Bindings keys: `tool-registration`, `prune-realization`, `searchable-text`, `message-correlation`, `host-compat-surface`.
- Shared spec: Prune Tool, Archive Placeholder Rendering, Archive Persistence Model, Context Transform Requirement, Pattern Matching Contract, Invariants.
- Harness: `agent/tool_executor.py:1322-1335` (engine-tool dispatch with live list); `agent/conversation_loop.py:4530-4620` (post-tool-call compaction check); `agent/turn_context.py:355-456` (preflight + pre_llm_call); `agent/conversation_compression.py:371-450, 583-682` (compress_context, in-place split, archive_and_compact call, baseline rewrite); `hermes_state.py:695-765, 3346-3395` (row schema, archive_and_compact).
- Reference implementations: `opencode_context_bonsai_plugin/src/prune-pattern.ts`, `prune-pattern-matcher.ts`, `prune.ts`; `pi_context_bonsai/src/archive-store.ts`, `context-transform.ts`.

### New Files to Create

Under the side repo: `context-bonsai/archive_store.py`, `context-bonsai/extract.py`, `context-bonsai/patterns.py`, `context-bonsai/prune.py` (or equivalent module split, listed in the iteration report), scenario JSON files under `tests/scenarios/`, `scripts/drive-prune.sh`, tests. Modified: `context-bonsai/engine.py`, `context-bonsai/__init__.py`, `scripts/setup-scratch-home.sh` (if config additions needed).

## Testing Strategy

- Unit: matcher (ambiguity, wrapper filter, tool-call reach), store (atomicity, rehydration, corruption), realization (fixtures incl. adjacency), validation (every input rule).
- Real entry point: the three drives above; they are the only closure evidence for realization timing, model-visible placeholder, and store effects.

## Validation Commands

From the side repo root:

- `HERMES_AGENT_ROOT=/tmp/hermes-bonsai-stage4/hermes-agent uv run --project /tmp/hermes-bonsai-stage4/hermes-agent pytest tests -q`
- `uvx ruff@0.15.10 check .`
- `bash scripts/smoke.sh`
- `bash scripts/drive-prune.sh` (runs the prune, ambiguity, and in-place-off drives; exits 0 only when all assertions hold)

## Worktree Artifact Check

- Planned targets are all inside the scratch side repo continuing from Story 1; the executor verifies `git status` is clean at story start (a dirty tree means a prior run left state: STOP and report).
- Escalation Status: none

## Plan Approval and Commit Status

- Approval Status: approved (same citations as Story 1)
- Ready-for-Orchestration: yes (after plan commit)

## Completion Checklist

- [ ] Acceptance criteria met with drive evidence; timing re-checkpoint recorded
- [ ] Validation commands pass vs baseline; scope diff clean
- [ ] Completion report: Binding Sites rows for `tool-registration`, `prune-realization`, `searchable-text`, `message-correlation`; SPEC-GAP/EXECUTOR-FAIL candidates
- [ ] Intent log updated at phase boundaries
