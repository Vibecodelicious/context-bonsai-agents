# Story: End-to-end test→fix→test validation loop

**Epic:** Port context-bonsai to Pi as a first-party extension
**Size:** Medium
**Dependencies:** Stories 1–4 (full extension must be wired in)

## Story Description

Write a Pi-native end-to-end validation protocol for the context-bonsai extension and run it in a **test → diagnose → fix → re-test** loop until every scenario passes.

This story does **not** adapt the OpenCode template. The Pi-side mechanics of driving a non-interactive session, capturing state, and asserting on behaviour are fundamentally different from OpenCode's `run` / `export` pattern. A prerequisite research document — `.agents/research/pi-e2e-interaction-baseline.md` — establishes the Pi-native primitives empirically (see "Context References"). Story 5 builds on that baseline; read it first.

Unit + integration tests from Stories 1–4 prove module-level correctness under the faux provider. Story 5 proves the full stack works when driven through the real `pi` CLI against a real (or suitably minimal) LLM: the extension loads, tools fire, archive custom entries land in the session JSONL, and the state survives a process restart.

Two artifacts land in this story:

1. **Protocol document** (`packages/context-bonsai/docs/e2e-testing.md`) — the reusable, bonsai-specific test plan. Points at the research baseline for general Pi-interaction details and focuses on what is unique to context-bonsai: the six scenarios below, their setup prompts, the JSON-event-stream markers to assert on, and the session-JSONL shapes to grep / `jq`.
2. **Automation harness** (`packages/context-bonsai/test/e2e/run-e2e.sh` plus `assert.mjs`) — scripted driver that executes each scenario with the recommended command pattern from the baseline, asserts on `--mode json` stdout events and on the session JSONL file, and reports pass/fail per scenario. Not part of `npm run check` (costs a real LLM call per scenario).

## User Model

### User Gamut
- Extension maintainer validating a pre-release against the last known-good provider.
- Contributor reproducing a reported bonsai bug end-to-end before patching.
- Release-gate reviewer who needs a single deterministic script to run.
- Engineer writing a future extension who will copy this protocol as an exemplar.

### User-Needs Gamut
- Protocol reproducible from a clean clone without TUI steering.
- Failures produce readable diagnostics: which scenario, what marker was missing, which log/session file to open.
- Protocol exercises cross-turn state: prune archives, retrieve restores, reload persists, gauge cadence fires.
- Protocol tolerates LLM non-determinism: assert on structural markers (tool names, custom-entry customType, placeholder literal prefix, gauge regex), never on arbitrary model prose.
- Cost gates: live-LLM scenarios opt-in via env vars; no accidental runs from default `npm` commands.

### Design Implications (from the Pi baseline)
- **Driver command**: `./pi-test.sh -p --mode json -e packages/context-bonsai --session-dir "$DIR" [--session "$FILE"] "<prompt>"`. `--mode json` emits `AgentSessionEvent` objects as JSONL on stdout — the highest-fidelity signal; prefer it over session-file grepping when both are available.
- **State inspection**: `pi --export` writes HTML and is useless for assertions. Read the raw session JSONL (`<sessionDir>/<ISO-timestamp>_<uuid>.jsonl`) with `jq`. Custom entries written by `pi.appendEntry(customType, data)` appear as `{"type":"custom","customType":"context-bonsai:archive", ...}` lines.
- **No positive "extension loaded" event**. Scenario A asserts the load indirectly via `--mode rpc` + `get_commands`, or by checking the registered tool appears in the first `turn_start`'s tool inventory on stdout.
- **No hermetic dry-run**. Live-LLM invocations are required. Pin `BONSAI_E2E_PROVIDER=anthropic` and `BONSAI_E2E_MODEL=claude-sonnet-4-6` by default; overridable via env.
- **Write buffering**: session JSONL writes before the first assistant message are buffered (`session-manager.ts:_persist`). Read the file only after `agent_end` appears on stdout.
- Each scenario uses a fresh `mktemp -d` as `--session-dir` so runs don't cross-contaminate.

### Ambiguities From User Model
- Whether this suite runs in CI. **Resolution:** no. Unit + integration tests (faux provider) are CI-gated. Story 5's suite is a local/manual release gate. Documented in the protocol header.
- How deep to test transform correctness on the live path. **Resolution:** shallow. Deep transform correctness is proven by Story 2's integration tests (including `02b-prune-with-compaction.test.ts`). Story 5 asserts the *glue* works: tool fires, custom entry persists, reload reads the entry back. It does not re-test the transform algorithm against edge cases.

