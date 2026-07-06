# Cline E2E Runbook: Concrete Command Bindings

This document supplies the concrete commands for the Cline port's e2e procedure, `cline_context_bonsai/docs/e2e-testing.md` (a combined installation+runtime document). `docs/agent-specs/forward-port-spec.md` §4.6 cites this runbook in its E2E slot; routine cycle plans copy commands from here instead of inventing them. Verdict rules, phase definitions, scenario semantics, evidence-channel rules, and credential discipline stay in the procedure doc and the shared templates — this document binds only the commands and Cline facts they leave as slots.

Paths are relative to the parent repo root (`context-bonsai-agents/`) unless a block says otherwise. In a routine cycle, "the fork checkout" means the cycle worktree (`cline/.agent_tmp/rebase-on-<tag>`, with the §4.6 Naming slot's `cline_context_bonsai` sibling symlink already in place — the fork's `package.json` declares `"cline-context-bonsai": "file:../cline_context_bonsai"`, which from the worktree resolves into `.agent_tmp/`); outside a cycle it means `cline/` itself. All EXECUTED citations below ran from the committed `cline/` checkout — the 2026-07-06 run predates the worktree mechanism; in a cycle, run the same commands from the worktree.

## Command provenance

- **EXECUTED** — ran against a real build of the ported harness, with recorded results; each such command cites the evidence (`cline_context_bonsai/docs/e2e-results-2026-07-06-live.md` and the run detail it records).
- **SOURCE-VERIFIED** — read from a cited site in the harness or side-repo source, not yet driven live here.
- **COMPOSED** — assembled from EXECUTED and SOURCE-VERIFIED primitives but not yet run end-to-end in that exact sequence.

The composed sequences first run at the next forward-port cycle's gates. If a composed command fails there, that is a finding against this runbook — fix it here, then re-run the gate — not license to improvise a substitute.

## Shared bindings

- **Runtime under test**: `cli/dist/cli.mjs` inside the fork checkout, freshly built for the run via `npm run cli:build` (EXECUTED — the 2026-07-06 run drove exactly this bundle at Cline CLI 2.16.0). Never an operator-installed `cline`.
- **Drive form** (EXECUTED): first turn, from the fork checkout —

```bash
timeout 240 node cli/dist/cli.mjs task "<prompt>" --yolo \
  --config "$CONFIG_DIR" --cwd "$WORK_DIR" \
  > <evidence-file> 2><stderr-log>
```

  Follow-up turns add `-T "$TASK_ID"` and are each a fresh process rehydrating task state from disk — which is why any multi-turn scenario inherently exercises E2E-06's CLI half (procedure doc, evidence-channel note). `--yolo` selects the non-interactive plain-text path (SOURCE-VERIFIED, `cline/cli/src/index.ts:742`). `$CONFIG_DIR` and `$WORK_DIR` are run-scoped scratch; the fixed default (the EXECUTED run's values) is

```bash
CONFIG_DIR=/tmp/cline-bonsai-e2e/config
WORK_DIR=/tmp/cline-bonsai-e2e/run-cwd
mkdir -p "$CONFIG_DIR" "$WORK_DIR"
```

  Isolating `--config` keeps run state out of the default `~/.cline`.
- **Task id capture**: the first turn prints `Task started: <id>` on stdout (EXECUTED); `TASK_ID=$(grep -oE 'Task started: [0-9]+' <evidence-file> | awk '{print $3}')` is the COMPOSED extraction, and `node cli/dist/cli.mjs history --config "$CONFIG_DIR"` lists ids after the fact (EXECUTED).
- **Timeout wrap**: every LLM-invoking command runs under `timeout 240`; exit 124 records the scenario `BLOCKED`, not `FAIL` (procedure doc rule; the EXECUTED run completed inside the wrap).
- **Evidence directory**: `mkdir -p /tmp/cline-bonsai-e2e/evidence` before Part 1; one stdout capture per drive, `/tmp/cline-bonsai-e2e/evidence/<scenario>.txt` (EXECUTED convention). The whole `/tmp/cline-bonsai-e2e` tree is run-scoped scratch: after the run's findings land in the committed results doc, remove it (`rm -rf /tmp/cline-bonsai-e2e`) per forward-port-spec §1.19.
- **Archive inspector** (EXECUTED method): task state lives at `$CONFIG_DIR/data/tasks/$TASK_ID/` — canonical model-facing history `api_conversation_history.json`, archive sidecar `context_bonsai_archives.json` (records keyed by anchor id, carrying `summary`, `indexTerms`, `archivedMessages`, `anchor.indexInApiHistory`; shapes in `cline_context_bonsai/src/archive-types.ts`). Inspect and assert:

