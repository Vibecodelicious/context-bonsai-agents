# Context Bonsai E2E Specification

This is the authoritative contract for end-to-end validation of any Context Bonsai port. It defines what e2e must prove, the disciplines every run obeys, and the slots each per-harness e2e doc must fill. Per-harness e2e docs are derived from this spec; they may bind the slots and add host-specific scenarios, but they may not weaken the disciplines below.

## Relationship to the other documents

- **Behavior spec** — [`../context-bonsai-agent-spec.md`](../context-bonsai-agent-spec.md). Defines what Context Bonsai must *do*. It is the acceptance bar: e2e exists to prove a port reproduces that behavior.
- **This spec.** Defines how e2e proves behavior-spec conformance on a real host, and the contract every per-harness e2e doc meets.
- **The two templates** — [`../context-bonsai-e2e-template.md`](../context-bonsai-e2e-template.md) (runtime behavior) and [`../installation-e2e-template.md`](../installation-e2e-template.md) (installation path). These are the structural scaffolds for writing each per-harness doc. This spec governs; the templates scaffold. Do not duplicate their step-by-step content here.
- **Forward-port spec** — `forward-port-spec.md` (same directory). Its release gate invokes the e2e defined here as the load-bearing check before a port ships onto a new upstream.

## What e2e proves: the acceptance bar

E2e proves that a port reproduces the spec'd, model-visible behavior on the real host. A port that builds, installs, typechecks, and returns tool-success text but does not reproduce that behavior has not passed — it has shipped dead code. The behavior spec is the definition of done; e2e is the instrument that confirms it.

Consequently, every verdict is grounded in observed behavior and host state, never in a tool's success string or the model's account of what happened.

## Two required dimensions

Every supported harness needs coverage on both dimensions, and a parity claim requires both green:

- **Installation e2e** — the documented install path works from a clean machine. Scaffold: `installation-e2e-template.md`.
- **Runtime e2e** — the behaviors hold once installed. Scaffold: `context-bonsai-e2e-template.md`.

They are non-overlapping by design: installation e2e proves the path from a fresh machine to "tools loaded"; runtime e2e assumes an installed port and proves the behavior.

## Invariant disciplines

These hold for every harness. A per-harness doc binds them to its host; it does not relax them.

1. **Verify from host state, not the model's word.** Resolve each behavioral verdict from transcript, session, or storage evidence — for example the archive record in the host's session store and the absence of the content from the active transcript. The model asserting "that's archived now" is not evidence. The storage showing the archive entry, and the active context no longer carrying the content, is.

2. **The Secret Prune Oracle is load-bearing, and it must not leak.** (Runtime scenario E2E-07 / Protocol A.) Seed a disposable secret, then drive the prune by **referring to the message, never by quoting the secret value** — quoting it puts the secret into the prune pattern, summary, or index terms and defeats the oracle. Forbid further tool use, then ask for the secret and confirm from evidence that the model cannot produce it. A prune that reports success but left the secret reachable, or that smuggled the secret into the archive arguments, is a FAIL. This is the check most likely to expose a real regression, so getting its method right is non-negotiable.

3. **The pre-publish install gate sources everything locally.** When installation e2e gates a release before any push, the install runs from local-only state — bundles plus a scoped `url.insteadOf` and `protocol.file.allow` — so nothing reaches the canonical remotes until the run is green. Validate before publish, never after. The mechanics live in `installation-e2e-template.md` ("Run Mode: Pre-Publish vs Post-Publish").

4. **Credentials are provisioned out of band and never enter an artifact.** Operator docs prescribe no provider, model, or key. The e2e rig provisions credentials before the run (env var, sealed store, or the host's own login flow) and destroys them at teardown. No key appears in run records, commits, summaries, or any version-controlled file.

5. **BLOCKED is not FAIL.** An environmental precondition — provisioning failure, missing host runtime, missing harness credentials, network outage — is BLOCKED and says nothing about the port. A behavioral regression, or an install run whose output materially diverges from the operator README, is FAIL.

6. **Tool registration is verified through the host's real surface, and host traps are recorded.** Confirm the model-facing tools register via an offline inventory if the host has one, otherwise an LLM-driven "list your tools" call. Record surfaces that mislead — for example, Pi's `list` reports settings-managed packages, not auto-discovered ones, so it reads as empty even when the port is correctly loaded.

7. **Sub-agent runs use bounded commands and evidence-based verdicts.** When a sub-agent drives the run (slow model turns, TUI dialogue, long builds): every host or model command runs under an explicit `timeout`; the agent never parks on a background-task completion notification; verdicts come from log or storage evidence; and behavioral checks prefer a deterministic single invocation — for example driving retrieve with the exact anchor id pulled from storage — over letting the model guess patterns in a retry loop.

## Per-harness contract

A per-harness e2e doc instantiates the templates by binding these slots. Each is the input one or both templates need:

- **Runtime entry point** — the exact command or binary the operator runs.
- **Session/archive storage location and how to inspect it** — the file or database, plus the query that reveals the archive record. This is the evidence source for discipline 1.
- **Tool transport** — native tool API, plugin, MCP, or patched runtime.
- **Documented install commands** — copied verbatim from the port's operator README; installation e2e drives exactly these.
- **Tool-registration surface** — offline inventory or LLM-driven, plus any host trap to avoid.
- **Provider/credential setup approach** — the out-of-band rig step, never content the operator README carries.
- **Fresh-machine model** — sprite provision-from-scratch or checkpoint-restore, with the checkpoint contents named if used.
- **Required scenario coverage** — which runtime scenarios (E2E-01..07 / Protocols A–E) the host supports, with explicit justification for any the host genuinely cannot.

## Parity-claim gate

A harness may claim Context Bonsai parity only when both dimensions are green against the current operator README and pinned state:

- **Installation:** the most recent install e2e is PASS, run with unmodified README commands, with tools confirmed registered.
- **Runtime:** every required scenario the host supports passes — prune mutates real transcript data, retrieve restores archived context, the gauge is visible to the model in-band, ambiguity and compatibility failures are deterministic and non-mutating, and persisted archive state behaves correctly for the host's session model.

A PASS that depended on a workaround the operator doc does not document is not a PASS. The workaround lands in the doc, then the run repeats until it passes cleanly.

## Deriving a per-harness e2e doc

1. Read the behavior spec and this spec.
2. Bind the per-harness contract slots above.
3. Instantiate both templates against those slots — one installation e2e doc and one runtime e2e doc (or one document with both sections, at the port owner's discretion).
4. Run under the disciplines above; record verdicts, reason codes, and evidence per each template's recording section.
5. On a FAIL, treat it as canonical evidence that the port or its operator doc needs a change. Fix, then re-run to PASS.
