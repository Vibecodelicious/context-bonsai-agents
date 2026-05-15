# Context Bonsai E2E Testing Template

## Purpose

Use this template to write an end-to-end validation protocol for a specific Context Bonsai implementation.
It is intended to generalize the existing OpenCode and Claude Code testing documents while keeping the checks focused on model-visible behavior.

## Test Metadata

- Implementation name: `[agent or project name]`
- Repository root: `[absolute path]`
- Runtime entry point: `[binary, CLI, app, or harness command]`
- Session storage location: `[export path, JSONL path, DB path, transcript capture path, or none]`
- Tool transport: `[native tool API, plugin, MCP, patched runtime, etc.]`
- Model/provider under test: `[provider/model]`
- Date: `[UTC timestamp]`
- Operator: `[name]`

## Scope

This protocol validates Context Bonsai integration behavior for this host only.
Do not modify implementation code during the run unless the protocol explicitly says the run is part of a fix loop.

## Required Scenario Set

Every implementation-specific e2e doc should cover these scenarios unless the host truly cannot support them.

| ID | Scenario | Required outcome |
|---|---|---|
| E2E-01 | Contiguous prune success | One bounded range is archived, placeholder is visible, mutation is atomic |
| E2E-02 | Boundary ambiguity or unresolved rejection | Deterministic plain-text error, no mutation |
| E2E-03 | Retrieve by anchor success | Archived range becomes visible again, placeholder effect disappears |
| E2E-04 | Gauge cadence and severity | Gauge appears in-band on cadence and matches threshold rules |
| E2E-05 | Compatibility error path | Missing required primitive fails closed with deterministic output |
| E2E-06 | Persistence across resume or reload | Archived state survives reload when host persistence exists |
| E2E-07 | Secret prune oracle | After prune, model cannot reveal pruned secret from active context alone |

Add host-specific scenarios as needed, such as patch-discovery checks, tmux/TUI validation, branch-switch behavior, or provider-policy smoke tests.

## Pre-Flight

Document the exact commands for your host. Typical checks:

```bash
# Verify runtime is installed and reachable
[runtime version command]

# Verify context-bonsai is configured or connected
[plugin, extension, or MCP health check]

# Verify unit/integration tests are green before e2e
[project test command]

# Prepare a deterministic artifact directory
mkdir -p [artifact-dir]
```

Expected pre-flight result:

- runtime is healthy
- context-bonsai integration is enabled
- required patch points or external servers are connected
- relevant tests pass

If a required dependency is unavailable, classify the run as `BLOCKED` rather than `FAIL`.

## Evidence Sources

List the authoritative evidence sources for this host:

- transcript export command
- session file path
- JSON or JSONL event log
- CLI stdout capture
- tool call and tool result records
- TUI transcript capture if the host is interactive

Prefer transcript or session-export evidence over debug logs.

## Scenario Template

Repeat this section for each scenario.

### `[Scenario ID] [Scenario name]`

#### Goal

`[What this scenario proves]`

#### Setup

```bash
[setup commands]
```

#### Execution

```bash
[step 1 command]
[step 2 command]
[step 3 command]
```

#### Expected model-visible behavior

- `[expected tool call behavior]`
- `[expected transcript change]`
- `[expected assistant response]`

#### Evidence collection

```bash
[export or inspection commands]
```

Look for:

- `[tool invocation evidence]`
- `[tool result evidence]`
- `[placeholder or restore evidence]`
- `[final assistant text evidence]`

#### Verdict rules

- `PASS`: `[deterministic pass condition]`
- `BLOCKED`: `[environmental or harness blocker]`
- `FAIL`: `[behavioral regression or violation]`

#### Reason codes

- `[reason_code_1]`
- `[reason_code_2]`
- `[reason_code_3]`

## Recommended Core Protocols

### Protocol A: Secret Prune Oracle

This is the most valuable broad e2e because it tests actual pruning rather than only tool success text.