## Acceptance Criteria

- [ ] `packages/context-bonsai/docs/e2e-testing.md` exists and includes:
  - A one-paragraph header pointing at `.agents/research/pi-e2e-interaction-baseline.md` as the Pi-interaction source of truth.
  - Sections: Purpose, Prerequisites (incl. API-key env), Pre-flight Checks, Scenarios A–F (setup prompts, expected JSON-stream markers, expected session-JSONL markers, failure patterns), Recording Results (with a Test Runs log section).
  - At least one recorded green run (date, commit hash, per-scenario PASS, short observation list).
- [ ] `packages/context-bonsai/test/e2e/run-e2e.sh` exists and:
  - Accepts `--scenario <A..F>` and `--all`.
  - Exits with a clear error if `$BONSAI_E2E_API_KEY` (or the provider's standard env var) is missing.
  - For each scenario: creates a fresh tmpdir, runs the prompt sequence, captures stdout per turn, asserts via `assert.mjs`, cleans up, prints `PASS` / `FAIL <reason>`.
  - Returns non-zero on any scenario failure; exit code for `--all` reflects the worst case.
- [ ] `packages/context-bonsai/test/e2e/assert.mjs` exists and exposes matchers:
  - `eventStreamContainsTool(pathToLog, toolName) → boolean`
  - `eventStreamToolResult(pathToLog, toolName) → { isError, content }`
  - `sessionHasCustomEntry(sessionFile, customType) → Array<entry>`
  - `sessionHasMessageMatching(sessionFile, predicate) → boolean`
  - `countMatchesInEventStream(pathToLog, regex) → number`
- [ ] `packages/context-bonsai/package.json` gains a non-default `"e2e"` script: `"e2e": "bash test/e2e/run-e2e.sh --all"` (documentation only; not invoked by `npm run check`).
- [ ] All six scenarios PASS in a single `run-e2e.sh --all` invocation. Evidence recorded in protocol Test Runs.

### Scenarios

Each scenario starts from a fresh `mktemp -d -t pi-bonsai-XXXX` as `--session-dir`. All invocations include `-p --mode json -e packages/context-bonsai` plus the model/provider pins.

1. **Scenario A — Extension loads + tool registered.**
   - Run a one-shot turn with prompt `"list the tools available to you"`. (Any prompt works; we assert on tool inventory, not the model's answer.)
   - Assert: `eventStreamContainsTool(log, "context-bonsai-prune")` returns true. `context-bonsai-retrieve` likewise.
   - Assert: the JSON event stream includes `agent_end` (clean exit).
   - Assert: stderr has no `Failed to load extension` line.

2. **Scenario B — Prune archives a range.**
   - Turn 1: prompt the model with several assistant-visible facts to create history. Turn 2: continue with a prompt that explicitly instructs `call context-bonsai-prune with from_pattern <X> to_pattern <Y> summary <S> index_terms [...]`.
   - Assert on turn 2 log: `eventStreamToolResult(log, "context-bonsai-prune").isError === false` and the result content contains `Archived` (the success-string prefix from Story 2).
   - Assert on the session JSONL (after turn 2): `sessionHasCustomEntry(file, "context-bonsai:archive").length === 1`, and the entry's `data` has non-empty `anchorEntryId`, `rangeEndEntryId`, `summary`, `indexTerms`.

3. **Scenario C — Retrieve restores.**
   - Turn 3 (continuing Scenario B's session): prompt `call context-bonsai-retrieve with anchor_id <the anchor from B>`.
   - Assert: `eventStreamToolResult(log, "context-bonsai-retrieve").isError === false`; result content contains `Restored`.
   - Assert: `sessionHasCustomEntry(file, "context-bonsai:archive-clear").length === 1` — the tombstone landed.

4. **Scenario D — Reload persistence.**
   - After Scenario B completes, exit pi. Start a **new** `pi` process with the same `--session <file>` and prompt `"noop"`.
   - Assert the new process's stdout JSON stream includes `agent_end` (clean exit — means `session_start` hydrated successfully without throwing).
   - Assert the session JSONL still contains exactly one `context-bonsai:archive` custom entry and no `archive-clear` entry.
   - Deep correctness (that the `"context"` handler would emit a placeholder for this archive) is covered by Story 2's `02b-prune-with-compaction.test.ts` regression; Story 5 proves only that persistence across processes is not broken.

5. **Scenario E — Gauge cadence.**
   - Seed an empty session. Run 10 turns in a row with trivial prompts (`"turn N"`).
   - After all turns, concatenate the 10 turn logs.
   - Assert `countMatchesInEventStream(concat, /\[CONTEXT GAUGE:/) === 2`. (Cadence is every 5 per Story 4; turn indices 5 and 10.)
   - Sanity: assert at least one gauge occurrence appears in a message delivered to the model (search for the `[CONTEXT GAUGE:` pattern inside a `message_end` event for a user message). Gauge text lives inside user-message content of the outgoing transcript because the handler appends it there; the JSON event stream emits `message_end` for every message, which carries the post-transform content.

6. **Scenario F — Same-turn prune+retrieve is a supported no-op.**
   - In a single assistant message, prompt `call context-bonsai-prune ... then in the same response call context-bonsai-retrieve with that same anchor_id`.
   - Assert: both `tool_execution_end` events carry non-error results. Prune returns `Archived ...`, retrieve returns `Restored ...`.
   - Assert on the session JSONL: one `context-bonsai:archive` entry and one `context-bonsai:archive-clear` entry are both present (audit record preserved).
   - Run one more trivial turn on the same session and assert the delivered transcript is un-elided (tombstone-wins hydration at `session_start` produces the original context).
   - This scenario is the live-stack proof that we correctly dropped OpenCode's same-step guard: the sequence that OpenCode rejects must succeed in Pi.

### Test → Fix → Test Loop

- Run `run-e2e.sh --all`. If every scenario PASS, record the run in protocol Test Runs and mark story complete.
- If any FAIL:
  1. Triage by reading the scenario's log and the session JSONL it pinned.
  2. Classify the fault: extension bug, protocol bug (flaky assertion / wrong prompt), or Pi-surface gap.
  3. **Extension bug**: patch the responsible module, **and** add a targeted unit or integration test in Stories 1–4's suite that would have caught it. (Regression-backfill is non-negotiable — otherwise a future CI run can silently re-break.)
  4. **Protocol bug**: clamp the assertion on a more deterministic marker; update both the harness and the protocol doc.
  5. **Pi-surface gap**: stop the loop and escalate with a written repro. Do not work around silently.
  6. Commit each iteration as `[Story 1.5 iter N] <what was fixed>`.
  7. Re-run `run-e2e.sh --all`. Iterate.
- The orchestrator's 5-iteration cap applies. The final green `run-e2e.sh --all` is the acceptance signal.

## Context References

### Relevant Codebase Files (must read)
- `.agents/research/pi-e2e-interaction-baseline.md` — **prerequisite**. Contains the verified command patterns, session-file layout, event-stream shape, and the minimum-reproducible two-turn script this story is built on.
- `packages/coding-agent/src/cli/args.ts:70-150` — full CLI flag surface.
- `packages/coding-agent/src/modes/print-mode.ts` — print-mode event emission.
- `packages/coding-agent/src/core/session-manager.ts:138-150` — `SessionEntry` union that tooling will `jq` against.
- `packages/coding-agent/src/core/extensions/loader.ts:481-511` — `resolveExtensionEntries` confirms the `-e packages/context-bonsai` + `pi.extensions` manifest form.
- All of `packages/context-bonsai/src/**` and `packages/context-bonsai/docs/**` (from Stories 1–4).

### New Files to Create
- `packages/context-bonsai/docs/e2e-testing.md`
- `packages/context-bonsai/test/e2e/run-e2e.sh`
- `packages/context-bonsai/test/e2e/assert.mjs`
- `packages/context-bonsai/test/e2e/scenarios/` (optional; per-scenario prompt fragments if the driver script grows unwieldy)

### Files Modified
- `packages/context-bonsai/package.json` — add the `"e2e"` script.
- Regression-test files added during the fix loop may touch Stories 1–4's test directories (in-epic, expected).

### Relevant Documentation
- `AGENTS.md` — confirms e2e live-LLM tests are not required for `npm run check`. The `--mode json` / `-p` / `-e` / `--session-dir` combo used here is documented in `AGENTS.md`'s tmux section as well.

## Implementation Plan

### Phase 1: Protocol document
- Write `docs/e2e-testing.md` with the header, scenario blocks, and a Test Runs section (empty until Phase 4).
- Every scenario block lists: goal, commands (literal copy-pasteable), event-stream assertions, session-JSONL assertions, known failure patterns.

### Phase 2: Assertion helper
- Implement `assert.mjs` using Node's built-in `node:fs` and a small JSONL reader. No third-party deps beyond what's already in the monorepo.

### Phase 3: Driver script
- `run-e2e.sh` dispatches per `--scenario`, composes prompt sequences, logs to per-scenario files under a run-specific tmpdir, and emits a final summary.
- Require `BONSAI_E2E_PROVIDER` / `BONSAI_E2E_MODEL` env vars with sensible defaults; fail fast if the expected API-key env is unset.

### Phase 4: First full run
- Set credentials. Execute `run-e2e.sh --all`. Capture the summary.
- Record in the protocol's Test Runs section.

### Phase 5: Fix loop
- For each failure: diagnose → patch source (or harness) → backfill a regression test under the right Story's suite → rerun. Repeat until green.
- After each patch, `npm run check` must remain green.

### Phase 6: Completion
- Append the final green run to protocol Test Runs with date and commit hash. Commit as `[Story 1.5] context-bonsai e2e protocol + green run`.

## Step-by-Step Tasks

1. Re-read `.agents/research/pi-e2e-interaction-baseline.md` end-to-end; bookmark the minimum-reproducible script in §6.
2. Write `packages/context-bonsai/docs/e2e-testing.md` with Scenarios A–F.
3. Implement `packages/context-bonsai/test/e2e/assert.mjs`.
4. Implement `packages/context-bonsai/test/e2e/run-e2e.sh`.
5. Add the `"e2e"` script entry in `package.json`.
6. Export credentials; run `run-e2e.sh --scenario A` as a smoke check.
7. Run `run-e2e.sh --all`. Record outcome.
8. For every failure: diagnose, patch, add regression test, rerun. Iterate.
9. When all six PASS: update Test Runs with final date + commit hash. Run `npm run check`.
10. Commit as `[Story 1.5] context-bonsai e2e protocol + green run`.

## Testing Strategy

- **E2E (live LLM)**: this story's primary gate. `run-e2e.sh --all`.
- **Regression backfill**: every fix applied during the loop lands with a deterministic unit or integration test in Stories 1–4's suite.
- **Smoke**: `run-e2e.sh --scenario A` must complete in under 30 s against the pinned model; operators run it as a pre-flight before the full suite.

## Validation Commands

- `cd /home/basil/projects/context-bonsai-pi && npm run check` — must stay green after any fix-loop patches.
- `cd /home/basil/projects/context-bonsai-pi/packages/context-bonsai && BONSAI_E2E_PROVIDER=anthropic BONSAI_E2E_MODEL=claude-sonnet-4-6 bash test/e2e/run-e2e.sh --scenario A` — smoke.
- `cd /home/basil/projects/context-bonsai-pi/packages/context-bonsai && BONSAI_E2E_PROVIDER=anthropic BONSAI_E2E_MODEL=claude-sonnet-4-6 bash test/e2e/run-e2e.sh --all` — full suite; must exit 0 before the story is complete.

## Worktree Artifact Check

- Checked At: 2026-04-23
- Planned Target Files: `packages/context-bonsai/docs/e2e-testing.md`, `packages/context-bonsai/test/e2e/run-e2e.sh`, `packages/context-bonsai/test/e2e/assert.mjs`, `packages/context-bonsai/test/e2e/scenarios/`, `packages/context-bonsai/package.json` (modified), regression-test files discovered during the fix loop.
- Overlaps Found: `packages/context-bonsai/package.json` modified relative to Story 1 (in-epic). Fix-loop regression tests may touch prior stories' test directories (in-epic).
- Escalation Status: none (in-epic modifications are not escalation triggers).
- Decision Citation: n/a

## Plan Approval and Commit Status

- Approval Status: approved
- Approval Citation: user message 2026-04-23 "Do commit the plan" (auto mode)
- Plan Commit Hash: 45df8a33 (`docs: approved plans for context-bonsai port epic`)
- Ready-for-Orchestration: yes (orchestration deferred per user instruction in same exchange)

## Completion Checklist

- [ ] All acceptance criteria met
- [ ] All six scenarios PASS in a single `run-e2e.sh --all` run; result recorded in protocol Test Runs
- [ ] Every fix applied during the loop has an accompanying unit or integration regression test
- [ ] `npm run check` passes at the final commit
- [ ] Plan approved and committed before orchestration begins
- [ ] User-model ambiguities resolved or escalated
- [ ] Worktree artifact overlaps resolved (approved direction or explicit deferral)
