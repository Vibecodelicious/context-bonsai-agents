# OpenCode E2E Runbook: Concrete Command Bindings

This runbook supplies the OpenCode-specific commands for two generic procedures: the runtime e2e (`docs/context-bonsai-e2e-template.md`, Protocols A and B) and the pre-publish install gate (`docs/installation-e2e-template.md`, run per `docs/agent-specs/forward-port-spec.md` §2.9). The spec's §4.2 slot cites this document; routine cycle plans copy commands from here instead of inventing them. Verdict rules, phase definitions, scenario semantics, and credential discipline stay in the templates — this document binds only the commands and OpenCode facts the templates leave as slots.

## Command provenance

Every command below carries one of three grounding marks:

- **EXECUTED** — ran against a real bonsai-integrated build with recorded results: `opencode_context_bonsai_plugin/.agents/e2e-transform-and-single-range.md` (its "Test Run 1 - 2026-03-02", a secret-prune-oracle-shaped run that passed) and `opencode_context_bonsai_plugin/context-bonsai-summarization-e2e-testing.md` (2026-02-27). Those records reference the pre-submodule location `/home/basil/projects/opencode_context_management/opencode/`; commands here update that prefix to the current worktree layout, nothing else.
- **SOURCE-VERIFIED** — read from the pinned fork's source at a cited line, or captured from the built binary's `--help` output.
- **COMPOSED** — assembled from EXECUTED and SOURCE-VERIFIED primitives but not yet run end-to-end in this exact sequence.

The composed sequences first run at the next forward-port cycle's gates. If a composed command fails there, that is a finding against this runbook — fix it here, then re-run the gate — not license to improvise a substitute. (The install template applies the same rule to README defects.)

## Shared bindings (both gates)

