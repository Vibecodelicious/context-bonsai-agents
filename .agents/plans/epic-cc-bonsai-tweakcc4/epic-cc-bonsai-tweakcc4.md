# Epic: Re-implement Context Bonsai for Claude Code on tweakcc 4.0

**Goal:** Deliver a working Context Bonsai integration for current Claude Code (2.1.x) that actually reduces tokens sent to the provider, runs on the **native** Claude Code installation (not just the npm `cli.js`), is built on tweakcc 4.0's `adhoc-patch` mechanism (no tweakcc fork), and uses resilient, self-verifying patch anchors so it survives Claude Code's per-release re-minification.
**Depends on:** None (tweakcc 4.0.13 published; native-binary `unpack` confirmed to yield plain JS source).
**Parallel with:** None (stand-alone Claude Code port work).
**Complexity:** High

## Background And Motivating Evidence

The current Claude Code port is broken in practice. Its design has three pieces — an MCP server, the `ccsnap` CLI, and **tweakcc patches** — but the patches are the only thing that actually shrinks context, and they were never applied to the binary the user runs.

Confirmed during investigation (session `cab27379`):

- The user runs the **native** Claude Code (`~/.local/bin/claude` → `~/.local/share/claude/versions/2.1.143`, a 233 MB Bun-compiled ELF). It has **zero** Context Bonsai patch markers.
- The MCP `context-bonsai-prune` tool *did* run — `~/.claude/archived-<session>.json` marker files exist and are written — but with no `archivedFilter` patch consuming them, nothing removes archived messages from the API request. Prune only **adds** tool_use/tool_result blocks; net context **grows**.
- The old patches lived in a **fork** of tweakcc (`the_observer/tweakcc`), pending a PR to Piebald-AI, and only patched the npm `cli.js` — a JS bundle the user no longer runs.
- tweakcc **4.0** changes the picture: it ships `adhoc-patch` (sandboxed custom patches, no fork needed), `unpack`/`repack` (native-binary round trip via `node-lief`), a programmatic API (`readContent`/`writeContent` — install-agnostic), and `--restore`.
- Spike result (this session): `tweakcc unpack` on native 2.1.143 produced **14.5 MB of plain JS source** (`file`: "JavaScript source"); the `switch(X.type)` patch-point pattern occurs **133 times**. Native patching is viable; anchor disambiguation among many candidates is the central risk.

**Two findings from design validation that this epic must carry:**

- **The Claude Code per-agent spec is internally wrong.** `docs/agent-specs/claude-code-context-bonsai-spec.md` currently says the tweakcc patches are "RECOMMENDED but not required" and "the MCP server alone must be functionally complete for prune/retrieve." The investigation proved this false: without the `archivedFilter` patch, prune cannot remove content from the model-facing transcript, which the shared spec mandates as a MUST. Story 1 must resolve this contradiction, not just add anchor guidance.
- **tweakcc 4.0's adhoc-patch does not expose `findRuntimeHelpers()`.** The old patches relied on a forked-tweakcc helper that discovers the minified names of Claude Code's `fs` / config-dir / session-id getters. The 4.0 `vars` object exposes only six unrelated identifiers. Story 3's library must re-implement that runtime-helper discovery; "retire the fork" means re-home its patch infrastructure into our own code, not delete it.

This epic re-implements the port on tweakcc 4.0, makes native installs first-class, eliminates the tweakcc fork, and treats patch-anchor resilience as a first-class contract — not an afterthought.

## User Model

### User Gamut

Examples only, spanning install kind, role, platform, risk posture, and lifecycle — not an exhaustive taxonomy:

- A solo developer in a long Claude Code session who hits the context wall and wants to prune/retrieve ranges.
- A developer whose Claude Code came from the **native installer** (the modern default) — never supported by the old tweakcc-fork port.
- A developer pinned to the npm `@anthropic-ai/claude-code` `cli.js` install (CI images, locked versions, air-gapped mirrors).
- The Context Bonsai maintainer who must keep the port alive across Claude Code's frequent releases without forking tweakcc or chasing a PR merge.
- A security-conscious operator evaluating a binary-patching tool before trusting it against their Claude Code install.
- Cross-platform users — Linux, macOS (Apple Silicon and Intel), Windows — where native `repack` has platform-specific concerns (e.g. ad-hoc code-signing on Apple Silicon).
- A future operator/agent following the install doc on a clean machine with no project context.

