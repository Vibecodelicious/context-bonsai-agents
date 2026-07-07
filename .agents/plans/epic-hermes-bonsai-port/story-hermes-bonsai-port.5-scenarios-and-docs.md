# Story: Scenario matrix, persistence across resume, operator docs

**Epic:** epic-hermes-bonsai-port (read `epic-hermes-bonsai-port.md` first)
**Size:** Medium
**Dependencies:** Stories 1–4

## Story Description

Consolidation and hardening. One runner drives the full automatable scenario matrix through the stub against the real CLI; persistence across process restart and `/resume` gets its own drive; the operator documentation lands (the shared spec's Operator Documentation Contract); and the story closes with a full regression re-run plus complete Binding Sites data for the epic seal. Live-model scenarios (the behavioral secret-prune oracle, Protocol A) are Stage 5 non-goals — but the payload form of the oracle IS in scope here: post-prune provider requests must never contain the pruned secret.

## User Model

Inherited from the epic. This story's primary readers are the non-developer operator following the README verbatim on a clean machine, the security auditor reading the disclosure section, and the Stage 5/6 pipeline stages consuming the scenario runner and Binding Sites data.

## Scenario matrix (each row = a scripted stub scenario + assertions in `scripts/run-scenarios.sh`)

Rows 1–6 may reuse/absorb the per-story drive scripts; the runner must execute every row from a fresh scratch HERMES_HOME and report per-row PASS/FAIL.

1. Engine liveness positive + negative (Story 1's smoke).
2. Prune success: placeholder in next request, archived text absent, store record, host rows soft-archived.
3. Ambiguous boundary rejection: error result, zero mutation.
4. Retrieve success + same-step guard.
5. In-place-off compatibility error.
6. Gauge cadence/bands + silence.
7. **Secret payload oracle:** a scenario seeds a distinctive secret string in early turns, prunes the range containing it, then runs two more turns; assert the secret appears in NO provider request after the prune realization, while the placeholder's summary/index terms (which must not contain the secret) do.
8. **Persistence across restart:** run a session that prunes; end the process; re-invoke `hermes` resuming the SAME session via the top-level `--resume/-r <SESSION>` flag (`hermes_cli/_parser.py:145-150`). **Amended during execution (SPEC-GAP, 2026-07-07):** `--resume` does NOT compose with `-z` — the oneshot dispatch (`main.py:13604-13614`) calls `run_oneshot` (`oneshot.py:125`, no resume parameter, bypasses cli.py) and always starts a fresh session, and argparse rejects `-z --resume` anyway (`-z` consumes the next token as PROMPT). The real resume entry point is the interactive REPL: `hermes --resume <id>` (`cli.py:3930`), driven via PTY with `tools/repl_driver.py --resume`; record the exact invocation driven; assert the resumed session's first provider request still renders the placeholder and not the archived text (archive store rehydration + host `active=1` filter together survive restart), and that retrieve-by-anchor still works post-restart.

## Operator documentation (README.md, replacing Story 1's stub)

Per the shared spec's Operator Documentation Contract, covering: prerequisites (Hermes version = the frozen tag, Python/uv); install commands teaching the moves (copy/symlink `context-bonsai/` into `$HERMES_HOME/plugins/`, add `plugins.enabled` and `context.engine: bonsai` and `compression.in_place: true` to `config.yaml`) at user-global scope; post-install verification (a concrete positive check that the bonsai engine — not the silent fallback — is live; base it on the liveness evidence class from Story 1 and any user-runnable status surface source-verified in the harness, e.g. the status display path at `cli.py:9414-9419`); the Compaction Duty Displacement statement (selecting bonsai turns OFF built-in auto-summarization and what replaces it — contract-half requirement); security disclosure (reads session store read-only, archive state at `$HERMES_HOME/context_bonsai/`, placeholder summary/index terms go to the provider, archived originals do not, no separate network egress); uninstall (remove plugin dir, config lines, and archive state). Also `DEVELOPMENT.md`: repo layout, how to run tests/drives against a frozen harness clone, the `HERMES_AGENT_ROOT` convention. The document-writing quality loop for these two files is run by the owner tier at review; the executor's duty is source-truth (every command tested verbatim in the scratch environment) and completeness against the contract categories.

## Acceptance Criteria

- [ ] `scripts/run-scenarios.sh` runs all 8 rows from clean state, prints per-row verdicts, exits 0 only on all-PASS.
- [ ] Row 7 and row 8 implemented with the assertions above; row 8's driven path documented in the completion report.
- [ ] README.md covers every Operator Documentation Contract category; every command in it was executed verbatim during this story (evidence in the run log).
- [ ] DEVELOPMENT.md present.
- [ ] Full regression: all validation commands green; scenario matrix green twice consecutively (flake check).
- [ ] Complete Binding Sites completion data: for every key in the bindings document's table, the realized side-repo site (file, function/storage location) — in the completion report.
- [ ] pytest + ruff green; baseline compared; scope diff clean.

## Context References

- Spec pair: E2E Priorities; Fail-Closed Requirements; Compaction Duty Displacement (operator-doc obligations). Shared spec: Operator Documentation Contract; Minimum Validation Scenarios; Evidence Expectations.
- Harness: `docs/session-lifecycle.md`; `hermes_cli/_parser.py` (session/resume-relevant flags); `hermes_state.py:3721-3735` (`get_messages_as_conversation` active filter).

### New Files to Create

`scripts/run-scenarios.sh`, scenario files, `README.md` (rewrite), `DEVELOPMENT.md`, tests as needed. Modified: drive scripts being absorbed, `scripts/setup-scratch-home.sh`.

## Testing Strategy

The scenario runner IS the test; unit tests only where new pure logic appears.

## Validation Commands

From the side repo root:

- `HERMES_AGENT_ROOT=/home/basil/scratch/hermes-bonsai-stage4/hermes-agent uv run --project /home/basil/scratch/hermes-bonsai-stage4/hermes-agent pytest tests -q`
- `uvx ruff@0.15.10 check .`
- `bash scripts/run-scenarios.sh`
- `bash scripts/run-scenarios.sh` (second consecutive run — flake check)

## Worktree Artifact Check

Clean `git status` at story start or STOP.

## Plan Approval and Commit Status

- Approval Status: approved (same citations as Story 1)
- Ready-for-Orchestration: yes (after plan commit)

## Completion Checklist

- [ ] Acceptance criteria met; scenario matrix green twice
- [ ] Operator docs complete and command-verified
- [ ] Completion report: full Binding Sites completion data; SPEC-GAP/EXECUTOR-FAIL candidates; row-8 driven-path record
- [ ] Intent log updated at phase boundaries