```bash
jq '.archives' "$CONFIG_DIR/data/tasks/$TASK_ID/context_bonsai_archives.json"
grep -c "<secret>" "$CONFIG_DIR/data/tasks/$TASK_ID/api_conversation_history.json"   # 0 after a Protocol A prune
grep -c "<anchor-id>" "$CONFIG_DIR/data/tasks/$TASK_ID/api_conversation_history.json" # >0: placeholder present
```

  Task files under an isolated `--config` are the run's own state; task files under `~/.cline` are live user state and are never read, edited, or committed.

## Part 1: Runtime E2E

### Build and offline registration probe

EXECUTED (2026-07-06 run). From the fork checkout:

```bash
npm run cli:build
node cli/dist/cli.mjs version                # prints: Cline CLI version: <version>
grep -c "context-bonsai-prune" cli/dist/cli.mjs   # EXECUTED result: 25 hits
```

`npm run cli:build` requires hydrated dependencies at both the fork root and `cli/` (`npm install` in each — the README install sequence in Part 2). The grep proves the tools are *compiled in*, not that they *register* — a build check that never substitutes for the LLM-driven check below (procedure doc, tool-registration trap 1).

### Live registration check

EXECUTED (2026-07-06 — the reply listed both bonsai tools among Cline's 15 native tools). From the fork checkout:

```bash
timeout 240 node cli/dist/cli.mjs task \
  "List your available tool names exactly, one per line, then stop. Do not use any tools." \
  --yolo --config "$CONFIG_DIR" --cwd "$WORK_DIR" \
  > /tmp/cline-bonsai-e2e/evidence/tool-list.txt 2>&1
```

PASS: the reply names both `context-bonsai-prune` and `context-bonsai-retrieve`. Exit 0 with either name absent is `FAIL` (`tools-not-registered`), regardless of the grep probe.

### E2E-01 / E2E-07 — contiguous prune and Protocol A

EXECUTED 2026-07-06 as one drive (task `1783312285634`, anchor `cb-17833122-1`, 3 messages archived): seed turn, prune turn in a new `-T` process, host-state checks, recall turn in a further new process with tools forbidden. Drive steps, assertions, and the never-quote-the-secret discipline are the procedure doc's E2E-01 and E2E-07 bindings; the commands are the shared drive form plus the archive inspector above. EXECUTED trap: a prune pattern that also matches your instruction text makes the boundary ambiguous — refer to the span descriptively (the run's first two prune attempts were rejected exactly this way, which doubled as extra E2E-02 evidence).

### E2E-02 — ambiguity rejection

EXECUTED 2026-07-06 (task `1783312463937`): seed the same marker in two user messages, then instruct a prune with `from_pattern` set to exactly that marker. PASS: deterministic tool-result rejection — `context-bonsai-prune failed (pattern_ambiguous): from_pattern matched 2 messages; must match exactly one` — and no archive file (or no new record) in the task directory.

### E2E-03 — retrieve by anchor

EXECUTED 2026-07-06: follow-up `-T` turn instructing `context-bonsai-retrieve` with the exact anchor id from the prune result (never make the model guess it). PASS: the model quotes the restored content; host state shows the span back in `api_conversation_history.json`, the record gone from `context_bonsai_archives.json` (empty `archives` map), zero placeholder text remaining.

### E2E-06 — persistence across resume (CLI half)

EXECUTED 2026-07-06: the prune landed in one process and the recall turn ran in a later `-T` process — placeholder visible, secret not, after full rehydration from disk. The VS Code **checkpoint-restore half is manual and unexecuted** (no headless drive surface; fork gate at `cline/src/integrations/checkpoints/index.ts`) — recorded as the explicit manual half per the e2e spec's automation-split rule, not part of the automated gate.

### Open live scenario — E2E-04 (gauge)

