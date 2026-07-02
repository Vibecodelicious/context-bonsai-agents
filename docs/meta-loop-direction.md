# Context Bonsai Meta-Loop: Direction

This document states the end goal for the Context Bonsai meta-loop, the next step toward it, and the provisional steps after that. It is itself an iteration artifact: the process that produced it — examine the loop's current state, absorb what recent cycles taught, restate direction — is expected to run again, and a later iteration may overwrite the "Next Step" and "Provisional Future Steps" sections wholesale. Only the End Goal section should survive iterations largely intact; treat edits to it as scope changes requiring the project owner's approval.

## End Goal

A self-updating Context Bonsai that works for every supported harness.

Concretely, the system maintains three levels of artifact, each able to regenerate the one below it:

1. **Behavior contract** (`docs/context-bonsai-agent-spec.md`) — what Context Bonsai does, harness-independent. Changes only when the product changes.
2. **Per-harness update loop** — the routine procedure that carries a port onto each new harness release. Two upstream *shapes* exist today: for *git-fork* harnesses, rebase the patch chain and revalidate; for *closed-artifact* harnesses (Claude Code), freeze the new npm artifact, re-verify semantic anchors, and revalidate. This level encodes structural assumptions about the harness (package layout, seam locations, validation commands) that hold across the majority of releases.
3. **Per-release cycle** — one execution of level 2 against one new release, ending in the e2e release gate defined by `docs/agent-specs/context-bonsai-e2e-spec.md`.

The meta-loop is the machinery that generates and regenerates level 2. It must handle three entry conditions with one pipeline, differing only in how much prior work is still trustworthy:

