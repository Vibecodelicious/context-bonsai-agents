# Story: End-to-end test→fix→test validation loop

**Epic:** Port context-bonsai to Pi as a first-party extension
**Size:** Medium
**Dependencies:** Stories 1–4 (full extension must be wired in)

## Story Description

Write a Pi-native end-to-end validation protocol for the context-bonsai extension and run it in a **test → diagnose → fix → re-test** loop until every scenario passes.

This story does **not** adapt the OpenCode template. The Pi-side mechanics of driving a non-interactive session, capturing state, and asserting on behaviour are fundamentally different from OpenCode's `run` / `export` pattern. A prerequisite research document — `.agents/research/pi-e2e-interaction-baseline.md` — establishes the Pi-native primitives empirically (see "Context References"). Story 5 builds on that baseline; read it first.

Unit + integration tests from Stories 1–4 prove module-level correctness under the faux provider. Story 5 proves the full stack works when driven through the real `pi` CLI against a real (or suitably minimal) LLM: the extension loads, tools fire, archive custom entries land in the session JSONL, and the state survives a process restart.

Two artifacts land in this story:

1. **Protocol document** (`packages/context-bonsai/docs/e2e-testing.md`) — the reusable, bonsai-specific test plan. Points at the research baseline for general Pi-interaction details and focuses on what is unique to context-bonsai: the seven scenarios below, their setup prompts, the JSON-event-stream markers to assert on, and the session-JSONL shapes to grep / `jq`.
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
- Cost gates: live-LLM scenarios opt-in via credential presence; no accidental runs from default `npm` commands.
- Operators who have already authenticated via `pi login` MUST be able to run the suite without setting any env var. Env-var overrides are honored when present.

### Design Implications (from the Pi baseline)
- **Driver command**: `./pi-test.sh -p --mode json -e packages/context-bonsai --session-dir "$DIR" [--session "$FILE"] "<prompt>"`. `--mode json` emits `AgentSessionEvent` objects as JSONL on stdout — the highest-fidelity signal; prefer it over session-file grepping when both are available.
- **State inspection**: `pi --export` writes HTML and is useless for assertions. Read the raw session JSONL (`<sessionDir>/<ISO-timestamp>_<uuid>.jsonl`) with `jq`. Custom entries written by `pi.appendEntry(customType, data)` appear as `{"type":"custom","customType":"context-bonsai:archive", ...}` lines.
- **No positive "extension loaded" event**. Scenario A asserts the load indirectly via `--mode rpc` + `get_commands`, or by checking the registered tool appears in the first `turn_start`'s tool inventory on stdout.
- **No hermetic dry-run**. Live-LLM invocations are required. Pin `BONSAI_E2E_PROVIDER=anthropic` and `BONSAI_E2E_MODEL=claude-sonnet-4-6` by default; overridable via env.
- **Write buffering**: session JSONL writes before the first assistant message are buffered (`session-manager.ts:_persist`). Read the file only after `agent_end` appears on stdout.
- Each scenario uses a fresh `mktemp -d` as `--session-dir` so runs don't cross-contaminate.
- **Credential discovery delegates to Pi's `AuthStorage`.** Per the per-agent spec's "E2E Credential Discovery" section, the harness MUST gate on `AuthStorage.hasAuth(provider)` (`packages/coding-agent/src/core/auth-storage.ts:324`) rather than parse env vars or `auth.json` itself. The harness applies its `BONSAI_E2E_API_KEY` override via `setRuntimeApiKey()` before the check so it participates in Pi's documented priority order (auth-storage.ts:415-422: runtime override → auth.json → env var → fallback). The auth file path resolves via `getAuthPath()` / `getAgentDir()` in `config.ts` (default `~/.pi/agent/auth.json`, respects `$PI_CODING_AGENT_DIR`). This automatically picks up `pi login`-installed credentials, hand-edited `api_key` entries, OAuth-token env vars (`ANTHROPIC_OAUTH_TOKEN`, etc.), and `models.json` custom-provider configs without the harness enumerating them.

