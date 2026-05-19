# Epic: Relocate Pi Context Bonsai Out Of The pi-mono Fork

**Goal:** Move the Context Bonsai integration for Pi out of the in-tree location `pi/packages/context-bonsai/` into the standalone `pi_context_bonsai` side repository, leaving the pi-mono fork with zero Context Bonsai footprint, while preserving unit, integration, and end-to-end test coverage.

**Depends on:** The shared-spec Code Placement Rule and the corrected Pi per-agent spec (committed `89e5e58`).

**Parallel with:** None — the stories are sequential.

**Complexity:** Medium

## Background

Context Bonsai for Pi is currently an in-tree workspace package at `pi/packages/context-bonsai/`, discovered through a committed symlink `pi/.pi/extensions/context-bonsai`. Research established that the integration modifies no pi-mono runtime source: the `feat/context-bonsai-port` branch is purely additive, and the extension imports only Pi's public packages (`@mariozechner/pi-coding-agent`, `@mariozechner/pi-agent-core`) via their `.` exports. In-tree placement was a convenience choice, not a necessity, and it caused real problems — a fork dependency, the symlink, cwd-dependent extension discovery, and a double-load conflict.

The shared spec now carries a Code Placement Rule, and the Pi per-agent spec now requires a standalone extension. This epic brings the code into line with the corrected specs.

**Sequencing rationale.** The epic's single biggest unknown is whether the integration tests can run on Pi's public SDK instead of the pi-mono-internal test harness. That unknown is resolved first, in place in the fork, before any code is moved — so that if the SDK approach fails, it fails with everything still in its original location and nothing to unwind. Only after the SDK harness is proven does the relocation proceed.

## User Model

### User Gamut
Examples only; broad dimensions.
- A terminal user installing Context Bonsai for Pi who wants the shortest path to a working setup.
- The Context Bonsai project maintainer carrying per-harness forks and upstream rebase cycles.
- A contributor working on the Pi bonsai extension code itself.
- Whoever maintains or audits the `Vibecodelicious/pi-mono` fork.
- A future port author using Pi as a reference for the "pure extension, no fork" pattern.
- Automated test/CI infrastructure that must gate bonsai changes per release.

### User-Needs Gamut
Examples only; broad dimensions.
- An install path that works from any working directory and does not require cloning a pi-mono fork.
- A maintenance footprint that does not include a Pi fork in the carry-patches-on-upstream rebase cycle.
- A normal standalone-repository development experience (plain `npm install`, not a monorepo workspace member).
- Test coverage — unit, integration, e2e — preserved through the move, not silently dropped.
- A pi-mono fork that, if retained, is honestly free of bonsai code so it is not mistaken for the integration's home.
- A spec/plan set that matches the implemented architecture.

### Ambiguities From User Model
- Whether the `pi` submodule is retained. Resolved by user decision: keep it as a pinned pi-mono reference, emptied of bonsai code.
- Whether in-process integration tests are rebuilt or superseded by e2e. Resolved: rebuilt against Pi's public SDK surface so coverage is preserved. Story 1 carries an explicit feasibility check; if the public SDK cannot host an extension for testing, that becomes an escalation, not a silent drop.

## Stories

### Story 1: Rebuild the integration-test harness on Pi's SDK
**Size:** Large
**Description:** In the pi fork, rebuild the integration-test harness on Pi's public SDK so it no longer depends on the pi-mono-internal `test/utilities.ts` helper. Keep the seven integration tests green against the in-tree extension as the regression gate. Resolves the epic's biggest risk in place, before any code moves.
**Implementation Plan:** `.agents/plans/epic-pi-bonsai-relocation/story-pi-bonsai-relocation.1-rebuild-integration-harness-on-sdk.md`

### Story 2: Relocate the extension source and tests to the side repo
**Size:** Medium
**Description:** Copy the extension source, the full `test/` tree, the docs, and the integration tests with their SDK-based harness into the `pi_context_bonsai` side repository; convert dependencies to explicit pinned versions; make the side repo build, typecheck, and run unit + integration tests green standalone.
**Implementation Plan:** `.agents/plans/epic-pi-bonsai-relocation/story-pi-bonsai-relocation.2-relocate-extension-and-tests.md`

### Story 3: Rewrite the e2e harness for an installed Pi
**Size:** Medium
**Description:** Rewrite the end-to-end harness so it installs a published Pi, places the extension via `~/.pi/agent/extensions/`, and runs Protocol A from a working directory unrelated to the extension. Replaces the in-tree-checkout assumptions of the current `run-e2e.sh`.
**Implementation Plan:** `.agents/plans/epic-pi-bonsai-relocation/story-pi-bonsai-relocation.3-rewrite-e2e-harness.md`

### Story 4: Strip all Context Bonsai footprint from the pi-mono fork
**Size:** Small
**Description:** After Stories 1–3 are green, remove from the pi-mono fork the in-tree package, the discovery symlink, the test-only vitest alias, the integration tests and the SDK harness added by Story 1, the bonsai plan/research docs, and the `.gitignore` additions; regenerate the lockfile. End state: the fork carries no bonsai code.
**Implementation Plan:** `.agents/plans/epic-pi-bonsai-relocation/story-pi-bonsai-relocation.4-strip-pi-fork.md`

### Story 5: Rewire wiring, documentation, pins, and re-verify
**Size:** Medium
**Description:** Rewrite the Pi side-repo README for the no-fork install path, advance the parent submodule pins, re-run the rewritten e2e from an arbitrary working directory to close the cwd-dependency gap, and amend `.agents/plans/epic-pi-port/` to match the corrected spec.
**Implementation Plan:** `.agents/plans/epic-pi-bonsai-relocation/story-pi-bonsai-relocation.5-rewire-document-reverify.md`

## Dependencies and Integration

- Prerequisites: corrected specs (committed `89e5e58`).
- Story order is strictly sequential: Story 1 → Story 2 → Story 3 → Story 4 → Story 5.
- Story 1 modifies the pi fork transiently (it adds the SDK harness and repoints the integration tests). Story 2 copies the result into the side repo; Story 4 removes the fork-side residue.
- Story 4 MUST NOT begin until Stories 1–3 are verified green — it deletes the fork copies of the package, the integration tests, and the harness, so the relocated copies must be proven first.
- Integration points: the `pi_context_bonsai` side repo (gains all code/tests), the `Vibecodelicious/pi-mono` fork (loses all bonsai footprint), the parent `context-bonsai-agents` repo (submodule pins, README, `.agents/plans/epic-pi-port/`).
- Enables: Pi drops out of the per-harness "carry patches on upstream" rebase cycle entirely; future Pi-version bumps become a dependency-version change in the side repo, not a fork rebase.