1. Seed a temporary secret in a fresh session.
2. Require the assistant to acknowledge without repeating the secret more than necessary.
3. Ask the assistant to prune the secret-introducing message without reusing the secret in tool arguments, summary, or index terms.
4. **Pre-recall invalidation gate (mandatory):** before asking for recall, search the post-prune active transcript — everything the model will see on its next turn — for the secret string. This includes the model's visible response text from the prune turn, tool call arguments, tool results, thinking / reasoning blocks, any custom-entry content not gated as archived, and any other transcript region that was not itself pruned. If the secret appears anywhere in the post-prune active transcript, **the run is `INVALID`**, not `PASS` or `FAIL`. Stop, do not proceed to the recall step. A model's later refusal to repeat the secret in such a case proves nothing — it may simply be the model following the original "do not repeat" instruction while still having the secret visible in its context. Only proceed if the gate passes.
5. Forbid all further tool use in the session.
6. Ask for the secret explicitly.
7. Verify from transcript evidence that the model cannot reveal it and responds that it is unavailable or no longer in active context.

This protocol catches false positives where prune claims success but the active transcript still leaks the content. The pre-recall invalidation gate is non-negotiable: it is the difference between a result that proves bonsai's prune actually removed content from active context and a result that only proves the model is well-behaved.

### Protocol B: Retrieve Roundtrip

1. Create a session with a completed, uniquely bounded discussion.
2. Prune the range.
3. Capture the placeholder and anchor id from transcript evidence.
4. Call retrieve with that anchor id.
5. Verify the original range is visible again and the placeholder effect is gone.

### Protocol C: Gauge Oracle

1. Drive the session through enough turns to cross at least one gauge cadence boundary.
2. Do not ask the model to invoke a gauge tool unless the host contract explicitly requires that.
3. Verify that gauge text appears in-band and is visible to the model.
4. If the host is a TUI and the gauge is ephemeral, use transcript capture or controlled interaction tooling such as `tmux` rather than relying only on exported history.

### Protocol D: Boundary Rejection

1. Create a transcript where a prune pattern matches zero or multiple candidate messages.
2. Invoke prune with the ambiguous or unresolved boundary.
3. Verify deterministic error text.
4. Verify no placeholder or archive mutation appears afterward.

### Protocol E: Compatibility Failure

1. Run against a configuration missing a required primitive or intentionally disable the required capability.
2. Invoke prune or retrieve.
3. Verify the implementation returns an explicit compatibility error.
4. Verify no transcript mutation occurs.

## Host Adaptation Notes

### Native CLI hosts

- Capture stdout and stderr separately.
- Prefer deterministic session ids when the host supports them.
- Export the exact session after each critical step.

### TUI hosts

- Use an automated terminal harness when model-visible state is ephemeral.
- Save pane captures after each turn.
- Do not treat a missing UI widget as failure if the gauge is model-visible but not directly rendered as a UI block.

### Patched or minimized runtimes

- Record the build identifier and bundle hash used for the run.
- Validate patch-point discovery before running behavior scenarios.
- Any matcher miss or non-unique insertion point is a `BLOCKED` or release-blocking outcome, not a silent skip.

### MCP-backed tool transport

- Verify the MCP server is connected before the run.
- Distinguish transport failure from bonsai behavior failure.

## Run Recording

For each run, record:

- timestamp
- runtime version
- provider/model
- scenario id
- verdict
- reason code
- evidence snippet or artifact path
- notable observations

## Result Template

### Test Run: `[UTC timestamp]`

- Result: `[PASS | BLOCKED | FAIL]`
- Scenario: `[scenario id and name]`
- Reason code: `[enum value]`
- Runtime/version: `[value]`
- Model/provider: `[value]`

#### Key findings

- `[finding 1]`
- `[finding 2]`
- `[finding 3]`

#### Evidence

```text
[paste concise evidence here]
```

#### Artifact paths

- `[artifact path 1]`
- `[artifact path 2]`

#### Observations

- `[observation 1]`
- `[observation 2]`

## Pass Criteria For A Parity Claim

Do not claim broad Context Bonsai parity for a host unless all required scenarios that the host is expected to support pass.

At minimum, parity should mean:

- prune works on real transcript data
- retrieve restores archived context
- gauge is visible to the model in-band
- ambiguity and compatibility failures are deterministic and non-mutating
- persisted archive state behaves correctly for that host's session model