### User-Needs Gamut

Examples only, spanning correctness, durability, trust, reversibility, and maintenance cost:

- Pruning that **actually reduces** tokens sent to the provider — the core unmet need today.
- Works on the install kind the user already has, without forcing a downgrade from native to npm.
- Survives Claude Code re-minification between releases without a maintainer fire-drill — resilient, self-verifying anchors.
- Honest failure: if a patch point cannot be located, the user is told plainly; bonsai never silently no-ops while the model believes pruning worked.
- Reversibility: a one-command return to stock Claude Code.
- Transparency: clear disclosure of what is patched, what transcript data is read, and what reaches the provider.
- Low project maintenance: no tweakcc fork, no dependency on an external maintainer merging a PR.
- A clear answer for what happens when Claude Code auto-updates and silently reverts the patches.

### Ambiguities From User Model

- **Install-kind support breadth.** Native is the modern default and the user's case; npm `cli.js` still exists. Resolution: support both via tweakcc's install-agnostic `readContent`/`writeContent`, but make **native** the primary verified path; npm is covered by the same scripts and smoke-checked, not deeply e2e-tested.
- **Auto-update re-application.** A Claude Code auto-update replaces the binary and drops the patches. Resolution for this epic: **document** the re-apply procedure and have the apply harness detect an unpatched install; an automatic re-apply watcher is explicitly out of scope (candidate for a follow-up epic).
- **Cross-platform verification depth.** The dev environment is Linux. Resolution: e2e verification runs on Linux native + Linux npm; macOS/Windows are documented as best-effort and the platform-specific repack steps are called out as unverified-from-here.

## Stories

### Story 1: Resilient-anchor spec contract and patch-required correction
**Size:** Small
**Description:** Two coupled spec corrections. (a) Add **cross-port** guidance to the shared spec (`docs/context-bonsai-agent-spec.md`) that patch-point/hook discovery be resilient and self-verifying — multi-strategy, scored, disambiguated, confirmed post-patch — not merely fail-closed (today the spec only mandates fail-closed at L309–310, L379). (b) Correct the Claude Code per-agent spec (`docs/agent-specs/claude-code-context-bonsai-spec.md`), which wrongly states the tweakcc patches are "not required" and "the MCP server alone must be functionally complete": the investigation proved an MCP-only path cannot satisfy the shared spec's MUST that pruning remove follower messages from the model-facing transcript. The per-agent spec must state that a transcript-rewrite seam (the patch, or an equivalent) is required for the context-reduction guarantee, and that the MCP server MUST fail closed when that seam is absent. Claude-Code-specific resilience detail stays in the per-agent spec; only genuinely cross-port anchor guidance goes in the shared spec.
**Implementation Plan:** `.agents/plans/epic-cc-bonsai-tweakcc4/story-cc-bonsai-tweakcc4.1-resilient-anchor-spec.md`

### Story 2: tweakcc 4.0 adhoc-patch foundation and apply harness
**Size:** Large
**Description:** Add tweakcc 4.0.x as a dependency of `tweakcc_context_bonsai/`. Establish the `adhoc-patch` script layout. Build an **apply harness** on tweakcc's programmatic API: detect installation (`findAllInstallations`/`tryDetectInstallation`) → back up (`backupFile`) → `readContent` **once** → apply the bonsai patch transforms **in sequence over the one accumulating content string** → `writeContent` **once** → self-verify → report. The harness must also detect an already-patched or patch-reverted install, and support `--restore`. The three patches are NOT three independent `adhoc-patch` CLI invocations (that mechanism backs up nothing and re-reads pristine JS each time); they compose over a single content string. Retire the forked-tweakcc submodule and the npm-`cli.js`-only assumption — "retire" means re-homing the fork's patch infrastructure into this repo (see Story 3), not losing it. Update `STANDARDS.md` and `CC_BONSAI.md`, which still describe the dead fork-PR model. Acceptance gate: the harness round-trips `unpack → no-op → repack` on a copy of a native install and the rebuilt binary still runs.
**Implementation Plan:** `.agents/plans/epic-cc-bonsai-tweakcc4/story-cc-bonsai-tweakcc4.2-tweakcc4-foundation.md`

