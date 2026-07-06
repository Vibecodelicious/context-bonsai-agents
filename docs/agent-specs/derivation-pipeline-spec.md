# Context Bonsai Derivation Pipeline Specification

This is the contract for the meta-loop's expensive path: deriving (or re-deriving) a harness's **level-2 update loop** — the routine forward-port machinery — from the **level-1 behavior contract** plus fresh exploration of the harness. The routine path (`forward-port-spec.md`) executes level 2 against one release at a time (level 3); this pipeline is what runs when level 2 does not exist yet (a new harness) or has been invalidated (a structural break). Layer vocabulary throughout is `docs/meta-loop-direction.md` §"End Goal": level 1 = behavior contract, level 2 = per-harness update loop, level 3 = per-release cycle.

**Status: specified; Stages 5–6 executed live once** (Pi, 2026-07-05 — the pipeline's tail run against an already-implemented port). Both full historical derivations predate it and ran bespoke; §11 traces how each would have flowed through the stages, which is this document's acceptance evidence.

## Relationship to the other documents

- **Behavior contract** — [`../context-bonsai-agent-spec.md`](../context-bonsai-agent-spec.md): the pipeline's fixed input. Stage 1's probe list, Stage 2's decision rules, and Stage 3's traceable content all derive from it; the pipeline never modifies it.
- **Forward-port spec** — [`forward-port-spec.md`](forward-port-spec.md): the pipeline's output target. Stage 6 emits a Part 4 slot table there; §1.17's `structural-*` reason codes are this pipeline's entry contract.
- **E2E spec** — [`context-bonsai-e2e-spec.md`](context-bonsai-e2e-spec.md): Stage 5 binds its per-harness contract; its invariant disciplines bind the pipeline's own validation work.
- **Direction statement** — `../meta-loop-direction.md`: why this pipeline exists and the tiering that governs it.

## 1. Tier and review model

The pipeline runs on the **owner (Fable-class) tier**, agentically, with human review at the existing reviewer+judge gates — never on the routine executor tier (`forward-port-spec.md` §"How a routine cycle uses this spec" step 1 STOPs the routine executor out of this path). Every stage ends in a committed, reviewable artifact; the next stage consumes only committed prior-stage outputs. Document-shaped outputs (Stages 3 and 5) additionally run the writing-guidance review loop (`.llm-conductor/writing_guidance/DOCUMENT_WRITING_GUIDANCE.md`). Approver format and the reviewer+judge unlock-token semantics are `forward-port-spec.md` §1.8, unchanged.

## 2. Entry conditions

The pipeline has exactly two entry conditions, distinguished only by how much prior work is still trustworthy.

### 2.1 New harness

Entered on `structural-unbound-harness` (no Part 4 slot table exists). No priors; the pipeline runs Stages 1–6 in full from the behavior contract and the harness source alone.

### 2.2 Structural break

Entered on any other `structural-*` code from `forward-port-spec.md` §1.17. The emitting cycle is superseded (§1.9 supersession semantics); the code's recorded invalidation scope determines the **entry stage** and the **demotion set** — the prior bindings that become *untrusted priors*: they may guide search but nothing from the demotion set may appear in a stage output without fresh re-verification against the frozen harness identity (§3). Prior bindings outside the demotion set remain trusted and are not re-derived.

| §1.17 code | Invalidation scope (per §1.17) | Entry stage | Demotion set |
|---|---|---|---|
| `structural-mass-manual-review` | Level-2 bindings | Stage 1 | The harness's Part 4 slot table and its entire bindings document (`<harness>-context-bonsai-bindings.md`, §6's split): Capability Evidence Matrix, Verified Host Primitives, Binding Sites, allowlists, naming, command sets |
| `structural-anchor-derivation-failure` | Level-2 bindings | Stage 1 | As above, plus the seam/anchor registry's documented reasoning — every anchor rationale is re-derived, not just the failing majority |
| `structural-protocol-a-regression` | Level-2 seam assumptions | Stage 1, scoped | The capability rows behind the failing oracle — transcript-rewrite/history-replacement, tool transport, hook/guidance paths — and every downstream output that cites them (posture record, seam bindings, affected slots). Rows and outputs not citing the demoted capability rows stay trusted |
| `structural-missing-command-binding` | The affected slot binding only | Stage 6, scoped | The named slot's command binding. If Stage 6 cannot bind the command because the harness surface itself changed, that is new structural evidence: record it and re-enter at Stage 1 with the surface's capability row demoted |
| `structural-unbound-harness` | Nothing exists to invalidate | Stage 1 | None — the new-harness case (§2.1) |