### Ambiguities From User Model
- Whether this suite runs in CI. **Resolution:** no. Unit + integration tests (faux provider) are CI-gated. Story 5's suite is a local/manual release gate. Documented in the protocol header.
- How deep to test transform correctness on the live path. **Resolution:** shallow. Deep transform correctness is proven by Story 2's integration tests (including `02b-prune-with-compaction.test.ts`). Story 5 asserts the *glue* works: tool fires, custom entry persists, reload reads the entry back. It does not re-test the transform algorithm against edge cases.

## Acceptance Criteria

- [ ] `packages/context-bonsai/docs/e2e-testing.md` exists and includes:
  - A one-paragraph header pointing at `.agents/research/pi-e2e-interaction-baseline.md` as the Pi-interaction source of truth.
  - Sections: Purpose, Prerequisites (incl. API-key env), Pre-flight Checks, Scenarios A–G (setup prompts, expected JSON-stream markers, expected session-JSONL markers, failure patterns), Recording Results (with a Test Runs log section).
  - At least one recorded green run (date, commit hash, per-scenario PASS, short observation list).
- [ ] `packages/context-bonsai/test/e2e/run-e2e.sh` exists and:
  - Accepts `--scenario <A..G>` and `--all`.
  - Gates scenario execution by calling out to a credential-discovery shim (see next AC) that delegates to Pi's `AuthStorage.hasAuth(provider)` per the per-agent spec's "E2E Credential Discovery" section. The harness MUST NOT fail-fast on missing env vars when `hasAuth(provider)` returns true; it MUST fail-fast with a deterministic error when `hasAuth(provider)` returns false, naming the auth-store path (`getAuthPath()` resolution including `$PI_CODING_AGENT_DIR` override hint), the harness override `BONSAI_E2E_API_KEY`, and the operator-actionable next step (`pi login <provider>` or set `BONSAI_E2E_API_KEY`).
  - The harness MUST NOT invoke `pi login` automatically.
  - For each scenario: creates a fresh tmpdir, runs the prompt sequence, captures stdout per turn, asserts via `assert.mjs`, cleans up, prints `PASS` / `FAIL <reason>`.
  - Returns non-zero on any scenario failure; exit code for `--all` reflects the worst case.
- [ ] Credential-discovery shim at `packages/context-bonsai/test/e2e/check-credentials.ts` (TypeScript, runnable via `tsx`) imports `AuthStorage` from the coding-agent workspace, applies `BONSAI_E2E_API_KEY` (when set) via `setRuntimeApiKey($BONSAI_E2E_PROVIDER, ...)`, calls `hasAuth($BONSAI_E2E_PROVIDER)`, and exits 0 (gate open) or 3 with the deterministic error message defined above. The harness shells out to this shim via `pi-test.sh` (so the workspace import resolves) or directly via `tsx`.
- [ ] Credential discovery is covered by deterministic unit tests at `packages/context-bonsai/test/e2e-credentials.test.ts` using `AuthStorage.inMemory(...)` (auth-storage.ts:203) — no live LLM calls. Fixtures MUST cover at minimum: (i) `api_key`-shape entry for the configured provider → gate open; (ii) `oauth`-shape entry for the configured provider → gate open; (iii) entry-for-different-provider-only → gate closed with deterministic error; (iv) `BONSAI_E2E_API_KEY` runtime override only → gate open; (v) no source present → gate closed with deterministic error. Tests MUST NOT touch the real `~/.pi/agent/auth.json`.
- [ ] `packages/context-bonsai/test/e2e/assert.mjs` exists and exposes matchers:
  - `eventStreamContainsTool(pathToLog, toolName) → boolean`
  - `eventStreamToolResult(pathToLog, toolName) → { isError, content }`
  - `sessionHasCustomEntry(sessionFile, customType) → Array<entry>`
  - `sessionHasMessageMatching(sessionFile, predicate) → boolean`
  - `countMatchesInEventStream(pathToLog, regex) → number`