### Story 3: Resilient anchor-discovery library
**Size:** Large
**Description:** A shared module the patch scripts consume, with two responsibilities. (a) **Patch-point discovery:** multi-strategy finders, candidate scoring and disambiguation (the `switch(X.type)` pattern alone has 133 candidates), fail-closed on no/ambiguous match, and post-patch self-verification (inject a detectable sentinel, confirm it landed). (b) **Runtime-helper discovery:** re-implement the forked tweakcc's `findRuntimeHelpers()` — discovery of the minified function names for Claude Code's `fs` module, config-dir getter, and session-id getter — because tweakcc 4.0's `adhoc-patch` does not expose it. All three patches depend on this. This story is the concrete implementation of Story 1's contract and the shared dependency of Stories 4–6.
**Implementation Plan:** `.agents/plans/epic-cc-bonsai-tweakcc4/story-cc-bonsai-tweakcc4.3-anchor-discovery-lib.md`

### Story 4: archivedFilter patch — the context-shrink patch
**Size:** Medium
**Description:** Re-express `archivedFilter` as a tweakcc 4.0 `adhoc-patch` script built on Story 3's library. This is the patch that makes context actually shrink: it filters messages whose UUID is in `~/.claude/archived-<session>.json` out of what reaches the provider. The injected runtime code uses host globals (`globalThis` cache, `Buffer`); acceptance MUST include a check that these resolve inside the **repacked native** binary, not just the npm `cli.js`. Demoable: a prune in a live native Claude Code session measurably reduces context.
**Implementation Plan:** `.agents/plans/epic-cc-bonsai-tweakcc4/story-cc-bonsai-tweakcc4.4-archivedfilter-patch.md`

### Story 5: messageContentIds patch
**Size:** Medium
**Description:** Re-express `messageContentIds` as an `adhoc-patch` script on Story 3's library: when the `compaction-mode-<session>` marker exists, inject `[msg:<uuid>]` tags into model-visible message content so the model can reference and retrieve ranges by anchor id.
**Implementation Plan:** `.agents/plans/epic-cc-bonsai-tweakcc4/story-cc-bonsai-tweakcc4.5-messagecontentids-patch.md`

### Story 6: contextBonsaiGauge patch
**Size:** Large
**Description:** Re-express `contextBonsaiGauge` as an `adhoc-patch` script on Story 3's library: inject context-utilization gauge calculation, the attachment-registration hook, and severity-graduated reminder text. This is the most complex patch (multiple anchor points and helper functions); it must re-find anchors after each insertion because earlier injections shift offsets. Acceptance MUST include verification that injected host globals (`Buffer`, etc.) resolve in the repacked native binary.
**Implementation Plan:** `.agents/plans/epic-cc-bonsai-tweakcc4/story-cc-bonsai-tweakcc4.6-gauge-patch.md`

### Story 7: MCP server and ccsnap refresh, with patch-aware fail-closed
**Size:** Medium
**Description:** Verify and update the MCP server and `ccsnap` CLI against current Claude Code: confirm session discovery, the JSONL session-file format, the MCP registration file (current Claude Code 2.1.x registers MCP servers in `~/.claude.json`, not `settings.json` — verify and use the authoritative one), and the three IPC files (`archived-<session>.json`, `compaction-mode-<session>`, the session JSONL) still align with the re-implemented patches. **Add the root-cause fix for the original bug:** the MCP `context-bonsai-prune` handler MUST detect when the `archivedFilter` patch is absent or reverted (e.g. after a Claude Code auto-update) and return a deterministic plain-text error instead of writing an archive that nothing consumes — satisfying the shared spec's "MUST not silently no-op" rule. Bump versions; fix only what drifted otherwise.
**Implementation Plan:** `.agents/plans/epic-cc-bonsai-tweakcc4/story-cc-bonsai-tweakcc4.7-mcp-ccsnap-refresh.md`

### Story 8: End-to-end verification for native Claude Code
**Size:** Medium
**Description:** Adapt the e2e protocol to the native install + tweakcc 4.0 flow. MUST include an **install-procedure e2e test** (clean state → documented apply commands verbatim → tools loaded and functional) and the **Protocol A secret-prune oracle** (prune actually removes content from active context). Full PASS is the epic's release gate.
**Implementation Plan:** `.agents/plans/epic-cc-bonsai-tweakcc4/story-cc-bonsai-tweakcc4.8-e2e-verification.md`