- **Routine release** — level 2's assumptions hold. Generate and execute a cycle plan. This is the cheap path and the common case.
- **Structural break** — a harness release invalidates level 2's assumptions. The signals already exist as fail-closed behaviors: mass classification of commits into the hard-blocking `manual_review` bucket (the cycle generator's fallback for indeterminate evidence), anchor discovery scoring below the `minScore`/`minMargin` thresholds everywhere (the behavior spec's fail-closed anchor-ambiguity rule), or a Protocol A failure (the e2e spec's secret-prune oracle) on a clean build. The failure is the escalation signal: re-derive the level-2 assumptions from the behavior contract plus fresh exploration of the new harness architecture, demoting prior bindings to untrusted priors that must be re-verified, then re-enter the routine path.
- **New harness** — no prior work exists. Run the same derivation from nothing: capability discovery, integration-posture selection (per the behavior spec's change-minimization rule), per-harness spec, implementation, e2e binding, and emission of that harness's level-2 update loop as a first-class artifact.

"Self-updating" means the routine path runs with no human decision-making, and the other two paths run agentically with human review at the existing reviewer+judge gates. Detection of which path applies is itself automatic — a path-selection dispatcher, which does not exist yet: the routine path fails closed with a structural reason code rather than grinding forward or silently succeeding.

## Current State (evidence)

Short SHAs below are the `SOURCE_HEAD_SHA` keys of `.agents/plans/story-rebase-cycle-<sha>.md` cycle plans.

- The routine path exists and has run for two shapes, but the shape knowledge is fragmented across layers. `.agents/plans/story-meta-plan-for-future-rebase-planning.md` is the cycle-plan generator; its determinism machinery (freeze protocol, bucket classification, baseline/provenance/seal gates, dual approval) has held across multiple cycles, but its bindings are OpenCode-specific (bun commands, `packages/opencode/**` allowlists, `upstream/dev`).
- A second, human-facing statement of the git-fork level-2 loop lives in `DEVELOPMENT.md` §"Carrying Patches on Upstream": nine per-cycle steps carrying release-gate content the meta-plan does not (rebase-point tagging, Protocol A as the post-rebase behavioral check, the pre-publish install gate, publish ordering, submodule-pin advancement). The git-fork shape binding must reconcile both sources, not just the meta-plan.
- The closed-artifact shape was proven by improvisation, not by the meta-plan. `.agents/plans/story-rebase-cycle-95c24228c302948139ef7c9240d50f1b18b3c5cf.md` (the Claude Code 2.1.156 forward-port, executed to completion) adapted the git-shape fields per-cycle: npm package identity as the frozen upstream, an anchor-drift inventory (`removed_or_ambiguous_anchor > updated_anchor > unchanged_anchor > docs_evidence_only > manual_review`) as the replay set, semantic anchor re-derivation as replay. That mapping is recorded only inside the generated instance (and its superseded draft, `7a60c93`); each future Claude Code cycle must copy or re-derive it.
- The new-harness path ran once, as a bespoke epic. `.agents/plans/epic-context-bonsai-agent-ports/` produced the kilo/gemini/codex/cline ports from the per-harness specs, but no reusable "onboard a harness" procedure was extracted from it, and no per-harness level-2 loop was emitted as its own artifact.
- The feedback mechanism works and is the model to build on: the meta-plan's "post-loop regression check" entries show cycle friction being absorbed back into the generator across multiple revisions.
- One known dangling reference: `docs/agent-specs/context-bonsai-e2e-spec.md` cites a `forward-port-spec.md` in its own directory that does not exist. The restructured meta-loop spec is the intended referent.

## Next Step

Restructure the meta-plan into a layered spec, by extraction rather than invention:

1. **Shape-agnostic core** — lift the determinism machinery out of `story-meta-plan-for-future-rebase-planning.md`: input freezing, deterministic inventory, mutually-exclusive bucket classification with a hard-blocking `manual_review` fallback, evidence/baseline/provenance contracts, machine-checkable seal gates, reviewer+judge approval, late-fix intake.
2. **Two shape bindings**, mined from the artifacts that already proved them:
   - *git-fork upstream* — from the current meta-plan, the OpenCode cycle plan (`4d88b95`, onto OpenCode v1.15.7), and `DEVELOPMENT.md` §"Carrying Patches on Upstream" (whose tagging, Protocol A, and pre-publish install-gate steps the meta-plan lacks): upstream identity = fetched ref frozen to SHA; inventory = commit range; replay = cherry-pick-first with re-implement escape.
   - *closed npm artifact* — from the `95c2422` plan and its superseded `7a60c93` draft: upstream identity = package version + tarball integrity + extracted-bundle SHA-256; inventory = anchor-drift scan; replay = semantic anchor re-derivation with fail-closed ambiguity.
3. **Per-harness binding slots** — validation commands with working directories, allowlists, e2e citations, seam/anchor registries — following the slot pattern `context-bonsai-e2e-spec.md` already uses for its per-harness contract.

Output contract: a single spec at `docs/agent-specs/forward-port-spec.md` (making the e2e spec's existing citation real), structured as core + shape bindings + per-harness binding slots. The existing meta-plan stays in place, unmodified, until the acceptance test below passes; it is then superseded by a short pointer note at its old path (its self-immutability rule governs plan-generation runs, not this restructuring — but leaving it untouched until acceptance keeps the proven generator available as fallback).

Acceptance test: regenerating the two most recent real cycle plans — one OpenCode (`4d88b95`), one Claude Code (`95c2422`) — from the restructured spec plus their bindings yields plans equivalent to the ones that actually ran, where equivalent means: same seal/blocking gates, same bucket taxonomy and precedence, same validation command set and working directories, same immutable e2e scope. Prose, ordering, and formatting may differ.

## Provisional Future Steps

Ordered by current best guess; any or all may be replaced when the next iteration of this direction loop runs with the restructured spec in hand.

1. **Formalize escalation.** Enumerate the structural-break reason codes the routine path can emit, and specify what each invalidates (harness binding, shape binding, or per-harness spec content). Today these exist as scattered fail-closed behaviors; they need to become the input to the path-selection dispatcher described in the End Goal.
2. **Specify the derivation pipeline** (the structural-break / new-harness path): capability discovery against the behavior contract, integration-posture selection, per-harness spec generation, e2e slot binding, and emission of the harness's level-2 bindings. Mine `.agents/plans/epic-context-bonsai-agent-ports/` and the per-harness specs' shared section structure (Capability Evidence Matrix, Verified Host Primitives, Integration Posture) for the stage contracts.
3. **Split per-harness specs into contract vs. bindings.** The stable behavioral content and the regenerable structural facts currently share one document (e.g. `docs/agent-specs/claude-code-context-bonsai-spec.md` mixes both). The derivation pipeline needs to know what it may rewrite.
4. **Prove the loop on a live event**: run the next real harness release (or the next Claude Code version bump) through the restructured spec end to end, and absorb the friction as the first post-restructure regression check.
5. **Reduce human steps in the routine path** — automated release detection per harness, automatic cycle-plan generation on detection — only after the restructured spec has survived at least one live cycle.

## Iteration Rule For This Document

When this direction loop runs again: re-read this document, compare its Current State section against the repository, rewrite Next Step and Provisional Future Steps freely, and preserve End Goal unless the project owner approves a scope change. Supersede in place (this file, same path) so there is exactly one current direction statement.