A scoped entry that discovers its scope was too narrow (evidence contradicting a still-trusted binding) widens by recording the finding and re-entering at the stage that owns the contradicted output — never by silently editing a trusted binding in place.

## 3. Pipeline-wide disciplines

- **Frozen harness identity.** The pipeline freezes the harness version it derives against — git upstream: ref resolved to a full SHA; closed artifact: npm package identity with tarball integrity — per `forward-port-spec.md` §1.1/§2.1/§3.1 semantics, recorded in every stage artifact. All evidence citations resolve against the frozen identity.
- **Evidence, not memory.** Every host-structure claim in a stage output carries a file:line (or bundle-offset) citation into the frozen harness source. Untrusted priors are never cited as evidence.
- **Fail closed.** A stage that cannot meet its output contract records the gap explicitly and stops for owner/reviewer disposition; it never invents a value, narrows a contract, or leaves a slot silently absent (the same rule `forward-port-spec.md` §4.2 sets for command bindings).
- **Iteration budgets are declared.** Any judged iteration loop inside a stage states its budget in the stage artifact (default: 5 iterations; a loop whose budget another spec already declares — e.g. the §1.15 generation loop's 3 iterations, invoked by Stage 6's gate — keeps its own declared budget); exhaustion is a recorded STOP escalated to the project owner, not an invisible orchestration parameter. (The historical epic ran an undeclared 5-iteration cap that appears only in the judgement records, never in the epic or its stories.)

## 4. Stage 1 — Capability discovery

*Consumes:* behavior contract; frozen harness source; on structural-break entry, the demotion set as untrusted priors.
*Produces:* the evidence layer of the harness's **bindings document** (`docs/agent-specs/<harness>-context-bonsai-bindings.md`) — **Capability Evidence Matrix**, **Verified Host Primitives**, **Unverified Or Weak Areas**. (The bindings document's **Binding Sites** table is completed later: Stage 3 names the binding keys the contract half references, and Stage 4 records the realized sites.)

Discovery is a fixed probe list, not freehand reading. The matrix must contain one row per behavior-contract capability the port depends on; the normalized set below generalizes the rows the existing per-harness specs carry (their exact row names and granularity vary per host), mapping to the contract's Runtime Capability Matrix and Planning Checklist:

1. Persistent transcript (durable session storage the port can read and rewrite)
2. Tool execution layer (how tools are registered and invoked)
3. Hook / plugin / extension system (supported interception points)
4. Token or context-usage tracking (gauge input)
5. Transcript-rewrite capability (authoritative history replacement — the posture-deciding row; see the Change-Minimization Rule and Stage 2 below)
6. System guidance path (where standing instructions reach the model)

Each row records `Verified` / `Partial` / `Missing` with citations; **Verified Host Primitives** lists the concrete file:line sites; **Unverified Or Weak Areas** records what discovery could not establish. Additional rows are added when the contract demands a capability the list above does not name — never removed.

*Gate:* reviewer+judge confirm every probe row has a status and live evidence, and (structural-break entry) that no demoted prior is cited as evidence.

## 5. Stage 2 — Integration-posture selection

*Consumes:* Stage 1 matrix; the behavior contract's Change-Minimization Rule (plugin/hook first, MCP/sidecar second, host-core patch last resort) and Code Placement Rule (port logic lives in the side repo; the harness fork carries only the narrow seam).
*Produces:* the posture record — **Required architecture stance** and **Specified Implementation Direction** (`Preferred / Acceptable / Not acceptable`), plus the **level-2 shape decision**: git-fork (`forward-port-spec.md` Part 2) or npm release medium (Part 3). A Part 3 decision also records which of Part 3's two variants applies — closed patched bundle, where the side repo patches the installed artifact (Claude Code), or open published package consumed through its public API as a pure extension, where nothing is patched and the harness fork carries no port code (Pi). Per Part 3's own intro, a pure-extension record states what realizes each requirement the shape's machinery phrases as patch application.

The decision is keyed, with recorded rationale, to Stage 1's rows — in every historical posture the transcript-rewrite row decided it:

- Row 5 `Verified` via a native plugin/extension/hook surface → plugin- or extension-only posture, no core seam (Kilo, Pi precedents).
- Row 5 `Missing`/`Partial` → hybrid: hooks/plugins own guidance and gauge; a narrow core seam owns prune/retrieve, anchored to the most-native existing host mechanism that already performs history replacement (Codex `compact.rs` replacement-history, Cline summarize/precompact overwrite precedents).
- No harness repo exists at all → closed-artifact shape: side repo patching the installed artifact through a seam/anchor registry (Claude Code precedent).

Every stance and every `Not acceptable` line cites the matrix row(s) that force it. A posture that contradicts the Change-Minimization preference order requires the missing capability to be explicitly identified in the record (the contract's own escape condition).

*Gate:* reviewer+judge. *Standing re-checkpoint:* the posture is re-validated at Stage 4's first integration contact against what implementation actually finds; a seam the matrix called usable but implementation cannot use is a Stage 2 defect that reopens the posture record, not something implementation routes around silently. (Historical evidence: the epic decided all four postures once at epic level; Codex and Cline both hit integration-boundary rework the epic-level split did not anticipate.)

## 6. Stage 3 — Per-harness spec generation

*Consumes:* Stages 1–2 outputs; the behavior contract.
*Produces:* the harness's document pair on the shared skeleton — the eleven shared section headings, physically split by provenance class:

- **Contract half** — `docs/agent-specs/<harness>-context-bonsai-spec.md`: 1. Purpose · 2. User Model (User Gamut / User-Needs Gamut / Ambiguities From User Model) · 6. Integration Posture (Required architecture stance / Prune and retrieve contract / Transcript mutation path / System guidance path / Gauge path) · 7. Fail-Closed Requirements · 8. Parity Gaps Against Shared Spec · 9. Specified Implementation Direction · 10. E2E Priorities · a Key References pointer to the bindings half — with heading 6/9 content from Stage 2.
- **Bindings half** — `docs/agent-specs/<harness>-context-bonsai-bindings.md`: 3. Capability Evidence Matrix · 4. Verified Host Primitives · 5. Unverified Or Weak Areas · a **Binding Sites** table (`Binding key | Current site | Realizes`) · 11. Key References — headings 3–5 lifted from Stage 1.

(The Pi and Claude Code specs demonstrate the one permitted extension: an additional section for a genuinely harness-unique concern, explicitly marked as such — procedural or evidence *rules* go in the contract half; discovered structural *facts* go in the bindings half.)

The two provenance classes are separated physically by the pair: **contract-traceable content** (tool names and input schemas, Pattern Matching Contract obligations, gauge bands and cadence, fail-closed semantics, minimum validation scenarios — cited to contract sections, quoted or pointed to, never paraphrased into drift) lives in the contract half; **exploration-derived content** (everything citing Stage 1 evidence: harness file paths, function names, hook names, storage locations, schema shapes) lives in the bindings half. Where a contract obligation must name its current realization, the contract half references a named key (`binding: <key>`) whose row in the bindings half's Binding Sites table carries the concrete site — so rewriting a site is a bindings-half change that leaves the contract half untouched as long as the obligation holds. The bindings half is what §2.2's demotion sets operate on; the litmus for placement is whether a sentence names *where or how in the harness or side repo* an obligation is realized today (bindings) or would survive a harness release that reshuffles the codebase (contract).

*Gate:* the writing-guidance review loop with a source-truth reviewer verifying both provenance classes.

## 7. Stage 4 — Implementation

*Consumes:* the per-harness spec; the posture record.
*Produces:* the port — side repo (`<agent>_context_bonsai`) plus at most the narrow seam in the harness fork — under a judged dev/review/judge iteration loop with plan documents in `.agents/plans/`.

Bindings the historical record showed must be explicit rather than conventional:

- **Declared iteration budget** per §3.
- **Persisted regression baseline.** The story's validation commands run once against the starting commit and the results land in a structured artifact (`forward-port-spec.md` §1.6 row semantics) that every iteration's judge compares against — not prose re-derivation of "pre-existing failures" each round. Workspace-wide standards gates (lint, clippy-equivalents) bound by the host repo's own standards docs are part of the baseline even when the story's command list omits them.
- **Scope discipline.** Judges diff the realized change set against the plan's touch-list (`git diff --name-only`) each iteration.
- **Real-entry-point rule.** A finding may be closed only by evidence driven through the production entry path. Tests that simulate the seam — manually advanced counters, hand-built in-memory state, structural type checks in place of runtime loader behavior — are not closure evidence. (This is where the historical ports concentrated their genuine bugs: integration-glue defects masked by tests that bypassed the real path — an unloadable plugin path, a retrieve guard dead after one prune, archive state never rehydrated on resume, an "idempotent guard fix" that was unreachable code.)
- **Posture re-checkpoint** per §5.
- **Binding Sites completion.** Realized side-repo sites (the functions, files, and storage locations that end up carrying each contract obligation) are recorded in the bindings document's Binding Sites table as they land, so the contract half's `binding:` references resolve before the stage gate.

*Gate:* terminal `APPROVED` judgement with an item-by-item acceptance-criteria walk and the judge's independent regression re-run.

## 8. Stage 5 — E2E slot binding

*Consumes:* the port; the e2e spec's per-harness contract.
*Produces:* the harness's installation e2e doc and runtime e2e doc (scaffolds: `../installation-e2e-template.md`, `../context-bonsai-e2e-template.md`; combinable at the port owner's discretion), binding all eight per-harness slots the e2e spec requires: runtime entry point; session/archive storage location plus inspection query; tool transport; documented install commands; tool-registration surface (with host traps named); provider/credential setup approach; fresh-machine model; required scenario coverage. The seven invariant disciplines (verify-from-host-state, Secret Prune Oracle method, pre-publish local sourcing, out-of-band credentials, BLOCKED ≠ FAIL, real tool-registration surface, bounded-command sub-agent verdicts) bind as written and may not be relaxed per harness.

