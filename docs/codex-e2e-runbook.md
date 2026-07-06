# Codex E2E Runbook: Concrete Command Bindings

This document supplies the concrete commands for the Codex port's e2e procedure, `codex_context_bonsai/docs/e2e-testing.md` (a combined installation+runtime document). `docs/agent-specs/forward-port-spec.md` §4.5 cites this runbook in its E2E slot; routine cycle plans copy commands from here instead of inventing them. Verdict rules, phase definitions, scenario semantics, and credential discipline stay in the procedure doc and the shared templates — this document binds only the commands and Codex facts they leave as slots.

Paths are relative to the parent repo root (`context-bonsai-agents/`) unless a block says otherwise. In a routine cycle, "the fork checkout" means the cycle worktree (`codex/.agent_tmp/rebase-on-<tag>`, with the §4.5 Naming slot's `codex_context_bonsai` sibling symlink already in place); outside a cycle it means `codex/` itself. All EXECUTED citations below ran from the committed `codex/` checkout — the 2026-05-20 run predates the worktree mechanism; in a cycle, run the same commands from the worktree.

## Command provenance

- **EXECUTED** — ran against a real build of the ported harness, with recorded results; each such command cites the evidence (`codex_context_bonsai/docs/e2e-results-2026-05-20-live.md` and the artifact files it names).
- **SOURCE-VERIFIED** — read from a cited site in the harness or side-repo source, not yet driven live here.
- **COMPOSED** — assembled from EXECUTED and SOURCE-VERIFIED primitives but not yet run end-to-end in that exact sequence.

The composed sequences first run at the next forward-port cycle's gates. If a composed command fails there, that is a finding against this runbook — fix it here, then re-run the gate — not license to improvise a substitute.

## Shared bindings

- **Runtime under test**: `codex-rs/target/debug/codex` inside the fork checkout, freshly built for the run (EXECUTED — the 2026-05-20 run drove exactly this binary). Never the operator's own installed `codex`.
- **Drive form**: first turn `codex exec --json "<prompt>" > <evidence-file> 2><stderr-log>`; follow-up turns `codex exec --json resume <session-id> "<prompt>"` (first-turn form EXECUTED; resume form SOURCE-VERIFIED, `codex/codex-rs/exec/src/cli.rs:141` — `codex exec resume --last` is the same surface). The session id is the stream's first event (SOURCE-VERIFIED, `codex/codex-rs/exec/src/exec_events.rs` — `thread.started` carries `thread_id`, documented there as the resume handle):

```bash
SESSION_ID=$(head -1 <evidence-file> | jq -r 'select(.type == "thread.started") | .thread_id')
```
- **Timeout wrap**: every LLM-invoking command runs under `timeout 240`; exit 124 records the scenario `BLOCKED`, not `FAIL` (COMPOSED — the shared-template discipline; the 2026-05-20 run used no wrapper).
- **Evidence directory**: `mkdir -p /tmp/codex-bonsai-e2e` before Part 1; one JSONL capture per drive, `/tmp/codex-bonsai-e2e/<scenario>.jsonl` (EXECUTED convention — `tool-list.jsonl`, `prune-smoke.jsonl`, `prune-clean.jsonl`, `prune-invented.jsonl`, `retrieve-invented.jsonl`, `protocol-a-oracle.jsonl`). The directory is cycle-scoped scratch: after the run's findings land in the committed results doc, remove it (`rm -rf /tmp/codex-bonsai-e2e`) per forward-port-spec §1.19.
- **Archive inspector** (EXECUTED method, 2026-05-20): sessions persist under `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl`; archive entries are `"type":"compacted"` items carrying a `bonsai_archive` field — the Rust type names (`CompactedItem`, `BonsaiArchivePayload`) never appear in the JSON. Find and inspect:

```bash
grep -l '"bonsai_archive"' ~/.codex/sessions/*/*/*/rollout-*.jsonl
jq -c 'select(.type == "compacted") | .bonsai_archive' <rollout-file>
```

Rollout files are live user/session state: read them for evidence, never edit them, never commit them (§4.5 non-targets).

## Part 1: Runtime E2E

### Build and offline registration probe

EXECUTED (2026-05-20 run, Setup). From the fork checkout's `codex-rs/`:

```bash
cargo build --bin codex
strings target/debug/codex | grep -E 'context-bonsai-(prune|retrieve)'
```

On a memory-constrained rig (the sprite baseline is ~8GB RAM / ~8GB disk), the documented accommodation is `CARGO_INCREMENTAL=0 CARGO_PROFILE_DEV_DEBUG=0 cargo build --bin codex` (EXECUTED — the 2026-05-20 build timed out at the link step without it). The `strings` probe proves compilation only, not runtime registration — it never substitutes for the LLM-driven check below.

### Live registration check

EXECUTED (artifact `tool-list.jsonl`, thread `019e46c9-4ec0-72a2-b0c6-6bd1fd1de29d`). From the fork checkout's `codex-rs/`:

```bash
timeout 240 target/debug/codex exec --json \
  "List your available tool names exactly, then stop." \
  > /tmp/codex-bonsai-e2e/tool-list.jsonl 2>/tmp/codex-bonsai-e2e/tool-list.log
```

PASS: the event stream names `functions.context-bonsai-prune` and `functions.context-bonsai-retrieve`. Exit 0 with either name absent is `FAIL` (`tools-not-registered`), regardless of the `strings` probe.

### E2E-01 / E2E-02 — contiguous prune and ambiguity rejection

Steps and assertions EXECUTED 2026-05-20 (artifacts `prune-smoke.jsonl`, `prune-clean.jsonl`, `prune-invented.jsonl`; E2E-01 anchor `bonsai-anchor-8b074d69114675e5`); the exact re-drive sequence below is COMPOSED from those turns plus the resume form.

1. First turn: have the model produce two distinctive marker lines it invents itself, capturing to `prune-invented.jsonl`. Markers quoted from your own prompt make the boundary ambiguous — the model must invent them (EXECUTED trap: the run's first two attempts demonstrated exactly this rejection, `context-bonsai-prune rejected: from_pattern was ambiguous: matched 3 messages`, which doubles as the E2E-02 PASS evidence — deterministic rejection, no anchor id, no new archive entry).
2. Follow-up turn (`resume <session-id>`): instruct a prune between the two markers. PASS: tool result `Archived ...` with an anchor id in the event stream, plus a new `bonsai_archive` entry in the session's rollout file (archive inspector above).
3. Placeholder visibility is claimed only from a follow-up turn in which the model quotes the placeholder text — the `--json` event stream of the pruning turn provably cannot carry model-visibility evidence (procedure doc, evidence-channel rule).

### E2E-03 — retrieve by anchor

EXECUTED 2026-05-20 (artifact `retrieve-invented.jsonl`). Follow-up turn in the same session: instruct retrieval passing the exact anchor id from E2E-01's tool result (never make the model guess it). PASS: retrieve tool result in the event stream, then a further turn in which the model quotes the restored text.

### E2E-07 — Protocol A, secret-prune oracle

EXECUTED 2026-05-20 (artifact `protocol-a-oracle.jsonl`, thread `019e46cd-47c9-7643-a77d-2f5a6e4840bf`, anchor `bonsai-anchor-ab8e5f72cf9b7fc7`) — the derivation record's required real-build Protocol A run. Drive per the procedure doc's oracle method: seed a code word, prune the seeding span, then ask for it back **without quoting it in your prompts or tool arguments** (discipline 2). PASS: the recall turn's reply is non-empty and non-leaking (the run's reply: "It is unavailable because it was pruned."), the rollout file carries the archive entry, and the prune tool-call arguments are secret-free.

### Open live scenarios — E2E-04 (gauge) and E2E-06 (resume persistence)

**Bound, never executed live.** The first routine cycle that reaches the live e2e gate must run both; until they pass, no full parity claim exists (procedure doc, Stage 5 record). Before treating a cycle as that "first" one, grep the prior committed records — `grep -l 'E2E-04\|E2E-06' codex_context_bonsai/docs/e2e-results-*-live.md` — for existing PASS evidence. Both drives are COMPOSED:

- **E2E-04**: the gauge line is hook-injected every `GAUGE_CADENCE_TURNS = 5` user turns (SOURCE-VERIFIED, `codex_context_bonsai/src/lib.rs:45`; hook site `codex/codex-rs/hooks/src/events/user_prompt_submit.rs`). Drive the session past user turn 5; on a cadence turn, with tool use forbidden for that turn, ask the model to quote verbatim any context-pressure guidance it currently sees; off-cadence turns must show no gauge quote. Evidence is the follow-up model quote only — the event stream cannot carry hook-injection claims. Verdict semantics stay in the procedure doc's E2E-04 binding.
- **E2E-06**: after an E2E-01-style prune, end the process, then `codex exec --json resume <session-id>` and have the model quote the placeholder (and retrieve by the recorded anchor id). PASS additionally requires the `bonsai_archive` rollout entry to survive reload — the reconstruction path is SOURCE-VERIFIED (`codex/codex-rs/core/src/session/rollout_reconstruction.rs`), which is precisely what this scenario upgrades to behavior-verified.

E2E-05 stays non-live per its recorded justification (procedure doc); the side crate's `cargo test` covers the fail-closed path.

## Part 2: Installation E2E

The procedure doc's Phases 1–4 ran EXECUTED on 2026-05-20 (sprite `codex-bonsai-e2e-20260519`, clone at `/home/sprite/context-bonsai-agents`), with one recorded rig accommodation (the build variant above).

### Fresh machine and install commands

Fresh-machine model is a sprite, provisioned from scratch and destroyed at teardown (`sprite create <run-name>` / `sprite destroy <run-name>`; no checkpoint). Install per the side repo's README (EXECUTED shape):

```bash
git clone https://github.com/Vibecodelicious/context-bonsai-agents.git
cd context-bonsai-agents
git submodule update --init codex codex_context_bonsai
cd codex/codex-rs
cargo build --bin codex
strings target/debug/codex | grep -E 'context-bonsai-(prune|retrieve)'
```

Build prerequisites recorded by the 2026-05-20 run: `build-essential pkg-config libcap-dev libseccomp-dev` plus rustup (the fork pins `channel = "1.93.0"` in `codex-rs/rust-toolchain.toml`). Pre-publish runs source the parent and both submodules from local `git bundle` files via scoped `url.insteadOf` + `protocol.file.allow` (procedure doc, pre-publish sourcing; bundle URL tails `context-bonsai-agents.git`, `codex.git`, `codex_context_bonsai.git`).

### Phase 3 — tool registration, and Phase 4 — smoke

The live registration check and a Part 1 prune/retrieve smoke (E2E-01 + E2E-03 shape), run against the freshly installed build. The offline `strings` probe passing while the live check fails is a `FAIL` (`tools-not-registered`).

### Credentials

Phase 0, out of band, per the procedure doc: Codex's own sign-in flow (ChatGPT account or OpenAI API key), provisioned in the rig before the run and destroyed with it; a hand-provisioned API key is rotated at teardown. Presence probe: `codex login status` (SOURCE-VERIFIED — `codex/codex-rs/cli/src/login.rs`, dispatched from `cli/src/main.rs`). Run records name the provider only; nothing provider-specific lands in the README, this runbook, or any run record.

### Result recording

Run results land in the side repo as `codex_context_bonsai/docs/e2e-results-<DATE>-live.md`, committed there (the 2026-05-20 record is the precedent; `tweakcc_context_bonsai/docs/e2e-results-*.md` is the structural precedent). Full rollout files stay in the rig — they carry live transcript data and are never committed.

### Teardown

`sprite destroy <run-name>` for sprite runs. Local runs remove their own scratch per forward-port-spec §1.19: `rm -rf /tmp/codex-bonsai-e2e` after the results doc is committed, and the cycle worktree (with its `codex_context_bonsai` symlink shim) at seal, once the replay branch and tag are recorded in the fork repo. Never touch `~/.codex/**` auth or sessions beyond the read-only archive inspection.