- **Working directory**: the cycle worktree root (the OpenCode fork checkout named by §4.2's worktree naming), for every command unless its block says otherwise.
- **Binary**: `packages/opencode/dist/opencode-linux-x64/bin/opencode`, platform-equivalent per §4.2. Every code block that uses `$BIN` sets it on its own first line, so each block is copyable in isolation.
- **Plugin wiring** (runtime e2e only): the worktree-local `.opencode/opencode.jsonc` procedure in §4.2, including its grep verification, completed before Protocol A's first launch. Not repeated here. The install gate deliberately uses a different wiring surface — the README's global-config path (Part 2).
- **Model and provider**: all EXECUTED evidence launched with the machine's default OpenCode provider configuration, provisioned out of band per §4.2's Credentials slot; that is the binding — no `--model` flag. Record the provider/model in the template's Test Metadata from the same out-of-band provisioning facts. A `--model <provider>/<model>` override exists and splits the provider id at the first `/` (SOURCE-VERIFIED, `packages/opencode/src/cli/cmd/run.ts:36`); use it only when the cycle brief pins a model, and record the exact value passed.
- **Session identity** (SOURCE-VERIFIED, `packages/opencode/src/storage/db.ts:30-36`): the binary stores sessions in a per-installation-channel SQLite database, `opencode-<sanitized-channel>.db` under the OpenCode data directory (observed live at `~/.local/share/opencode/`, where prior cycles' `opencode-rebase-cycle-<sha>.db` files confirm cycle builds get their own database). `opencode run` without `--continue`/`--session` starts a fresh session; `--continue` resumes the last session of this build's database. The e2e is the only thing that launches the rebased binary during a cycle, so the `--continue` chains inside a protocol are deterministic. Diagnostic fact, not a protocol step: the `OPENCODE_DB` env var (`:memory:` or a path) overrides the database location (`db.ts:38-42`). Before any export, capture `SESSION_ID` from the relevant protocol's launch log/session record (for example, `grep -oE 'sessionID[=:][^[:space:]]+' .../step1.log | head -n1 | sed -E 's/^sessionID[=:]//'`) and verify it is non-empty. Every automated export MUST pass that explicit ID; bare `opencode export` is prohibited because v1.18.3 enters `prompts.autocomplete` and waits for input. Wrap every export in `timeout 60s`.
- **Timeouts**: every launch below is wrapped in `timeout 120`. Exit code 124 (the timeout fired), or any launch that dies before the model responds, is `BLOCKED` at that step — an environmental blocker per the templates' verdict rules, not `FAIL`.
- **Evidence directory** (per §4.2 Evidence paths; worktree-local, uncommitted): `.agent_tmp/e2e-on-<tag>/protocol-a/` and `.agent_tmp/e2e-on-<tag>/protocol-b/`, where `<tag>` keeps the `v` prefix. Create both with `mkdir -p` before Part 1.
- **Per-run parameters**, chosen fresh each run and recorded in the result: `<tag>` — the cycle's upstream tag; `<SECRET>` — one uncommon word not otherwise present in the session (EXECUTED runs used `flamingo`, `zebra`); `<ANCHOR_ID>` — captured during Protocol B, step B3.

### Export inspector

One script serves both protocols and the install gate's smoke. Its field logic is EXECUTED (the 2026-03-02 run's parser); reading the export from a saved file passed as an argument, instead of that run's stdin pipe, is a COMPOSED change made to keep the export as an evidence artifact. Write it once per run:

```bash
cat > .agent_tmp/e2e-on-<tag>/inspect-export.py <<'EOF'
import json, sys
data = json.load(open(sys.argv[1]))
for msg in data['messages']:
    role = msg['info']['role']
    mid = msg['info']['id']
    bonsai = msg['info'].get('metadata', {}).get('opencode-context-bonsai', {})
    for part in msg['parts']:
        if part['type'] == 'text':
            print(f'--- {role} ({mid}) ---')
            if bonsai:
                print(f'[HAS BONSAI METADATA: {json.dumps(bonsai)[:150]}]')
            print(part['text'][:300])
            print()
        elif part['type'] == 'tool':
            tool_name = part.get('tool', '?')
            if 'bonsai' in tool_name:
                print(f'--- {role} tool: {tool_name} ---')
                print('Input: ' + json.dumps(part.get('state',{}).get('input',{}), indent=2)[:300])
                print('Output: ' + str(part.get('state',{}).get('output',''))[:300])
                print()
EOF
```

## Part 1: Runtime E2E (Protocols A and B)

Test Metadata bindings for the runtime template's header: implementation name `opencode_context_bonsai_plugin`; repository root = the cycle worktree; runtime entry point = `$BIN run`; session storage = the per-channel database above, inspected via `$BIN export "$SESSION_ID"`; tool transport = OpenCode plugin loaded from TypeScript source over `file://`.

### Protocol A: Secret Prune Oracle

Steps A1–A2 and the leak-check grep are EXECUTED (the 2026-03-02 run, which passed all three checks). A3 is COMPOSED: the EXECUTED recall prompt plus the template's step-4 requirement to forbid tool use before asking.

```bash
BIN=packages/opencode/dist/opencode-linux-x64/bin/opencode
mkdir -p .agent_tmp/e2e-on-<tag>/protocol-a

# A1 — seed the secret in a fresh session (no --continue: new session)
timeout 120 $BIN run \
  "I'm going to tell you a secret code word. Do not say it back unless I explicitly ask 'what is the code word'. The code word is: <SECRET>. Just acknowledge that you've noted it." \
  --print-logs --log-level DEBUG 2>.agent_tmp/e2e-on-<tag>/protocol-a/step1.log

# A2 — prune the seeding message without reusing the secret
timeout 120 $BIN run --continue \
  "Use context-bonsai-prune to archive the message where I told you the code word. Only that single message needs to be pruned — not your response. Do not repeat the code word in the tool arguments or in your reply." \
  --print-logs --log-level DEBUG 2>.agent_tmp/e2e-on-<tag>/protocol-a/step2.log

# A3 — recall attempt with tool use forbidden
timeout 120 $BIN run --continue \
  "Do not use any tools for the rest of this session. What is the code word?" \
  --print-logs --log-level DEBUG 2>.agent_tmp/e2e-on-<tag>/protocol-a/step3.log
```

Expected tool-call shape in A2 (EXECUTED): two `context-bonsai-prune` calls — the first with no arguments (enables message-ID visibility), the second with `from_id` equal to `to_id`, both targeting the seeding user message; then a success result.

Oracle and evidence collection:

```bash
BIN=packages/opencode/dist/opencode-linux-x64/bin/opencode

# Leak check (EXECUTED): the recall step's output must NOT contain the secret.
grep -i "<SECRET>" .agent_tmp/e2e-on-<tag>/protocol-a/step3.log

# Capture the session used by Protocol A; never run a bare export.
SESSION_ID=$(grep -oE 'sessionID[=:][^[:space:]]+' .agent_tmp/e2e-on-<tag>/protocol-a/step1.log | head -n1 | sed -E 's/^sessionID[=:]//')
test -n "$SESSION_ID"

# Full-session inspection (COMPOSED file-based variant of the EXECUTED parser — see Export inspector)
timeout 60s $BIN export "$SESSION_ID" 2>/dev/null > .agent_tmp/e2e-on-<tag>/protocol-a/export.json
python3 .agent_tmp/e2e-on-<tag>/inspect-export.py .agent_tmp/e2e-on-<tag>/protocol-a/export.json
```

Verdicts, applying the template's rules: **PASS** — the leak-check grep finds no match (exit code 1), the export's final assistant message states the information is unavailable/archived, and the A2 prune calls show a success output with archive metadata present on the anchor message. **FAIL** — the grep matches in A3's assistant response, or the prune result is an error, or the export still shows the secret in an active (non-archived) message's text parts. **BLOCKED** — a launch, provider, plugin-load, or timeout failure before the oracle could run.

### Protocol B: Retrieve Roundtrip

COMPOSED. B1–B2 reuse the EXECUTED summarization-test commands verbatim; B3's extractor and B4's tool name and `anchor_id` argument are grounded below.

```bash
BIN=packages/opencode/dist/opencode-linux-x64/bin/opencode
mkdir -p .agent_tmp/e2e-on-<tag>/protocol-b

# B1 — fresh session with a uniquely bounded discussion (EXECUTED)
timeout 120 $BIN run \
  "Tell me three detailed facts about octopuses. At least a paragraph each." \
  --print-logs --log-level DEBUG 2>.agent_tmp/e2e-on-<tag>/protocol-b/step1.log

# B2 — prune the range (EXECUTED)
timeout 120 $BIN run --continue \
  "That info about octopuses is no longer needed. Please use the context-bonsai-prune tool to archive those messages." \
  --print-logs --log-level DEBUG 2>.agent_tmp/e2e-on-<tag>/protocol-b/step2.log

# B3 — capture the anchor id: the message id carrying archive metadata
SESSION_ID=$(grep -oE 'sessionID[=:][^[:space:]]+' .agent_tmp/e2e-on-<tag>/protocol-b/step1.log | head -n1 | sed -E 's/^sessionID[=:]//')
test -n "$SESSION_ID"
timeout 60s $BIN export "$SESSION_ID" 2>/dev/null > .agent_tmp/e2e-on-<tag>/protocol-b/export-pruned.json
python3 -c "
import json, sys
data = json.load(open(sys.argv[1]))
print('\n'.join(m['info']['id'] for m in data['messages'] if m['info'].get('metadata', {}).get('opencode-context-bonsai')))
" .agent_tmp/e2e-on-<tag>/protocol-b/export-pruned.json
# Exactly one id must print; record it as <ANCHOR_ID>. Zero or multiple ids is a
# FAIL of the capture step — do not guess among candidates.

# B4 — retrieve by anchor id
timeout 120 $BIN run --continue \
  "Use context-bonsai-retrieve with anchor_id <ANCHOR_ID> to restore the archived messages." \
  --print-logs --log-level DEBUG 2>.agent_tmp/e2e-on-<tag>/protocol-b/step3.log

# B5 — verify restoration
timeout 60s $BIN export "$SESSION_ID" 2>/dev/null > .agent_tmp/e2e-on-<tag>/protocol-b/export-restored.json
python3 .agent_tmp/e2e-on-<tag>/inspect-export.py .agent_tmp/e2e-on-<tag>/protocol-b/export-restored.json
```

Grounding for B3–B4: `context-bonsai-retrieve` takes a single `anchor_id` argument, which is the anchor message's id (SOURCE-VERIFIED, `opencode_context_bonsai_plugin/src/retrieve.ts:11` and `:28`); retrieval works by clearing the archive metadata on the anchor message (plugin README, "Usage"). The anchor message id is visible in the export as `info.id`, and the B3 extractor reads the same fields as the EXECUTED parser.

Verdicts: **PASS** — B2's prune succeeded and `export-pruned.json` shows archive metadata; B4's retrieve tool call returns a success output; `export-restored.json` shows the B1 discussion text in active text parts again. **FAIL** — B3 prints zero or multiple ids, retrieve errors, or the restored export still hides the B1 content. **BLOCKED** — as in Protocol A.

Runtime results are recorded per the runtime template's Run Recording and Result Template sections; the artifacts are the step logs and export files above, which stay worktree-local and uncommitted per §4.2.

## Part 2: Pre-publish install gate

Run in the install template's **pre-publish** mode: all sources local, nothing pushed. The template's pre-publish machinery is already OpenCode-literal; this part binds the remaining slots.

### Fresh-machine choice (machine-checkable)

If `sprite list` exits 0, use the sprite flow exactly as the template writes it — its bundle-upload example already names the OpenCode bundle files. Otherwise use the template's sanctioned local variant:

```bash
INSTALL_DIR=$(mktemp -d /tmp/opencode-install-e2e-XXXXXX)
cd "$INSTALL_DIR"
```

and record in the result that the run shared the host toolchain and host OpenCode auth, which the sprite would have excluded.

### Bundles and URL rewrite

The template's pre-publish bundle block, substituting this parent repo's path and the cycle's pin-advanced working branch; the three bundle files are `context-bonsai-agents.git`, `opencode.git`, `opencode_context_bonsai_plugin.git` (template, "making local state look like the published remotes"). Then the template's `GIT_CONFIG_GLOBAL` + `insteadOf` + `protocol.file.allow` block, verbatim.

### Phase 2 — install commands

From `$INSTALL_DIR` (or the sprite's working directory), copy verbatim from `opencode_context_bonsai_plugin/README.md` §"Installation" (clone, `git submodule update --init opencode opencode_context_bonsai_plugin`, `bun install`, `bun run build` from `packages/opencode`, global-config plugin wiring, launch function) — the README is the artifact under test and always wins on divergence; a divergence is a finding, handled per the template's README-update rule. After the clone, `git checkout <working-branch>` per the template's pre-publish rule.

As of plugin commit `b2ce708` the README's wiring step edits the user-global `~/.config/opencode/opencode.json`; in the local-clean-dir variant that edit touches the real host config. Before running the wiring step:

```bash
[ -f ~/.config/opencode/opencode.json ] && cp ~/.config/opencode/opencode.json "$INSTALL_DIR/opencode.json.pre-e2e"
```

### Phase 3 — tool registration

COMPOSED; OpenCode has no offline plugin-tool inventory — its `--help` command list offers `mcp` for MCP servers only, and the README's own verify-load step is LLM-driven. From the fresh clone's `opencode/` directory (`$INSTALL_DIR/context-bonsai-agents/opencode` in the local variant), using the freshly built binary:

```bash
timeout 120 packages/opencode/dist/opencode-linux-x64/bin/opencode run \
  "List the names of all tools available to you, one per line, then stop." \
  --print-logs --log-level DEBUG 2>"$INSTALL_DIR/phase3.log" | tee "$INSTALL_DIR/phase3-stdout.txt"
grep -c 'context-bonsai-prune' "$INSTALL_DIR/phase3-stdout.txt"
grep -c 'context-bonsai-retrieve' "$INSTALL_DIR/phase3-stdout.txt"
```

Both greps must report at least 1. This costs a real LLM call, as the template's LLM-driven-introspection path states.

### Phase 4 — smoke

COMPOSED; Protocol B's sequence rehosted to the fresh clone, minus the deep verification that stays in Part 1. From the same fresh clone's `opencode/` directory:

```bash
BIN=packages/opencode/dist/opencode-linux-x64/bin/opencode
mkdir -p "$INSTALL_DIR/protocol-b"

timeout 120 $BIN run \
  "Tell me three detailed facts about octopuses. At least a paragraph each." \
  --print-logs --log-level DEBUG 2>"$INSTALL_DIR/protocol-b/step1.log"

timeout 120 $BIN run --continue \
  "That info about octopuses is no longer needed. Please use the context-bonsai-prune tool to archive those messages." \
  --print-logs --log-level DEBUG 2>"$INSTALL_DIR/protocol-b/step2.log"

SESSION_ID=$(grep -oE 'sessionID[=:][^[:space:]]+' "$INSTALL_DIR/protocol-b/step1.log" | head -n1 | sed -E 's/^sessionID[=:]//')
test -n "$SESSION_ID"
timeout 60s $BIN export "$SESSION_ID" 2>/dev/null > "$INSTALL_DIR/protocol-b/export-pruned.json"
python3 -c "
import json, sys
data = json.load(open(sys.argv[1]))
print('\n'.join(m['info']['id'] for m in data['messages'] if m['info'].get('metadata', {}).get('opencode-context-bonsai')))
" "$INSTALL_DIR/protocol-b/export-pruned.json"
# Exactly one id must print; record it as <ANCHOR_ID>.

timeout 120 $BIN run --continue \
  "Use context-bonsai-retrieve with anchor_id <ANCHOR_ID> to restore the archived messages." \
  --print-logs --log-level DEBUG 2>"$INSTALL_DIR/protocol-b/step3.log"
```

Pass if the prune and retrieve calls both return success outputs (readable in the step logs or via the export).

### Teardown (local-clean-dir variant only)

Restore or remove the global config the README's wiring step touched, and record the restore in the result:

```bash
if [ -f "$INSTALL_DIR/opencode.json.pre-e2e" ]; then
  cp "$INSTALL_DIR/opencode.json.pre-e2e" ~/.config/opencode/opencode.json
else
  rm -f ~/.config/opencode/opencode.json
fi
```

Sprite runs tear down per the template's Phase 5 instead.

### Result recording

`opencode_context_bonsai_plugin/docs/install-e2e-results-<DATE>.md`, committed in that side repo, with the §4.2-stated consequence: any side-repo commit requires the parent working branch to bump the submodule pin before §2.9 step 5. Record the fields the template's Result Recording section lists; `tweakcc_context_bonsai/docs/e2e-results-*.md` is the structural precedent.

### Credentials

Phase 0, out of band, per the template's credential discipline and §4.2's Credentials slot. Nothing provider-specific lands in the README, this runbook, or any run record.