- [ ] `packages/context-bonsai/package.json` gains a non-default `"e2e"` script: `"e2e": "bash test/e2e/run-e2e.sh --all"` (documentation only; not invoked by `npm run check`).
- [ ] All seven scenarios PASS in a single `run-e2e.sh --all` invocation. Evidence recorded in protocol Test Runs.

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
   - Run one more trivial turn on the same session and assert the delivered transcript is un-elided.
   - This scenario is the live-stack proof of Pi's intentional same-turn no-op behavior.

7. **Scenario G — Secret prune oracle.**
   - Seed a unique high-entropy nonce in a message range, prune that range using a summary and index terms that do not include the nonce, then ask a follow-up that would require recalling the nonce without retrieval.
   - Assert the post-prune model-visible transcript/event stream contains the placeholder and does not contain the nonce outside archived session JSONL entries.
   - Assert the model's final response does not include the nonce. This is a behavioral oracle, not proof of secrecy against logs; it verifies the active context no longer carries pruned sensitive content.

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
- `packages/context-bonsai/test/e2e/check-credentials.ts` — credential-discovery shim that delegates to `AuthStorage.hasAuth()`
- `packages/context-bonsai/test/e2e-credentials.test.ts` — deterministic unit tests for the shim using `AuthStorage.inMemory(...)`
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

### Phase 3: Driver script + credential-discovery shim
- Implement `test/e2e/check-credentials.ts` (TS shim) per the per-agent spec's "E2E Credential Discovery" section: import `AuthStorage` from `@mariozechner/pi-coding-agent` (or the relative workspace path), apply `BONSAI_E2E_API_KEY` (when set) via `setRuntimeApiKey($BONSAI_E2E_PROVIDER, ...)`, call `hasAuth($BONSAI_E2E_PROVIDER)`, exit 0 on gate-open or 3 with the deterministic error message.
- Add deterministic unit tests at `test/e2e-credentials.test.ts` using `AuthStorage.inMemory(...)` covering at minimum the five fixture cases enumerated in the AC.
- `run-e2e.sh` dispatches per `--scenario`, composes prompt sequences, logs to per-scenario files under a run-specific tmpdir, and emits a final summary. The credential-discovery gate uses the shim, NOT a hand-rolled env-var check.
- Default `BONSAI_E2E_PROVIDER=anthropic` and `BONSAI_E2E_MODEL=claude-sonnet-4-6` if unset; both are operator-overridable.

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
2. Read the per-agent spec's "E2E Credential Discovery" section and `packages/coding-agent/src/core/auth-storage.ts` (esp. `AuthStorage.create`, `inMemory`, `setRuntimeApiKey`, `hasAuth` at lines 195, 203, 213, 324) so the shim and unit tests can mirror Pi's documented priority order.
3. Implement `packages/context-bonsai/test/e2e/check-credentials.ts` (credential-discovery shim).
4. Implement `packages/context-bonsai/test/e2e-credentials.test.ts` covering the five fixture cases.
5. Update `packages/context-bonsai/test/e2e/run-e2e.sh` so its credential gate calls the shim instead of inspecting env vars directly. Remove the env-var-only fail-fast.
6. Refresh `packages/context-bonsai/docs/e2e-testing.md`'s Prerequisites and Pre-flight Checks sections to describe credential discovery via `pi login` OR `BONSAI_E2E_API_KEY`, not env vars only.
7. Confirm the `"e2e"` script entry in `package.json` is unchanged (Story P.5 iter 1 already added it).
8. With credentials available (`pi login` for the configured provider, or `BONSAI_E2E_API_KEY` set): run `bash test/e2e/run-e2e.sh --scenario A` as smoke; then `--all`. Record outcomes.
9. For every failure: diagnose, patch (extension bug → patch source + add regression test in P.1–P.4 suite; protocol bug → tighten assertion; Pi-surface gap → escalate), rerun. Iterate.
10. When all seven PASS: update Test Runs with final date + commit hash. Run `npm run check`.
11. Commit as `[Story P.5] context-bonsai e2e protocol + green run` (subject convention matches in-orchestration P.x prefix).

## Testing Strategy

