# Context Bonsai Installation E2E Testing Template

## Purpose

Use this template to write an installation end-to-end validation protocol for a specific Context Bonsai port. Each per-port instance verifies that **a user can install and use Context Bonsai for the given harness** by starting from a fresh machine, executing the port's documented install commands verbatim, and confirming the bonsai tools are actually loaded and usable inside the host.

This template is the installation-side complement to `docs/context-bonsai-e2e-template.md`, which validates runtime feature behavior. The two are non-overlapping: runtime e2e assumes the port is installed; installation e2e proves the install path itself works.

## Scope

This template covers only what is between "fresh machine" and "the host reports `context-bonsai-prune` and `context-bonsai-retrieve` (or the port's equivalent tool names) as available, and a single smoke tool call succeeds."

Out of scope: deep feature behavior, ambiguity-rejection, secret-prune oracle, persistence across resume — all of those live in the runtime template.

## Test Metadata

- Implementation name: `[port name, e.g. pi-context-bonsai]`
- Repository under test: `[absolute URL or path]`
- Branch / commit pinned: `[commit hash]`
- Host runtime entry point: `[binary or CLI command the operator will run]`
- Host install summary: `[brief one-line summary, e.g. "git clone + npm install + .pi/extensions auto-discovery"]`
- Fresh-machine source: fly.io sprite (see "Fresh-Machine Model" below)
- Date: `[UTC timestamp]`
- Operator: `[name]`

## Credential and Audience Discipline (READ FIRST)

The operator README this e2e validates is written for random readers using their choice of provider on their choice of OS. The number of combinations exceeds what we can or should enumerate.

Consequences for both the documented install path and this e2e:

- **Operator docs MUST NOT prescribe a provider, model, API key, or credential-provisioning procedure.** Those are the operator's choice, governed by their host's existing provider documentation.
- **Operator docs MUST NOT contain credentials of any kind.** Same rule for this template, per-port e2e instances derived from it, run records, and any artifact that lands in version control.
- **Credential provisioning is harness-setup, not a step a user follows.** This e2e provisions credentials in the sprite *before* Phase 1, out of band. The per-port doc owner picks an approach (env var, secret file, host's interactive login flow, copy from a sealed store) and treats it as test-rig configuration, not as content the operator README ever sees.
- When the harness uses temporary credentials for a test run, those credentials must be destroyed or rotated with the sprite at teardown.

## Why The Sprite

The sprite exists to give the docs a known baseline that does **not** include whatever the author of the docs happens to have installed on their own laptop. The docs author cannot see their own local state — that's exactly the problem. Following instructions verbatim in a sprite reveals every hidden dependency the author would otherwise have invisibly relied on.

The sprite is NOT a stand-in for "a real user's machine" — no two real users have the same machine, and the docs can't be tested against all of them. The sprite is a stand-in for "a starting state that doesn't include the author's blind spots." If the docs work in the sprite, they're at least free of the author's specific local-state assumptions. Real users on weirder configurations may still hit issues; that's outside what this test catches.

Each run resets the sprite so test runs don't pollute each other. Two reset patterns:

1. **Provision-from-scratch**: `sprite create <run-name>`. Slower; use for one-off runs.
2. **Restore-from-checkpoint**: maintain a base checkpoint and `sprite restore <checkpoint-id>` before each run. Faster for iteration.

The per-port doc states which pattern it uses. If checkpoint-based, it states what's in the checkpoint so the baseline is reproducible.

Teardown: `sprite destroy <name>` for one-off runs, or `sprite checkpoint create` + `sprite restore` to seed the next run. Any temporary credentials provisioned during the run must not survive teardown.

## Driving the Sprite

`sprite create <name>` auto-attaches a console for the new sprite. For reconnects after a session drop, use `sprite console`. Both require a TTY.

Two channels are useful during a run:

- **Non-interactive commands**: `sprite exec <cmd>` or `sprite x <cmd>` for the install commands themselves and any verification command whose output is parseable from stdout/stderr.
- **Interactive host launches**: drive via tmux when the host is a TUI or the run needs multi-turn dialogue. The pattern is from `pi/AGENTS.md` ("Testing pi Interactive Mode with tmux"):

  ```bash
  # Create the tmux session for this run (or reuse a pre-existing one)
  tmux new-session -d -s install-e2e -x 120 -y 40

  # Reconnect into the activated sprite
  tmux send-keys -t install-e2e "sprite console" Enter
  sleep 3

  # Drive the host
  tmux send-keys -t install-e2e "<host-launch-command>" Enter
  sleep 5 && tmux capture-pane -t install-e2e -p > /tmp/install-e2e-pane-$(date +%s).txt

  # Cleanup
  tmux kill-session -t install-e2e
  ```

Capture pane state to artifact files so the verdict is auditable.

## Phases

### Phase 0 — Harness setup (before the test begins)

Done by the e2e operator, not by anyone reading the port's documentation:

- Provision credentials in the sprite via the chosen harness-setup approach. Document in the run record WHICH provider was used (so the run is reproducible by the same harness operator), but NOT in the operator-facing README.
- Verify the host's own dependencies (runtime versions, build tools) match what the port's README declares as Prerequisites. A mismatch here makes Phase 2 verification meaningless.

### Phase 1 — Provision a fresh machine

Apply one of the two fresh-machine patterns. Record the sprite name, the checkpoint id (if applicable), and the resulting `sprite list` row so the run is reproducible.

### Phase 2 — Execute documented install commands verbatim

Copy each command from the port's operator README and execute it inside the sprite in the documented order. Do NOT substitute, abbreviate, or extend. If a command fails or its output diverges from what the README claims, that is itself a finding.

If the README supports multiple platforms, the run record states which platform was validated. (Per the cross-agent spec's Operator Documentation Contract, install coverage is bounded by the port's declared support matrix.)

For each command record: exit code, any stderr, any file/path it created or modified.

### Phase 3 — Verify the bonsai tools are actually loaded

This is the gate that "install commands exited 0" alone cannot satisfy.

The host MUST report the bonsai tools as available. Approaches vary by host; the per-port doc identifies which one applies:

- **Offline tool-inventory command** if the host has one (e.g., `mcp list` style). One `sprite exec` call; grep for the bonsai tool names.
- **LLM-driven introspection** if the host has no offline path (Pi is in this category — its `list` subcommand surfaces a different extension surface and produces misleadingly empty results for auto-discovered extensions). The verification runs the host with a "list your tools, then stop" prompt and greps the host's output (or transcript / JSON event stream) for `context-bonsai-prune` and `context-bonsai-retrieve` or the port's equivalent tool names. This costs a real LLM call.

A run that reaches Phase 3 but cannot find the bonsai tools is a `FAIL` regardless of whether install commands themselves exited 0. This is the failure mode runtime e2e cannot catch on its own — runtime e2e harnesses typically load the extension via an explicit-path flag and so never exercise the user's actual install path.

### Phase 4 — Smoke a single feature call (optional but recommended)

Drive one prune call and one retrieve call (or just prune if the port's same-step model differs) to confirm the loaded tools actually execute end-to-end, not just register as names. Intentionally minimal — deep coverage stays in the runtime template.

Pass if both tool calls return their host's success shape. Fail if either returns a compatibility/loader-style error indicating an install step was missed.

### Phase 5 — Teardown

`sprite destroy <name>`, or `sprite checkpoint create` followed by a `sprite restore` to the base. Any harness-provisioned credentials MUST be destroyed or rotated.

## Verdict Rules

- `PASS`: Phases 1–3 succeed; Phase 4 (if run) succeeds.
- `BLOCKED`: Sprite provisioning fails, host runtime unavailable, harness credentials missing, network outage, or other environmental precondition. NOT a failure of the port's install path.
- `FAIL`: Install commands exit 0 but tools not found in Phase 3; Phase 4 smoke returns a compatibility error; or any install command's output materially contradicts the README.

Reason codes: `provisioning-failed`, `host-runtime-missing`, `credentials-missing-in-harness`, `install-command-failed`, `tools-not-registered`, `tools-registered-but-smoke-failed`, `readme-output-divergence`, `clean-pass`.

## Result Recording

Each run produces an artifact under the port's repo (e.g., `<port>/docs/install-e2e-results-<DATE>.md`):

- Timestamp, sprite name, checkpoint id (if any), branch/commit pinned for the port
- Each install command run, its exit code, stdout/stderr snippet
- Verification command output (verbatim grep hit on the tool names)
- Smoke call results if Phase 4 was run
- Verdict + reason code
- Notable observations — anything the operator wants the next operator to know (e.g., "the README's macOS Homebrew step required also running `brew tap mongodb/brew`" or "Pi's `list` subcommand reports 'No packages installed' even when bonsai is correctly auto-discovered — this is a Pi UX trap, document a different verification path")

**No credentials in run records.** Provider identity may be recorded; keys, tokens, secrets must not be.

The first FAIL of any per-port install-e2e is canonical evidence that the operator README needs an update. The README update lands first, then the e2e re-runs against the updated README until PASS.

## Pass Criteria For A Port Claim

A port can claim Context Bonsai installation parity only when:

- The most recent install-e2e run is `PASS`.
- The run used unmodified install commands from the port's current operator README.
- Phase 3 confirmed `context-bonsai-prune` and `context-bonsai-retrieve` (or the host's equivalent names) are loaded.

A `PASS` that depended on a manual workaround the README does not document is not a `PASS`. The workaround either becomes part of the README (and the e2e re-runs to confirm) or is surfaced in the README as a known gap.

## Host Adaptation Notes

- **Hosts with multiple extension surfaces (e.g., Pi):** `pi list` reports settings-managed packages, NOT auto-discovered ones. A port that lives on the auto-discovery surface produces misleadingly empty output from `pi list`. Per-port docs MUST identify which surface their port uses and select Phase 3 verification accordingly.
- **MCP-backed ports (Claude Code, others):** Phase 3 may use the host's native `mcp list` (offline) instead of an LLM-driven prompt.
- **TUI-only hosts:** drive via tmux per the section above; capture pane state as the verification artifact.
- **Hosts requiring a patch to the upstream binary (Claude Code + tweakcc):** Phase 2 includes the patch-apply step; Phase 3 verifies the patch actually landed in addition to the bonsai tools being available.

## Notes on Sprite Operation

- `sprite login` or `sprite auth setup --token ...` for first-time auth.
- `sprite list` to see existing sprites; `sprite use <name>` activates one for the current directory.
- `sprite use` historically required a TTY but accepts a name argument non-interactively (tested 2026-05-11).
- Checkpoint identifiers from `sprite checkpoint list` are the durable handle for "this is the base state to restore to."
- `sprite exec` runs in the active sprite; `-s <name>` targets a specific sprite without activating.
- Console sessions can disconnect unexpectedly (observed 2026-05-11); `sprite console` reconnects to the same sprite, preserving state.