Scenario coverage is justified row-by-row against the contract's minimum validation scenarios; a scenario the host genuinely cannot support carries its justification in the binding, never a silent omission. Each scenario binding names its evidence channel, and the named channel must provably be able to carry the asserted evidence: a claim about the assembled model-visible context may not cite a channel that carries only a turn's own emitted events (the Pi Stage 5 run's reviewed defect — its first E2E-01 binding placed the post-prune placeholder evidence in the harness's `--mode json` event stream, where it provably cannot appear; the fix rebound it to a follow-up turn in which the model quotes the placeholder text it can only know from its visible context). Where a scenario splits into an automated half and a manually driven half, the binding states the split explicitly; automation coverage is never over-claimed. Before Stage 6, **Protocol A (the secret-prune oracle) is executed once against a real build of the ported harness** — the direct behavioral check that pruning holds in the real harness (the pruned secret no longer recallable from active context, per the e2e spec's oracle method). The historical epic had no such stage; the need for real-path proof surfaced only reactively in review ("no test proves the placeholder reaches the model in a real request"). A credentials-shaped impediment records the attempt as `BLOCKED` with its reason code and stops the stage for provisioning — `BLOCKED` is not a waiver.

*Gate:* reviewer+judge over the bound docs plus the Protocol A evidence (PASS, or a recorded BLOCKED awaiting provisioning — the stage does not complete on BLOCKED).

## 9. Stage 6 — Level-2 binding emission

*Consumes:* everything above.
*Produces:* the harness's slot table in `forward-port-spec.md` Part 4 — every §4.1 slot bound: shape, repos and roles, upstream identity source, allowlists, seam/anchor registry, naming, toolchain and bootstrap, baseline row set with must-be-green designations, canonical validation set, e2e procedure and required scenarios, credentials, evidence paths, explicit non-targets — plus, where the generic e2e templates do not name concrete commands, a per-harness command-binding runbook (the `docs/opencode-e2e-runbook.md` precedent; `forward-port-spec.md` §4.2 makes its absence a generation-blocking condition, so emitting the slot table without it leaves the routine path unable to run). Every command binding in the runbook carries one of three grounding classes: **EXECUTED** (ran against a real build of the ported harness, with the recorded results cited), **SOURCE-VERIFIED** (read from a cited site in the harness or side-repo source), or **COMPOSED** (assembled from EXECUTED and SOURCE-VERIFIED primitives but not yet run end-to-end in that exact sequence) — the taxonomy both existing runbooks (`docs/opencode-e2e-runbook.md`, `docs/pi-e2e-runbook.md`) apply; an ungrounded command is a fail-closed gap per §3, not a plausible default. Pre-existing dirty status paths known at emission time are enumerated in the slot table per §1.10.

A slot that cannot be bound stays explicitly unbound and blocks completion (§3 fail-closed); Part 4's own rule — never improvise values for unbound harnesses — is the mirror of this gate on the routine side.

*Acceptance gate:* a routine cycle plan generated from `forward-port-spec.md` plus the new slot table passes the §1.15 generation validation loop, including the shape's rehearsal, against a real target release when one is pending or the current release as a pressure-test target otherwise (`uncommitted-pressure-test` mode, §1.11). This mirrors the forward-port spec's own regeneration acceptance test: the binding is proven by the routine path consuming it, not by inspection.

## 10. Exit

On the Stage 6 gate passing, the harness is (re-)bound and the routine path owns it. For a structural-break entry, the superseding cycle is generated fresh against the same target release under the new bindings, with the supersession lineage recorded per §1.9. The pipeline's stage artifacts remain committed as the derivation record — the input the next structural break's demotion sets operate on.

## 11. Traceability: the two historical derivations

Acceptance evidence for this specification: how each prior derivation maps onto the stages, and where each stopped short. Neither ran the pipeline; both are readable through it.

**The agent-ports epic** (`.agents/plans/epic-context-bonsai-agent-ports/` — Kilo/OpenCode plugin-first, Gemini CLI hooks-plus-MCP, Codex replacement-history, Cline canonical-history; git-fork family):

- *Stage 1* ran as the per-harness specs' Capability Evidence Matrix / Verified Host Primitives sections plus each story's must-read Context References — freehand per target, no fixed probe list (the gap §4 closes).
- *Stage 2* ran once, at epic level, as the epic's "Architecture Stance (epic-level)" section; each story's "Architecture Split" section restated it without re-validation (the gap §5's re-checkpoint closes — Codex and Cline both reworked at the integration boundary).
- *Stage 3* produced the six `docs/agent-specs/*-context-bonsai-spec.md` documents (authored as single files; since split into the contract + bindings pairs that are §6's output contract).
- *Stage 4* ran as the four story + judgement chains, with the undeclared iteration budget, prose-re-derived baselines, and simulated-seam test masking that §7's bindings make explicit.
- *Stage 5* did not exist as a stage: real-request-path evidence was caught reactively in review (the Gemini iteration-1 finding), and no installation/runtime e2e docs were bound as story deliverables.
- *Stage 6* never ran at derivation time: `cline`, `gemini-cli`, and `kilo` remain unbound in Part 4 (`forward-port-spec.md` §4.6) — the derivations stopped after implementation, which is exactly the missing tail this pipeline adds. OpenCode's own Part 4 binding was emitted later, by the forward-port spec work, from the executed cycles' evidence; Pi's was emitted by this pipeline's first live Stage 5–6 run (2026-07-05), closing that harness's tail; Codex's by the second (Stage 5 sealed 2026-07-05, Stage 6 emitting `forward-port-spec.md` §4.5).

**The Claude Code closed-artifact port** (side repo `tweakcc_context_bonsai/`; implementation epic `.agents/plans/epic-cc-bonsai-tweakcc4/`):

- *Stage 1* ran as the bundle exploration recorded in the side repo's semantic-anchor analysis (`docs/semantic-anchor-analysis-2.1.156.md` procedure) and the Claude Code per-harness spec's Capability Evidence Matrix and Patch-Anchor Evidence Requirements (that spec's harness-unique extra section, per §6's escape valve).
- *Stage 2* is the spec's MCP-first stance with a mandatory transcript-rewrite patch seam — the "no harness repo exists" branch of §5's decision rule, and the origin of the closed-artifact shape itself.
- *Stage 3* produced `claude-code-context-bonsai-spec.md` on the shared skeleton.
- *Stage 4* ran as the tweakcc implementation epic under the same judged-iteration convention.
- *Stage 5* produced the strongest historical analogue of the stage: the side repo's `docs/e2e-protocol.md` binding the E2E-00–08 scenario set, reason-coded BLOCKED semantics, and Protocol A against the real artifact.
- *Stage 6* was emitted as `forward-port-spec.md` §4.3 by the forward-port spec work and proven by the executed 2.1.200 cycle — the pipeline makes that emission a derivation deliverable rather than after-the-fact spec archaeology.

The structural-break entry has no executed historical instance; its contract is §2.2's table, whose completeness over the five `structural-*` codes is checkable against `forward-port-spec.md` §1.17 directly.