**Bound, never executed live.** The first routine cycle that reaches the live e2e gate must run it; until it passes, no full parity claim exists (procedure doc, parity-claim status). Before treating a cycle as that "first" one, grep the prior committed records — `grep -l 'E2E-04' cline_context_bonsai/docs/e2e-results-*-live.md` — for existing PASS evidence. The drive is COMPOSED: the gauge is appended to user content every `DEFAULT_GAUGE_CADENCE_TURNS = 5` API turns (SOURCE-VERIFIED, `cline_context_bonsai/src/gauge.ts:27`; injection site `cline/src/core/task/index.ts:2342`, `injectBonsaiGaugeIfDue`). Run a task past API turn 5 with repeated `-T` follow-ups; on a cadence turn, with tool use forbidden for that turn, ask the model to quote verbatim any context-pressure guidance it sees; off-cadence turns must show no gauge quote. Evidence is the follow-up model quote only, and the gauge fails silent when usage data is unavailable — apply the procedure doc's usage-availability check before counting a missing gauge as FAIL.

E2E-05 stays non-live per its recorded justification (procedure doc); fail-closed behavior is carried by the side repo's `npm test` and the fork's `ContextBonsaiApplier` tests.

## Part 2: Installation E2E

**No fresh-machine run has been executed for this port** (procedure doc, Phase 1 status): the 2026-07-06 run built from the existing maintainer checkout. The install-command tail (`npm run cli:build`, `node cli/dist/cli.mjs version`) is EXECUTED; the fresh-machine sequence as a whole is COMPOSED.

### Fresh machine and install commands

Fresh-machine model is a sprite, provisioned from scratch and destroyed at teardown (`sprite create <run-name>` / `sprite destroy <run-name>`; no checkpoint). Install per the side repo's README (COMPOSED shape; Node.js + npm are the only prerequisites the fork declares):

```bash
git clone https://github.com/Vibecodelicious/context-bonsai-agents.git
cd context-bonsai-agents
git submodule update --init cline cline_context_bonsai
cd cline
npm install
cd cli && npm install && cd ..
npm run cli:build
node cli/dist/cli.mjs version
grep -c "context-bonsai-prune" cli/dist/cli.mjs
```

Pre-publish runs source the parent and both submodules from local `git bundle` files via scoped `url.insteadOf` + `protocol.file.allow` (procedure doc, pre-publish sourcing; bundle URL tails `context-bonsai-agents.git`, `cline.git`, `cline_context_bonsai.git`). Push nothing.

### Phase 3 — tool registration, and Phase 4 — smoke

The live registration check, then a Part 1 prune/retrieve smoke (E2E-01 + E2E-03 shape) against the same config dir. The offline grep passing while the live check fails is a `FAIL` (`tools-not-registered`).

### Credentials

Phase 0, out of band, per the procedure doc: `cline auth -p <provider> -k <key> -m <model> --config "$CONFIG_DIR"` configures any supported provider non-interactively (EXECUTED with `-p claude-code -m claude-sonnet-4-5-20250929` and a non-secret sentinel key — that provider drives the machine's own authenticated `claude` CLI and ignores the key; any non-empty placeholder satisfies the flag — fixed default: `-k not-a-real-key`). EXECUTED trap: with any of `-p`/`-k`/`-m` missing, `cline auth` silently drops into an interactive Ink UI and hangs a headless rig — supply all three, always. Run records name the provider only; no keys and no auth files in any command, record, or artifact. A rig-held key is rotated at teardown (none exists under the `claude-code` provider).

### Result recording

Run results land in the side repo as `cline_context_bonsai/docs/e2e-results-<DATE>-live.md`, committed there, plus a row in the procedure doc's Run records table (the 2026-07-06 record is the precedent). Raw stdout captures and task-directory files stay in the rig — they carry live transcript data and are never committed.

### Teardown

`sprite destroy <run-name>` for sprite runs. Local runs remove their own scratch per forward-port-spec §1.19: `rm -rf /tmp/cline-bonsai-e2e` after the results doc is committed, and the cycle worktree (with its `cline_context_bonsai` symlink shim) at seal, once the replay branch and tag are recorded in the fork repo. Never touch `~/.cline/**` state or any live `claude` CLI auth beyond what the provider spawn itself does.