- **E2E (live LLM)**: this story's primary gate. `run-e2e.sh --all`.
- **Regression backfill**: every fix applied during the loop lands with a deterministic unit or integration test in Stories 1–4's suite.
- **Smoke**: `run-e2e.sh --scenario A` must complete in under 30 s against the pinned model; operators run it as a pre-flight before the full suite.

## Validation Commands

Authoritative paths use the submodule working tree `/home/basil/projects/context-bonsai-agents/pi/...`. The original plan referenced a sibling clone at `/home/basil/projects/context-bonsai-pi/...`; orchestration uses the submodule.

- `cd /home/basil/projects/context-bonsai-agents/pi && npm run check` — must stay green after any fix-loop patches; covers the credential-discovery unit tests.
- `cd /home/basil/projects/context-bonsai-agents/pi/packages/context-bonsai && BONSAI_E2E_PROVIDER=anthropic BONSAI_E2E_MODEL=claude-sonnet-4-6 bash test/e2e/run-e2e.sh --scenario A` — smoke (requires `hasAuth(anthropic)` to be true via `pi login` or `BONSAI_E2E_API_KEY`).
- `cd /home/basil/projects/context-bonsai-agents/pi/packages/context-bonsai && BONSAI_E2E_PROVIDER=anthropic BONSAI_E2E_MODEL=claude-sonnet-4-6 bash test/e2e/run-e2e.sh --all` — full suite; must exit 0 before the story is complete.

## Worktree Artifact Check

- Checked At: 2026-05-07 (amendment)
- Planned Target Files (after 2026-05-07 amendment):
  - `packages/context-bonsai/docs/e2e-testing.md` (modified — Prerequisites + Pre-flight Checks updated to describe credential discovery)
  - `packages/context-bonsai/test/e2e/run-e2e.sh` (modified — credential gate replaced with shim call)
  - `packages/context-bonsai/test/e2e/assert.mjs` (existing; unchanged unless fix-loop requires)
  - `packages/context-bonsai/test/e2e/check-credentials.ts` (new — credential-discovery shim)
  - `packages/context-bonsai/test/e2e-credentials.test.ts` (new — unit tests for the shim)
  - `packages/context-bonsai/package.json` (existing `"e2e"` script unchanged unless fix-loop requires)
  - regression-test files discovered during the fix loop (any of `packages/context-bonsai/test/*.test.ts` or `packages/coding-agent/test/suite/context-bonsai/*.test.ts`).
- Overlaps Found:
  - `packages/context-bonsai/test/e2e/run-e2e.sh` is `tracked-dirty` if the iter-1 dev artifacts at pi HEAD `b9a7c612` are kept, since this iteration replaces its credential gate; treat as in-epic continuation, not a fresh overlap.
  - `packages/context-bonsai/docs/e2e-testing.md`: same — in-epic continuation.
  - The new `check-credentials.ts` and `e2e-credentials.test.ts` paths are not present at pi HEAD; verify they are `existing-untracked` at the start of the iteration and clear them if so.
- Escalation Status: none (in-epic continuation; no out-of-scope artifacts).
- Decision Citation: user authorization 2026-05-07 "fix the spec, then update the plans … then start orchestrating the changes needed to complete e2e".

## Plan Approval and Commit Status

- Approval Status: approved
- Approval Citation: user message 2026-04-23 "Do commit the plan" (auto mode); amendment authorized 2026-05-07 ("fix the spec, then update the plans to fix run-e2e.sh and whatever else … if you successfully finish the loop with updating the spec/plans and getting approvals from the sub-agents, then consider it approved")
- Plan Commit Hash: 45df8a33 (`docs: approved plans for context-bonsai port epic`); amendment commit hash recorded at amendment time
- Ready-for-Orchestration: yes

## Completion Checklist

- [ ] All acceptance criteria met
- [ ] All seven scenarios PASS in a single `run-e2e.sh --all` run; result recorded in protocol Test Runs
- [ ] Every fix applied during the loop has an accompanying unit or integration regression test
- [ ] `npm run check` passes at the final commit
- [ ] Plan approved and committed before orchestration begins
- [ ] User-model ambiguities resolved or escalated
- [ ] Worktree artifact overlaps resolved (approved direction or explicit deferral)