### Story 9: Operator documentation
**Size:** Medium
**Description:** Ship operator-facing docs satisfying the spec's Operator Documentation Contract: prerequisites (incl. Node ≥ 20), copy-paste install commands for the tweakcc 4.0 apply flow (native and npm), MCP registration in the authoritative file (`~/.claude.json` per Story 7), post-install verification, security disclosure, and uninstall (`tweakcc --restore`). MUST cover the auto-update lifecycle: that a Claude Code auto-update silently reverts the patches, the re-apply procedure, and a recommendation to pin/disable auto-update (`DISABLE_AUTOUPDATER=1`) for a stable bonsai install.
**Implementation Plan:** `.agents/plans/epic-cc-bonsai-tweakcc4/story-cc-bonsai-tweakcc4.9-operator-docs.md`

## Dependencies and Integration

- **Prerequisites:** tweakcc ≥ 4.0.13 (published). Node ≥ 20 on the operator machine (tweakcc `adhoc-patch` sandbox spawns a child node with `--permission`). A Claude Code 2.1.x install (native or npm).
- **Enables:** A maintained Claude Code port that needs no tweakcc fork and no upstream PR; the resilient-anchor contract (Story 1) is reusable guidance for every other port.
- **Story dependency graph:**
  - Story 1 → independent; SHOULD land before Stories 3–6 (it defines their contract). May run parallel to Story 2.
  - Story 2 → depends on nothing in-epic; foundation for 3–9.
  - Story 3 → depends on Story 2 (needs the harness/extract pipeline) and Story 1 (contract).
  - Stories 4, 5, 6 → each depends on Story 3; independent of each other (could parallelize if orchestration allowed; default sequential).
  - Story 7 → depends on Stories 4–6 (IPC alignment is verified against the final patches).
  - Story 8 → depends on Stories 4–7 (verifies the full integrated system).
  - Story 9 → depends on Story 8 (docs describe the verified, final apply flow).
- **Integration points:**
  - Parent repo: `docs/context-bonsai-agent-spec.md`, `docs/agent-specs/claude-code-context-bonsai-spec.md` (Story 1); `docs/context-bonsai-e2e-template.md` reference (Story 8).
  - Side repo `tweakcc_context_bonsai/`: new `adhoc-patch` script set + apply harness + discovery library (Stories 2–6), `mcp-server/` and `src/` (Story 7), operator docs (Story 9).
  - No submodule de-registration is required. The forked tweakcc lives at the sibling project `~/projects/the_observer/tweakcc` — it is NOT a submodule of `context-bonsai-agents` or of `tweakcc_context_bonsai/` (verified: `.gitmodules` has no such entry). "Retire the fork" (Story 2) means re-homing its patch infrastructure into `tweakcc_context_bonsai/` and updating stale docs (`STANDARDS.md`, `CC_BONSAI.md`); no git submodule change occurs.
- **Patch composition contract:** the apply harness applies the three patches as ordered transforms over a single accumulating content string (one `readContent`, three transforms, one `writeContent`). Stories 4–6 MUST NOT assume pristine input — a later patch sees the earlier patches' insertions and must re-find anchors against the modified content.
- **Cross-cutting risks:**
  - Claude Code auto-update silently reverts patches (five versions observed locally — roughly weekly cadence). Mitigated on two fronts: the Story 7 MCP fail-closed check surfaces the failure to the model the moment prune is attempted on a reverted install, and Story 9 documents re-apply plus disabling auto-update. Automatic re-apply is out of scope.
  - Injected runtime code depends on Claude Code's Bun host globals (`Buffer`, custom `globalThis` caches). These are verified in the npm `cli.js` world but must be re-verified in the repacked native binary — acceptance checks in Stories 4 and 6.
  - tweakcc 4.0's published tarball omits the declared `dist/lib/index.d.ts`; the API is consumed via `.mjs` without types.
  - macOS/Windows native repack steps cannot be verified from the Linux dev environment.

## Shared Implementation Contracts (pinned)

These three contracts are settled at the epic level so the stories cannot diverge — the root cause of the discarded first draft set was splitting story work before these were pinned. Stories 2–7 MUST conform; changing a contract is an epic-level change, not a story-level one.

### Contract A — Patch module layout, naming, and apply mechanism

- The three patches are **transform modules**, not standalone `tweakcc adhoc-patch` CLI invocations. `tweakcc adhoc-patch` is not the apply mechanism: it takes no backup and re-reads pristine JS per call, which is incompatible with composing three patches and with safe `--restore`. The apply harness composes the modules itself.
- The apply harness uses tweakcc 4.0's **programmatic API**: `findAllInstallations`/`tryDetectInstallation` → `backupFile` → `readContent` (once) → compose the three transforms over the single accumulating content string → `writeContent` (once) → verify. `readContent`/`writeContent` are install-agnostic — native `unpack`/`repack` or npm `cli.js` transparently.
- Files, all in side repo `tweakcc_context_bonsai/`:
  - `patches/archived-filter.patch.ts`, `patches/message-content-ids.patch.ts`, `patches/context-bonsai-gauge.patch.ts`
  - `patches/types.ts` — the `BonsaiPatch` interface and shared types
  - `patches/registry.ts` — the ordered patch registry the harness composes
  - `patches/discovery.ts` — the Contract B library
  - `apply/tweakcc-api.ts` — locally-typed wrapper over the tweakcc 4.0 API (the published tarball omits `index.d.ts`)
  - `apply/apply-bonsai.ts` — the apply harness (also implements `--restore`)
- Each patch module exports exactly one `BonsaiPatch`:
  ```ts
  interface BonsaiPatch {
    name: string;      // stable id: "archived-filter" | "message-content-ids" | "context-bonsai-gauge"
    sentinel: string;  // unique ASCII marker injected into patched content; format /*cb:<name>:v1*/
    apply(content: string, ctx: PatchContext): string;  // throws BonsaiPatchError to fail closed
  }
  ```
- Apply order is fixed: `archived-filter`, then `message-content-ids`, then `context-bonsai-gauge`. Each transform receives the content as left by the previous one and MUST locate its anchors against that already-modified content.

### Contract B — The discovery library API (`patches/discovery.ts`)

The shared module every patch consumes. Fixed surface:

```ts
// patch-point discovery
interface Candidate { index: number; length: number; score: number; text: string; }
function findCandidates(content: string, patterns: RegExp[]): Candidate[];
function scoreCandidates(content: string, candidates: Candidate[], scorers: Scorer[]): Candidate[];
function selectUnique(content: string, candidates: Candidate[], opts: { minScore: number; minMargin: number }): Candidate;
//   throws AnchorNotFoundError  (0 candidates, or none above minScore)
//   throws AnchorAmbiguousError (top two candidates within minMargin)

// runtime-helper discovery — the re-homed port of the fork's findRuntimeHelpers()
interface RuntimeHelpers { fsFunc: string; configDirFunc: string; sessionIdFunc: string; }
function findRuntimeHelpers(content: string): RuntimeHelpers;  // throws RuntimeHelpersError

// post-patch self-verification
function verifySentinel(content: string, sentinel: string): void;  // throws unless sentinel present exactly once
```

Every throwing path IS the fail-closed mechanism: the apply harness catches it, restores the backup, and reports which patch and which anchor failed. No silent no-op.

### Contract C — Patch-presence detection (the root-cause fix for the original bug)

- The single source of truth for "is bonsai actually patched into the Claude Code that is running" is the **patch sentinel embedded in the Claude Code executable itself** — the same per-patch `sentinel` string from Contract A. There is **no separate sentinel state file**: a state file goes stale the moment a Claude Code auto-update replaces the binary, producing a false positive.
- Before writing any archive, the MCP server's `context-bonsai-prune` handler MUST resolve the running Claude Code executable (via the parent-process chain it already walks for session discovery) and scan that file for the `archived-filter` patch sentinel. If absent — e.g. the binary was replaced by an auto-update — it returns a deterministic plain-text error and writes nothing, satisfying the shared spec's "MUST not silently no-op."
- One artifact, three uses: post-patch self-verification (Contract B `verifySentinel`), runtime patch-presence detection (the MCP prune guard), and operator verification (Story 9). Story 4 does not write a separate file for Story 7; Story 7 reads the sentinel Story 4 already injects.
