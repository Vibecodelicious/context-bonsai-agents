# Story: Forward-Port Claude Code Context Bonsai To 2.1.201

> **STAGED FOR PARENT.** This plan and its validation artifacts are drafted in the side repo `tweakcc_context_bonsai/.agents/plans/` per the executed 2.1.200 precedent; the spec's §3.5 relay-bookkeeping allowlist covers this subtree. Their durable home is the parent repo's `.agents/plans/`; Phase 8 (Parent Landing) relocates them after Landing Authorization. Until then, every path in this plan written as `.agents/plans/…` resolves inside the side repo. The 2.1.200 cycle's own staged artifacts are still awaiting their Phase-8 re-home (owner-gated); they are untouchable by this cycle and collide with nothing here — all of this cycle's artifact names are keyed to a different `SOURCE_HEAD_SHA` and target version.

## Goal

Forward-port the Claude Code/tweakcc Context Bonsai integration from side-repo source `SOURCE_HEAD_SHA=22a0bd06958cd8d60cf4adfe48aa7b6ed08c962c` (`tweakcc_context_bonsai` `main`) onto the frozen npm target `@anthropic-ai/claude-code@2.1.201`, using the closed-artifact shape of the parent repo's `docs/agent-specs/forward-port-spec.md` (Part 1 core, Part 3 shape, §4.3 slot). The sealed outcome: side-repo `HEAD` contains only the approved changes needed to bind the frozen 2.1.201 target — all eight anchors re-verified against the real 2.1.201 bundle (generation scan: zero drift), tooling and docs rebound from 2.1.200 to 2.1.201, full live e2e evidence recorded — followed, after Landing Authorization, by parent landing (staged artifacts re-homed, submodule pin advanced, final verification).

**Generation provenance**: generated and §1.15-validated on the stronger (Fable-class) tier per the executed 2.1.200 precedent and the owner's recorded tiering direction (`docs/meta-loop-direction.md`, parent repo). The target was supplied by the invoker (relay chain, HAND_OFF next-unit instruction) on the pending-target signal from `scripts/detect-pending-target.mjs` (exit 3: ported 2.1.200, upstream stable 2.1.201) — the detection is the trigger, the HAND_OFF instruction is the supply. The executing tier for calibration runs is an **Opus 4.8 subagent at low effort**; every command below is bound so that execution requires no judgment call this plan does not resolve.

**Execution-mode rule (fixed).** The invoker's launch context must state exactly one of:

- `REAL-CYCLE` — execute against the absolute paths bound in this plan. Runs once; Phase 8 requires the Landing Authorization.
- `CALIBRATION` with an explicit scratch clone root — the invoker pre-clones this side repo to that root before launch; the executor substitutes the scratch root for `/home/basil/projects/context-bonsai-agents/tweakcc_context_bonsai` in every side-repo command (a mechanical path substitution, nothing else changes). Frozen artifacts under `/tmp/cc-bonsai-artifacts/` are shared across runs and treated read-only except where Phase 2's rerun-safety rule fires; `/tmp/cc-bonsai-e2e/` is runtime evidence output, not a frozen artifact — each run writes, and may overwrite, its own outputs there; the invoker runs calibration executions serially — concurrent runs against the shared `/tmp` artifacts are forbidden. Phase 8 never runs in calibration (Landing Authorization is absent by construction). Phase 9's maintenance report is still written — inside the scratch clone, for the observing chain to collect. Nothing in a calibration run reads from or writes to the real side-repo working tree.

If the launch context states neither mode, STOP and request it from the invoker (`escalation-reason-code: input-target-missing` does not apply — the target is bound here; record the STOP without a reason code as an in-run resolve-and-continue once the mode arrives, per §1.17's in-run rule).

**Run-continuity rule (§1.18).** The executing tier is below the owner tier, so the §1.18 mechanisms bind: the invoker seeds an intent log (path named in the launch context) with a `RUN-START` timestamp before launch. If the launch context names no intent-log path, STOP and request it from the invoker before any side-effecting action — the §1.18 duties are non-negotiable and the executor never invents the path (an in-run resolve-and-continue STOP carrying no reason code, exactly like the mode-missing rule above). Then: the executor appends a command-sourced-timestamp entry before every side-effecting action and after its result, reconciles from evidence at every phase start and before concluding any STOP, keeps the final report current at every phase transition, and treats re-observed own work (evidence postdating `RUN-START`) as resume-at-next-unexecuted-step, never a collision STOP. Phase 0's collision checks run on first execution only, per §1.18's clean-start authorship invariant; a run that finds same-cycle artifacts before executing anything is a genuine §1.14 case and STOPs.

## Non-Goal

Do not change Context Bonsai behavior. Do not edit the parent repo's `docs/agent-specs/forward-port-spec.md` at any point, or ANY parent-repo file before Phase 8's Landing Authorization. Do not upgrade, patch, restore, or otherwise touch the live installed `claude` CLI (2.1.198 at generation) or anything under `~/.local/share/claude/` — all target-version work runs against the frozen downloaded artifacts under `/tmp/cc-bonsai-artifacts/` (owner constraint, recorded 2026-07-03, still in force). Do not weaken `minScore`/`minMargin` or any ambiguity check. Do not touch the 2.1.200 cycle's staged artifacts, evidence, or `/tmp/cc-bonsai-artifacts/claude-code/2.1.200/` tree, or any `/tmp/cc-cal-run-*` prior-run clone (§1.10 untouchables).

## Execution Outcome Statement

Final side-repo `HEAD` on `main` is a descendant of `22a0bd06958cd8d60cf4adfe48aa7b6ed08c962c` containing only: this cycle's implementation commits (targets enumerated below), the staged plan/validation artifacts, and relay hand-off documents under the drift allowlist. The frozen 2.1.201 target validates green through the canonical validation set and the immutable live e2e scope, evidenced against the pinned `/tmp` artifacts. Parent `main` advances the `tweakcc_context_bonsai` pin only in Phase 8, after Landing Authorization.

## Frozen Inputs

- `SOURCE_REF`: `refs/heads/main` in `tweakcc_context_bonsai/`
- `SOURCE_HEAD_SHA`: `22a0bd06958cd8d60cf4adfe48aa7b6ed08c962c`
- Prior executed cycle: `f92dfac9c5daecc286e03b90ef20bb930cf68818` → target 2.1.200, SEALED 2026-07-03 (implementation commits `2c1c6fd`/`eef21e0`/`388830a`/`6fa187c`; owner-authorized push to `origin/main`; its Phase-8 staged-artifact re-home remains owner-gated and is independent of this cycle). This is the next routine cycle, not a §1.9 supersession; the intervening source commits are the sealed 2.1.200 cycle itself plus relay bookkeeping, all on `main` at the frozen SHA.
- `TARGET_PACKAGE`: `@anthropic-ai/claude-code@2.1.201`
  - tarball `https://registry.npmjs.org/@anthropic-ai/claude-code/-/claude-code-2.1.201.tgz`
  - integrity `sha512-BIWC6KCKtLNb8pbVIuWiJ+qcthCFhrmIm6u3wOcIHjYc5oruozQ7l5pWWGVyJcUrKygysdWS4pkljdXL2rDdsg==`
  - shasum `4a19d0673651fdadb7b3c5a1cb66a3611555a0a9`
- `PLATFORM_PACKAGE`: `@anthropic-ai/claude-code-linux-x64@2.1.201` (the wrapper's `optionalDependencies` pin it lockstep)
  - tarball `https://registry.npmjs.org/@anthropic-ai/claude-code-linux-x64/-/claude-code-linux-x64-2.1.201.tgz`
  - integrity `sha512-pJaih99BHjY2WvBoPYvDMFhs90DwTXUaC8LIqQe/W+2g4jJr7VYMTVv0C60vIoxg17nxaMUTtlBhY87U3qP5kA==`
  - shasum `4ca08421760be1f52409c623e03ac483e5ca3bbb`
- Freeze provenance: resolved once at freeze time 2026-07-05. Observed dist-tags at freeze: `latest=2.1.201`, `next=2.1.201`, `stable=2.1.193`. Target supplied as 2.1.201 by the invoker (the detector's pending-target signal names the highest stable release, prereleases excluded). No later re-resolution: all commands use the frozen literals above.
- `TARGET_NATIVE_BINARY`: `/tmp/cc-bonsai-artifacts/claude-code/2.1.201/native/claude-2.1.201` — the `package/claude` member of the platform tarball; binary sha256 `a34809a6839fdefff21b9347d7fb5b6b58e6a9cc208a5e62853f29c83eb107a3`; reports `2.1.201 (Claude Code)`. This is the §4.3 frozen-binary route (live install is 2.1.198, not the target): every apply/extraction/e2e command drives this explicit path, never the live `claude` shim.
- `EXTRACTED_BUNDLE`: `/tmp/cc-bonsai-artifacts/claude-code/2.1.201/native/extracted.js` — sha256 `9f9519b0c93914bd2fda5e6cdc7a74df2b7121909f783fb3b1cc9c86771708ef`, 18698064 bytes, extracted with tweakcc `4.0.13` under bun `1.3.14`.
- `MANIFEST`: `/tmp/cc-bonsai-artifacts/claude-code/2.1.201/native/manifest.json` (§3.1 fields; written at generation, re-verified at execution).
- `VALIDATION_MODE`: `committed-final`.
- **Relay-drift allowlist (§3.5, spec-bound)**: relay bookkeeping commits landing on side-repo `main` between generation and execution are routine, not §1.9 drift, iff every changed path matches `^(HAND_OFF|HANDOFF_|\.agents/plans/)`. Preflight check (from the side repo): `test -z "$(git diff --name-only 22a0bd06958cd8d60cf4adfe48aa7b6ed08c962c..HEAD | grep -Ev '^(HAND_OFF|HANDOFF_|\.agents/plans/)')"`. Empty output: record the interleaved commits and their changed paths in the run evidence, run the §3.5 byte-identity re-check (Phase 0, below) proving the approved plan and replay-set files at `HEAD` are byte-identical to their approved-commit versions, and proceed from `HEAD`. Non-empty output: genuine source drift — STOP per §1.9 (`escalation-reason-code: input-source-drift`); a fresh plan keyed to the new SHA is required, never a patch to this one.
- Pre-existing dirty paths (§1.10): side repo — none (clean at generation; this cycle's own staged artifacts are enumerated cycle artifacts once committed). Parent repo (Phase 8 only) — ` M tweakcc_context_bonsai` submodule pin (untouchable except by Phase 8's own pin advance).
- Pre-existing prior-cycle artifacts, untouchable (§1.10): `/tmp/cc-bonsai-artifacts/claude-code/2.1.200/**`; any `/tmp/cc-cal-run-*` clone; the 2.1.200 cycle's staged `.agents/plans/` artifacts (`story-rebase-cycle-f92dfac….md`, `validation/{replay-set,baseline}-f92dfac….json`, `maintenance-report-f92dfac….md`) and its committed `docs/` evidence.

All commands below use these frozen identities. Do not substitute moving refs, `HEAD`-relative resolution of the inputs, `latest`, or a newly resolved dist-tag.

## Behavioral Constraints Carried From The Claude Code Spec

These are load-bearing constraints from the parent repo's `docs/agent-specs/claude-code-context-bonsai-spec.md` (the message-ordering rules especially — scar tissue from real post-prune ordering defects). The forward-port must preserve every one; any 2.1.201-required change to these code paths is in scope only to keep these behaviors true, and the regression suites named must keep exercising them. None may be paraphrased away, narrowed, or dropped by this cycle. If implementation evidence suggests one is obsolete in 2.1.201, quote it to the owner via the watchdog and STOP that thread — do not delete or bypass it.

**Message-ordering / marker-coverage set:**

1. Archive marker coverage MUST include every original archived-interval JSONL row with a string `uuid`, **including UUID-bearing `type: "system"` rows such as `local_command`, `turn_duration`, and `away_summary`**; the appended summary placeholder is outside the original interval and MUST NOT be added to the marker for that prune. (Spec §Verified Host Primitives, archive-marker bullet.)
2. Prune marker writes MUST include every string-`uuid` row from the original archived interval, not just `user`/`assistant` rows, because the provider-bound patch filters by `__cbMessage.uuid` after Claude Code maps some JSONL metadata rows into provider-visible entries. (Spec §Prune and retrieve contract.)
3. Retrieve MUST remove marker entries for the same restored inclusive interval derived from the summary `compactMetadata`, including UUID-bearing system/meta rows, while preserving unrelated marker entries from other pruned ranges. (Spec §Prune and retrieve contract.)
4. The tweakcc provider filter must hide **all** provider-bound rows inside the archived interval, including JSONL `type: "system"` metadata rows that the host maps through its provider-side `api_system` branch. Filtering only `user`/`assistant` rows can leave orphan provider `system` messages and violate Anthropic ordering rules. (Spec §Transcript mutation path.) The `archived-filter.visibility` anchor must therefore keep binding the provider map that carries the `api_system` branch — the generation-time scan confirms that branch exists in the 2.1.201 bundle and the selector requires it structurally.
5. The MCP server rewrites the live JSONL to insert a placeholder `summary`-typed entry replacing the archived range (`markMessagesArchived` / `addArchivedMarkerEntries` in `src/lib/compact.ts`); atomic writes use `writeJsonlAtomic`, and mutations happen only during MCP tool calls while the model is paused. (Spec §Transcript mutation path.)

**Fail-closed / surface set:**

6. Every deterministic prune/retrieve failure or refusal MUST return an MCP result with `isError: true`, body plain text. (Spec §Fail-Closed Requirements.)
7. The prune-wrapper filter on the ambiguity path MUST remain in `mcp-server/index.ts` `loadSearchableMessages` / `resolveUniqueBoundary`, excluding messages whose `tool_use` block has `name === "context-bonsai-prune"` or `name === "mcp__context-bonsai__context-bonsai-prune"` from the candidate set on ambiguity. (Spec §Prune and retrieve contract.)
8. `loadSearchableMessages`/`searchableText` MUST surface each tool call's name, input, AND output content so pattern matching reaches tool-call payloads. (Spec §Prune and retrieve contract, Pattern Matching Contract bullet 1.)
9. The patch-presence guard MUST identify the running Claude binary independent of launch shape (versioned path, shim, `--resume`) via ancestor `/proc/<pid>/exe`, and MUST fail closed when no Claude ancestor binary is identified. (Spec §Fail-Closed Requirements.)
10. Missing session JSONL → structured error, no mutation. JSONL schema drift → compatibility error, no mutation. Transcript-rewrite seam absent or unverifiable → deterministic plain-text error, no archive-state write, no JSONL mutation. Marker-file write failure → roll back partial JSONL mutation. Pattern ambiguity after the prune-wrapper filter → deterministic plain-text error verbatim. (Spec §Fail-Closed Requirements.)

Regression anchors for this set: `mcp-server/index.test.ts` (guard, `isError`, wrapper filter, searchable text, and the two Constraint-10 compatibility tests landed by the 2.1.200 cycle at commit `2c1c6fd`), `src/lib/compact.ts` tests under `bun test` (marker coverage incl. system rows, retrieve marker removal), `patches/archived-filter.patch.test.ts` (provider-map filter incl. `api_system` handling). Generation-time review found no constraint that looks obsolete against the tweakcc design; nothing is queued for owner quotation.

## Inventory: Anchor Registry And Generation-Time Drift Scan

Inventory domain (§3.2): the anchor registry `patches/anchors.ts` (5 patch anchors) plus the runtime-helper discovery seams in `patches/discovery.ts` (3 helpers) — the same 8 anchor ids as the executed 2.1.156 and 2.1.200 cycles. Install-discovery is exercised implicitly by `apply --path` (explicit path this cycle; discovery not relied upon).

Generation-time drift scan, run against `EXTRACTED_BUNDLE` on 2026-07-05 (the exact command is bound in Phase 4; execution re-runs it and must reproduce these outcomes before any edit). **Zero drift**: every selector selects the same seam as at 2.1.200, same minified identifiers, same scores and candidate counts; every offset shifted uniformly by +23 bytes (the bundle grew 18698041 → 18698064 bytes).

| anchor_id | scan outcome (2.1.201) | 2.1.200 comparison | expected bucket |
|---|---|---|---|
| `archived-filter.visibility` | selects uniquely: offset `11749484`, score `105`, candidateCount `1`; `tengu_api_cache_breakpoints` + `user`/`api_system`/else branches, converters `mVf`/`gVf` | offset `11749461`, identical score/count/identifiers | `unchanged_anchor` |
| `message-content-ids.converter` | selects: offset `11690188`, score `110`, candidateCount `24`; user converter `mVf(e,t=!1,n,r)` — 4-arg signature discriminator intact | offset `11690165`, identical | `unchanged_anchor` |
| `context-bonsai-gauge.token-usage` | selects: offset `7663462`, score `62`, candidateCount `9`; accumulator `a6p(e,t,n)` with the `Mwr(n)??{inputTokens:0,…}` init — the 2.1.200-strengthened scorer holds its 35-point margin over the display formatter | offset `7663439`, identical | `unchanged_anchor` |
| `context-bonsai-gauge.attachment-pipeline` | selects: offset `7776924`, score `50`, candidateCount `17`; pipeline `I8a(e,t)` | offset `7776901`, identical | `unchanged_anchor` |
| `context-bonsai-gauge.reminder-render` | selects uniquely: offset `14376442`, score `40`, candidateCount `1` | offset `14376419`, identical | `unchanged_anchor` |
| `runtime-helper.fs` | resolves: `Xt` | identical | `unchanged_anchor` |
| `runtime-helper.config-dir` | resolves: `rr` | identical | `unchanged_anchor` |
| `runtime-helper.session-id` | resolves: `Dt` | identical | `unchanged_anchor` |

Generation additionally ran the full composition proof: `bun run e2e/native-e2e.ts artifact-evidence --bundle <EXTRACTED_BUNDLE> --manifest <MANIFEST>` exited 0 with all three patch sentinels (`/*cb:archived-filter:v1*/`, `/*cb:message-content-ids:v1*/`, `/*cb:context-bonsai-gauge:v1*/`) verified against the 2.1.201 bundle, with zero source edits.

Expected buckets are generation guidance only — execution assigns buckets from the §3.3 evidence predicates against the real scan it runs. **Scan-divergence rule (single path, fixed):** if execution's scan differs from this table in any respect, first re-verify the bundle checksum (`sha256sum` against the frozen value). Checksum mismatch → the frozen artifact was mutated: STOP; if the cycle ends there, `escalation-reason-code: executor-artifact-integrity`. Checksum match → the real scan is the evidence: record the divergence in the run evidence and the §1.16 report, then classify every anchor from the real scan per the §3.3 predicates and continue — an anchor that fails closed classifies `removed_or_ambiguous_anchor` (hard-blocking per §1.5; if the cycle ends on that unresolved block, `escalation-reason-code: input-approval-pending` per §1.13 gate 2). Never weaken a threshold to restore this table's expectation. There is no re-derivation contract this cycle: no anchor is expected `updated_anchor` and no scorer or selector edit is planned; if the real scan forces one, the §3.3 predicates and the hard-block route above govern — this plan authorizes no selector/scorer edits.

## Replay-Set Materialization

Produced during Phase 4 (after the scan reproduces), staged at `.agents/plans/validation/replay-set-22a0bd06958cd8d60cf4adfe48aa7b6ed08c962c.json`. Canonical JSON array, rows sorted by `anchor_id` then `target_path`, fields in exactly this order (§3.4): `anchor_id`, `source_version` (`2.1.200`), `target_version` (`2.1.201`), `bucket`, `replay_action`, `mapping_type`, `target_paths`, `rationale`, `evidence_ref`. One row per inventory anchor (8 rows); expected shape: all `unchanged_anchor` / `verify-unchanged` / `1:1`, `target_paths` = the registry file verified (`patches/anchors.ts` or `patches/discovery.ts`), `evidence_ref` = the matching section of `docs/semantic-anchor-analysis-2.1.201.md`. The committed artifact is the classification record (§1.14.4, closed-artifact); no separate approvals or exceptions files exist in this shape (§1.5/§1.7) — hard-blocking approvals and any exceptions are recorded in this plan's acceptance criteria and validation sections. Structural check bound in Phase 5.

## Immutable Live E2E Scope For This Cycle

Implementation may update `docs/e2e-protocol.md` but may not narrow this cycle's acceptance scope. Required live scenario set for a release-gate PASS, per §4.3 and `docs/e2e-protocol.md`:

- E2E-00: clean install procedure using the current README commands, with this cycle's two recorded adaptations: (a) the apply step runs `bun run apply --path "$TARGET_NATIVE_BINARY"` (owner live-install protection + §3.1 explicit path); (b) MCP registration in `~/.claude.json` points at this checkout's `mcp-server/index.ts` per the README block. If a README command fails or diverges, that is a FAIL finding — fix the README, then re-run — never substitute. **Bound verdict path (2.1.200 executed precedent, Amendment 1 there)**: E2E-00 is driven locally, not on a fly.io sprite. Verdict `PASS` (reason code `install-procedure-pass`) iff all of: (a) `bun run apply --path "$TARGET_NATIVE_BINARY"` exits 0 with all three patch sentinels verified; (b) `"$TARGET_NATIVE_BINARY" mcp list 2>&1 | grep -i 'context-bonsai.*connected'` exits 0; (c) the end-of-gate `bun run apply --restore --path "$TARGET_NATIVE_BINARY"` returns the binary to its pinned pristine sha256 (`a34809a6839fdefff21b9347d7fb5b6b58e6a9cc208a5e62853f29c83eb107a3`); (d) every command used is the README's (with the two recorded adaptations) and none diverged. These are the same commands Phases 4/6 already bind — E2E-00's verdict maps their outcomes; no extra drive is required.
- E2E-01: contiguous prune success; archived followers hidden from the model-visible transcript.
- E2E-02: ambiguity rejection and prune-wrapper collision filtering without mutation, with pattern targeting that exercises tool-call name, input, AND output reach across diverse tool-use blocks (Behavioral Constraint 8).
- E2E-03: retrieve by anchor success; restored content visible again.
- E2E-04: gauge cadence and severity. **Bound conditional exception (carried from the 2.1.200 executed precedent; reviewer sign-off recorded there in Amendment 1; owner notified 2026-07-03, `ok`)**: live gauge cadence/severity rendering has never been driven in any executed cycle and no bound driver exists at `SOURCE_HEAD_SHA`. If it is not driven, the executor records `PARTIAL` with reason code `gauge-live-render-not-driven` — not `BLOCKED` — and the exception covers that `PARTIAL` for seal gate 11 **iff** both compensating evidence conditions hold: (a) the gauge anchors select and the gauge patch composes with sentinel verification against the frozen bundle (the Phase 4 `apply`), and (b) at least one live `--output-format json` run this gate surfaces the accumulator usage record in `modelUsage`, behaviorally confirming the token-usage seam — bound command and predicate (the 2.1.200 executed precedent's evidence shape): `"$TARGET_NATIVE_BINARY" -p "Reply with exactly: PONG" --output-format json > /tmp/cc-bonsai-e2e/2.1.201-e2e04-modelusage.json` (run from a scratch directory, patched binary), then `jq -e '.modelUsage | to_entries | any(.value | has("inputTokens") and has("contextWindow") and has("maxOutputTokens"))' /tmp/cc-bonsai-e2e/2.1.201-e2e04-modelusage.json` must exit 0. The owner is notified of this cycle's reuse of the exception with the plan-staging FYI; an owner override supersedes it. A bound live gauge driver stays a §1.16 maintenance item.
- E2E-05: compatibility error path without mutation — both fail-closed paths distinctly: missing session JSONL → structured error; schema drift → compatibility error (Behavioral Constraint 10). **Bound verdict path**: verdict `PASS (unit-verified)` with reason code `compat-error-unit-verified` iff the two Constraint-10 compatibility regression tests that the 2.1.200 cycle added to `mcp-server/index.test.ts` (commit `2c1c6fd`: prune against a non-existent session JSONL → `isError: true`, no file created; prune against a session JSONL with a malformed non-final line → `isError: true`, file bytes unchanged) pass in Phase 5's `bun test`. Unlike the 2.1.200 cycle, no new tests are written — the coverage exists at `SOURCE_HEAD_SHA`; this cycle verifies it still passes. Live in-session fault injection stays a §1.16 maintenance item.
- E2E-06: persistence across resume (`"$TARGET_NATIVE_BINARY" --resume <session-id>`), archived-state filtering after reload.
- E2E-07 / Protocol A: secret-prune oracle; the secret never enters prune arguments, summary, or index terms. A Protocol A failure on a clean build after prior validation passed is a §1.17 escalation (`escalation-reason-code: structural-protocol-a-regression`), never a retry.
- E2E-08: bug-shape prune guard via direct versioned-path launch of `"$TARGET_NATIVE_BINARY"` with no `--resume`: launch-shape-independent guard identification, prune with real content removal plus measured input-token-footprint drop, retrieve restoration, `isError` surfacing for deterministic refusals. A transform-EFFECT oracle — never degraded to flag-based or recall-based checks.
- Pinned-target artifact evidence: semantic 2.1.201 anchor analysis plus artifact-evidence JSON against `EXTRACTED_BUNDLE`/`MANIFEST`.

**Live-scenario seeding discipline (§3.6, spec-bound — binds every marker/boundary phrase this gate seeds)**: each boundary or marker phrase must match exactly one transcript row when the oracle selects it; seed each marker with an instruction that the driven model acknowledge with a bare "ok" and never repeat the marker token (a driven model echoes capitalized markers into its replies, inflating the match count — observed and recovered in the 2.1.200 REAL-CYCLE); never seed a marker on the session's first message (the host attaches protected startup context there and the prune deterministically refuses to archive it — send at least one ordinary throwaway message first).

Every scenario drives the frozen `TARGET_NATIVE_BINARY` by explicit path; nothing launches the live `claude` shim. `BLOCKED` is per-scenario with `docs/e2e-protocol.md` reason codes (`credentials-missing-in-harness`, `sprite-unavailable`, `native-runtime-missing`, …); any `BLOCKED` accepted at seal requires the reviewer+judge exception per seal gate 11 (a gate-11 miss on credentials alone is `escalation-reason-code: input-credentials-missing`; the run resumes at the failed gate once credentials arrive — passed-gate evidence stands, §1.17/§1.18).

Known-risk note (recorded, accepted): the target binary shares `~/.claude` state (auth, `~/.claude.json`, session storage) with the operator's live 2.1.198 install — the same sharing every prior cycle's live e2e had. E2E sessions run from scratch project directories; the live install's binaries are never written. If the 2.1.201 binary migrates shared config in a way that disturbs the live CLI, record it as a cycle finding and STOP for owner guidance; do not attempt rollback engineering mid-cycle.

## Evidence Retention Policy

- Committed, staged-for-parent (side repo `.agents/plans/`): this plan; `validation/replay-set-22a0bd0….json`; `validation/baseline-22a0bd0….json`; `maintenance-report-22a0bd0….md`.
- Committed, side repo `docs/`: `semantic-anchor-analysis-2.1.201.md`; `e2e-results-<DATE>-2.1.201.md` (`<DATE>` = UTC run date, `YYYY-MM-DD`, matching the existing `docs/e2e-results-*` convention).
- Local-only (never committed): everything under `/tmp/cc-bonsai-artifacts/claude-code/2.1.201/` (tarball, binary, `extracted.js`, `manifest.json`) and `/tmp/cc-bonsai-e2e/` (`2.1.201-artifact-evidence.json`, `2.1.201-protocol-a-oracle.json`, `2.1.201-prune-guard-live.json`, `2.1.201-prune-effect.json`, scenario logs).

Committed docs summarize local evidence with durable facts: command, exit code, target version, explicit binary path, relevant SHA-256 values, scenario verdicts with reason codes, local artifact paths. No secrets, credentials, auth paths, session transcripts, or extracted bundle contents in any repository artifact.

## Acceptance Criteria

- [ ] Frozen identity recorded and re-verified: both package identities (wrapper + platform), tarball checksums (sha1 + sha512-base64), binary sha256, extracted-bundle sha256, manifest fields, and `"$TARGET_NATIVE_BINARY" --version` = `2.1.201 (Claude Code)`.
- [ ] Live-install protection held: no file under `~/.local/share/claude/` or the npm global install modified; the live `claude --version` still reports its pre-cycle version after the cycle.
- [ ] Relay-drift allowlist check passes at every preflight, including the §3.5 byte-identity re-check of the approved plan and replay-set files; any non-allowlisted drift STOPped per §1.9.
- [ ] Anchor drift scan reproduced with the generation table's outcomes; every anchor classified per §3.3 evidence predicates; replay-set staged with 8 schema-valid rows. **Hard-block approval recording (§1.5)**: if any row lands `removed_or_ambiguous_anchor` or `manual_review`, the seal is blocked until this criterion names the row and its reviewer+judge-approved resolution with citation; at generation no such row exists and none is approved.
- [ ] `docs/semantic-anchor-analysis-2.1.201.md` exists covering all 8 anchor sections per the bound format contract (Phase 4), with the 2.1.200 doc as format precedent and this cycle's real scan values.
- [ ] Every Behavioral Constraint (numbered 1–10 above) demonstrably preserved: the named regression suites pass, and any change to those code paths is minimal and 2.1.201-required.
- [ ] Harness and docs rebound to 2.1.201 with no stale 2.1.200 target bindings. Enumerated stale sites (verify line numbers against current source before editing): `e2e/native-e2e.ts` — `defaultBundlePath`/`defaultManifestPath` (lines 21–22, `.artifacts/claude-code/2.1.200/linux-x64/...`), `semanticReportPath` (line 23), the artifact-evidence missing-bundle message naming 2.1.200 (line 101), the `?? '2.1.200'` version fallbacks (lines 122, 131), `defaultNativeBinary()` returning the 2.1.200 versioned path (line 348); `patches/discovery.test.ts` — fixture paths and SKIP-message (lines 20–21, 111); `mcp-server/index.test.ts` — versioned-path fixture (line 859); `docs/e2e-protocol.md` — target references (lines 7, 35, 85, 441, 507, 509–510, 519–520, 526; the two `~/.local/share/claude/versions/` examples among these are illustrative doc text for operators whose live install is the target — this cycle's actual runs always pass the explicit frozen `--binary` path, and the version-bump keeps the illustration current without asserting the path exists). Replacement rule (fixed): version-bump in place, preserving each site's existing path shape (`.artifacts/claude-code/2.1.201/linux-x64/…`; `~/.local/share/claude/versions/2.1.201`) — these defaults are never exercised by this plan's bound commands, which always pass explicit flags. Historical/descriptive version mentions stay unchanged: `patches/discovery.test.ts`'s "from native 2.1.156" test title, `patches/anchors.ts`'s 2.1.200 re-derivation comments (provenance, not bindings), and all prior-cycle docs. `README.md`/`DEVELOPMENT.md` carry no stale target references at generation (verified by grep) and are non-targets unless execution finds one.
- [ ] Post-replay `bun test`, `bun run typecheck`, and the artifact-evidence run against the frozen bundle all pass; baseline rows no worse than baseline.
- [ ] Live e2e: the full immutable scope above, PASS or reviewer+judge-excepted, recorded in `docs/e2e-results-<DATE>-2.1.201.md` with reason codes.
- [ ] E2E-00/04/05 resolved per their bound paths: E2E-00 `PASS` by its local verdict predicate; E2E-04 driven live to PASS or `PARTIAL` covered by the recorded conditional exception (both compensating evidence conditions shown); E2E-05 `PASS (unit-verified)` via the two existing Constraint-10 tests.
- [ ] No closed-source extracted bundle, manifest, auth file, credential, or live transcript committed.
- [ ] Side repo committed before any parent change; Phase 8 blocked until Landing Authorization is recorded; parent commit updates only the landed artifacts, any stale-target-evidence parent-spec lines, and the pin.
- [ ] §1.16 maintenance report staged; every stumble carries a `SPEC-GAP`/`EXECUTOR-FAIL` verdict; any run/cycle-ending STOP records exactly one `escalation-reason-code: <code>` line (§1.17 emission format) in the final report and the maintenance report.

## Planned Target Files

### Side repo (implementation)

- `e2e/native-e2e.ts` — stale-site rebind only (enumerated above).
- `patches/discovery.test.ts` — stale fixture paths/SKIP message (enumerated above).
- `mcp-server/index.test.ts` — versioned-path fixture (line 859) only; the Constraint-10 tests already exist and are not rewritten.
- `patches/anchors.ts`, `patches/discovery.ts`, `patches/*.patch.ts`, `patches/registry.ts`, `patches/*.test.ts` — verify-only expected (zero drift at generation); minimal update only if execution's scan diverges, within the §3.3 predicates.
- `mcp-server/index.ts`, `src/**` — verify-only; in scope only if a Behavioral-Constraint regression surfaces and the fix is minimal and 2.1.201-required.
- `docs/semantic-anchor-analysis-2.1.201.md` (new), `docs/e2e-results-<DATE>-2.1.201.md` (new), `docs/e2e-protocol.md` (stale target references; never narrow scope).
- `.agents/plans/` staged artifacts (this plan, validation JSONs, maintenance report).

### Parent repo (Phase 8 only, after Landing Authorization)

- `.agents/plans/story-rebase-cycle-22a0bd0….md` + `.agents/plans/validation/{replay-set,baseline}-22a0bd0….json` + `.agents/plans/maintenance-report-22a0bd0….md` (landed from staging).
- `docs/agent-specs/claude-code-context-bonsai-spec.md` — only lines stating stale target evidence, if any.
- `tweakcc_context_bonsai` submodule pin.

### Explicit non-targets

- Parent `docs/agent-specs/forward-port-spec.md` (spec immutability, gate 12); parent `docs/agent-specs/context-bonsai-e2e-spec.md`; `opencode/`; the 2.1.200 cycle's staged artifacts and committed evidence docs; prior cycle plans (superseded or executed); `README.md`/`DEVELOPMENT.md` (no stale references at generation); the live `claude` install and `~/.local/share/claude/**`; any `~/.claude/**` auth/credential/transcript file as a repository artifact; extracted bundles or manifests inside any repository; `/tmp/cc-bonsai-artifacts/claude-code/2.1.200/**` and `/tmp/cc-cal-run-*`.

## Implementation Phases With Commands

Working directories: "From side repo" = `/home/basil/projects/context-bonsai-agents/tweakcc_context_bonsai` (in CALIBRATION mode, the scratch clone root replaces this one path anchor; no other command text changes); "From parent" = `/home/basil/projects/context-bonsai-agents` (Phase 8 only). `"$TARGET_NATIVE_BINARY"` in every command below is a live shell variable, bound by the first Phase 0 command; run each phase's commands in one shell session so the export persists, or re-run the export first.

### Phase 0: Toolchain, Credential, and Clean-State Preflight

- First, in the shell that will run this phase's commands (and again in any new shell): `export TARGET_NATIVE_BINARY=/tmp/cc-bonsai-artifacts/claude-code/2.1.201/native/claude-2.1.201`.
- From side repo: `command -v bun && command -v npm && command -v jq && command -v sha256sum && command -v sha1sum && command -v curl && command -v openssl && command -v tar`.
- From side repo: `bun --version` — record; generation ran under `1.3.14`. A different version is not itself a STOP; record it in the baseline provenance.
- From side repo: `git status --short` — empty, or only this cycle's own not-yet-committed validation artifacts (`baseline-22a0bd0….json`, `replay-set-22a0bd0….json`, the maintenance report) mid-execution. The plan file itself must already be tracked and committed (see Plan Approval); if it shows as untracked or modified here, STOP — the plan-approval gate has not closed, or the plan was altered.
- From side repo: `test "$(git rev-parse HEAD)" = "22a0bd06958cd8d60cf4adfe48aa7b6ed08c962c"` **or** the relay-drift allowlist check from Frozen Inputs passes; otherwise STOP per §1.9 (`escalation-reason-code: input-source-drift`).
- **§3.5 byte-identity re-check** (required whenever the allowlist path is taken; the allowlist covers `.agents/plans/**`, so an in-window rewrite of the approved artifacts must fail this check, not slip through). Bind the commit hash first, then diff:

  ```bash
  PLAN_COMMIT=$(git log -1 --format='%H' --diff-filter=A -- .agents/plans/story-rebase-cycle-22a0bd06958cd8d60cf4adfe48aa7b6ed08c962c.md)
  test -n "$PLAN_COMMIT"
  git diff --quiet "$PLAN_COMMIT" HEAD -- .agents/plans/story-rebase-cycle-22a0bd06958cd8d60cf4adfe48aa7b6ed08c962c.md
  ```

  All three must succeed. If the replay set is already committed at execution time (a resume), run the same three-command pattern for `.agents/plans/validation/replay-set-22a0bd06958cd8d60cf4adfe48aa7b6ed08c962c.json`. Any failure: STOP — either the plan-approval gate never closed (empty `PLAN_COMMIT`; see Plan Approval) or the approved artifact was rewritten in-window, which is source drift per §1.9, not bookkeeping.
- From side repo: `bun install` (bootstrap; §4.3), then `cd mcp-server && bun install && cd ..` (README prerequisite).
- Live-install protection probe (must-hold, recorded): `claude --version` — record the live version (2.1.198 at generation); re-run at cycle end and assert unchanged.
- Credentials (e2e phases only): the operator provisions Claude Code sign-in out of band per `docs/e2e-protocol.md` Phase 0 / Pre-Flight; nothing is written into commands or artifacts. MCP registration presence check (from the Pre-Flight, verbatim): `bun -e 'const c=await Bun.file(`${process.env.HOME}/.claude.json`).json(); if(!JSON.stringify(c.mcpServers||{}).includes("context-bonsai")) process.exit(1)'`. Missing preconditions make affected live scenarios `BLOCKED` under the protocol's reason codes — per-scenario, never a plan-wide hard-fail (§4.3).
- Collision checks (§1.14; on first execution only, per the §1.18 clean-start authorship invariant — on a resume, re-observed own work means continue at the next unexecuted step): from side repo, `test ! -e docs/semantic-anchor-analysis-2.1.201.md`; `test ! -e .agents/plans/validation/replay-set-22a0bd06958cd8d60cf4adfe48aa7b6ed08c962c.json`; `test ! -e .agents/plans/validation/baseline-22a0bd06958cd8d60cf4adfe48aa7b6ed08c962c.json`. A hit on first execution is a STOP (`escalation-reason-code: input-cycle-already-generated`) — not license to resume or delete. (This plan file itself exists by design — committed at the plan-approval gate; its presence is not a collision.)

### Phase 1: Freeze Verification

- From side repo: `npm view @anthropic-ai/claude-code@2.1.201 version dist.tarball dist.integrity dist.shasum --json` — every field equals the Frozen Inputs literals.
- From side repo: `npm view @anthropic-ai/claude-code-linux-x64@2.1.201 version dist.tarball dist.integrity dist.shasum --json` — every field equals the Frozen Inputs literals.
- A registry mismatch on either (a republished tarball) is a STOP-and-escalate: frozen identity no longer resolvable.

### Phase 2: Target Artifact Acquisition and Extraction

All from side repo. Rerun safety (decidable rule): if `test "$(sha256sum /tmp/cc-bonsai-artifacts/claude-code/2.1.201/native/claude-2.1.201 | cut -d' ' -f1)" = "a34809a6839fdefff21b9347d7fb5b6b58e6a9cc208a5e62853f29c83eb107a3"` and the extracted-bundle checksum test below both pass, **skip the download block entirely** (generation created these artifacts; its tarball staging file may live at a different path and need not exist) and proceed straight to the manifest check. If the binary exists with a wrong checksum, delete only `/tmp/cc-bonsai-artifacts/claude-code/2.1.201/` and run the full block. If it does not exist, or the binary passes but the extracted bundle is missing or fails its checksum, run the full block (extraction overwrites the bundle). Never touch the sibling `2.1.200/` tree.

```bash
mkdir -p /tmp/cc-bonsai-artifacts/claude-code/2.1.201/native /tmp/cc-bonsai-artifacts/claude-code/2.1.201/download /tmp/cc-bonsai-e2e
cd /tmp/cc-bonsai-artifacts/claude-code/2.1.201/download
curl -fsSL -o claude-code-linux-x64-2.1.201.tgz "https://registry.npmjs.org/@anthropic-ai/claude-code-linux-x64/-/claude-code-linux-x64-2.1.201.tgz"
test "$(sha1sum claude-code-linux-x64-2.1.201.tgz | cut -d' ' -f1)" = "4ca08421760be1f52409c623e03ac483e5ca3bbb"
test "$(openssl dgst -sha512 -binary claude-code-linux-x64-2.1.201.tgz | base64 -w0)" = "pJaih99BHjY2WvBoPYvDMFhs90DwTXUaC8LIqQe/W+2g4jJr7VYMTVv0C60vIoxg17nxaMUTtlBhY87U3qP5kA=="
tar -xzf claude-code-linux-x64-2.1.201.tgz package/claude
mv -f package/claude ../native/claude-2.1.201
chmod +x ../native/claude-2.1.201
test "$(sha256sum ../native/claude-2.1.201 | cut -d' ' -f1)" = "a34809a6839fdefff21b9347d7fb5b6b58e6a9cc208a5e62853f29c83eb107a3"
../native/claude-2.1.201 --version | grep -F '2.1.201'
```

Extraction (run from the side-repo root — the `bun --eval` imports `./apply/tweakcc-api` relative to it; `cd` back from the download dir first):

```bash
bun --eval "import { tweakccApi } from './apply/tweakcc-api'; const c = await tweakccApi.readContent({ path: '/tmp/cc-bonsai-artifacts/claude-code/2.1.201/native/claude-2.1.201', kind: 'native', version: '2.1.201' }); await Bun.write('/tmp/cc-bonsai-artifacts/claude-code/2.1.201/native/extracted.js', c);"
test "$(sha256sum /tmp/cc-bonsai-artifacts/claude-code/2.1.201/native/extracted.js | cut -d' ' -f1)" = "9f9519b0c93914bd2fda5e6cdc7a74df2b7121909f783fb3b1cc9c86771708ef"
```

Manifest: ensure `/tmp/cc-bonsai-artifacts/claude-code/2.1.201/native/manifest.json` carries the §3.1 fields with exactly the Frozen Inputs values (package identities, reported version, explicit install path + provenance, extraction command, `tweakcc 4.0.13`, bun version, platform `linux-x64`, extracted path, bundle sha256/bytes). Verify: `jq -e '.claudeCodeVersion=="2.1.201" and .extractedBundleSha256=="9f9519b0c93914bd2fda5e6cdc7a74df2b7121909f783fb3b1cc9c86771708ef" and (.installPath|startswith("/tmp/cc-bonsai-artifacts/"))' /tmp/cc-bonsai-artifacts/claude-code/2.1.201/native/manifest.json`.

### Phase 3: Baseline Capture

From side repo, before any implementation edit. Emit `.agents/plans/validation/baseline-22a0bd06958cd8d60cf4adfe48aa7b6ed08c962c.json` (`mkdir -p .agents/plans/validation` first): JSON array, fields per row in exactly this order: `row_id`, `command`, `frozen_target_package` (`@anthropic-ai/claude-code@2.1.201`), `frozen_source_head_sha` (`22a0bd06958cd8d60cf4adfe48aa7b6ed08c962c`), `exit_code`, `result`, `artifact_path`, `provenance_ref`. No empty or `n/a` fields (§1.6). Capture each row's full output under `/tmp/cc-bonsai-e2e/baseline/` (local-only) and reference it as `artifact_path`.

| row_id | command | result mapping | provenance_ref (record its output) |
|---|---|---|---|
| `01` | `bun install` | `pass` if exit 0 | `git rev-parse HEAD` |
| `02` | `bun test` | **must-be-green**: non-zero exit is STOP-and-escalate (`escalation-reason-code: env-upstream-regression` does not apply to the side repo's own suite — a pre-existing side-repo regression is source-state failure: STOP and report to the invoker without a structural code) | `git rev-parse HEAD` |
| `03` | `bun run typecheck` | **must-be-green**, as row 02 | `jq -r '.scripts.typecheck' package.json` |
| `04` | `bun run e2e/native-e2e.ts artifact-evidence --bundle /tmp/cc-bonsai-artifacts/claude-code/2.1.201/native/extracted.js --manifest /tmp/cc-bonsai-artifacts/claude-code/2.1.201/native/manifest.json --out /tmp/cc-bonsai-e2e/2.1.201-artifact-evidence.json` | **must-be-green** (exit 0) **this cycle** — unlike the 2.1.200 cycle's expected-stale-fail row 04: the harness selectors are version-agnostic, the explicit `--bundle`/`--manifest` flags override the stale 2.1.200 defaults, the semantic-report gate at baseline validates the committed 2.1.200 doc (present at `SOURCE_HEAD_SHA` — the §1.15 prior-version gating; its passing here is not target evidence), and the generation-time scan proved all selectors and sentinels green against the 2.1.201 bundle with zero source edits. A non-zero exit here is evidence drift against the generation scan: STOP and record. | `sha256sum /tmp/cc-bonsai-artifacts/claude-code/2.1.201/native/extracted.js` |

Validate: `jq -e 'length==4 and all(.[]; .row_id and .command and .frozen_target_package and .frozen_source_head_sha and (.exit_code|type=="number") and .result and .artifact_path and .provenance_ref and (.provenance_ref!="n/a") and (.artifact_path!="n/a"))' .agents/plans/validation/baseline-22a0bd06958cd8d60cf4adfe48aa7b6ed08c962c.json` and `jq -e 'all(.[]; .exit_code==0)' <same file>`.

Post-replay and live-e2e result rows are appended to this same artifact file per the executed-precedent convention (§4.3), continuing `05`, `06`, … with the same field order.

### Phase 4: Anchor Re-Verification and Replay (in place, §3.5)

- Re-run the drift scan, verbatim, and compare outcomes to the generation-time table (from side repo):

```bash
bun --eval "
import { readFileSync } from 'node:fs';
import { selectVisibilitySwitchAnchor, selectMessageContentConverterAnchor, selectTokenUsageHelperAnchor, selectAttachmentPipelineAnchor, selectReminderRenderAnchor } from './patches/anchors';
import { findRuntimeHelpers } from './patches/discovery';
const content = readFileSync('/tmp/cc-bonsai-artifacts/claude-code/2.1.201/native/extracted.js', 'utf8');
const probes = {
  'archived-filter.visibility': () => { const a = selectVisibilitySwitchAnchor(content); return { offset: a.index, score: a.score, candidates: a.evidence.candidateCount }; },
  'message-content-ids.converter': () => { const a = selectMessageContentConverterAnchor(content); return { offset: a.index, score: a.score, candidates: a.evidence.candidateCount }; },
  'context-bonsai-gauge.token-usage': () => { const a = selectTokenUsageHelperAnchor(content); return { offset: a.index, score: a.score, candidates: a.evidence.candidateCount }; },
  'context-bonsai-gauge.attachment-pipeline': () => { const a = selectAttachmentPipelineAnchor(content); return { offset: a.index, score: a.score, candidates: a.evidence.candidateCount }; },
  'context-bonsai-gauge.reminder-render': () => { const a = selectReminderRenderAnchor(content); return { offset: a.index, score: a.score, candidates: a.evidence.candidateCount }; },
  'runtime-helpers': () => findRuntimeHelpers(content),
};
for (const [name, fn] of Object.entries(probes)) {
  try { console.log(name, '=>', JSON.stringify(fn())); }
  catch (e) { console.log(name, '=> THREW', e.name + ':', e.message); }
}
"
```

  Every anchor must reproduce the generation table (offsets `11749484`/`11690188`/`7663462`/`7776924`/`14376442`, scores `105`/`110`/`62`/`50`/`40`, candidate counts `1`/`24`/`9`/`17`/`1`, helpers `Xt`/`rr`/`Dt`). Any divergence follows the Inventory section's scan-divergence rule (checksum re-verify first; mismatch → integrity STOP; match → classify from the real scan per §3.3).
- Worktree artifact check re-run (§1.14.10), immediately before the first edit: `git status --short -- patches/ e2e/ mcp-server/ docs/` and `git ls-files --others --exclude-standard -- patches/ e2e/ mcp-server/ docs/` — any output is a `tracked-dirty`/`existing-untracked` overlap: STOP until approved or deferred with citation.
- Update the enumerated stale sites in `e2e/native-e2e.ts`, `patches/discovery.test.ts`, `mcp-server/index.test.ts`, `docs/e2e-protocol.md` (Acceptance Criteria list; verify line numbers against current source before editing; version-bump in place, path shapes preserved; historical mentions stay).
- Write `docs/semantic-anchor-analysis-2.1.201.md` — all 8 sections, the 2.1.200 doc as format precedent, this run's scan offsets/identifiers/scores, plus a Forward-Port Note recording the zero-drift outcome (identifiers `mVf`/`a6p`/`I8a`/`Xt`/`rr`/`Dt` unchanged from 2.1.200, uniform +23-byte offset shift). **Bound format contract (machine-validated by `validateSemanticReport` in `e2e/native-e2e.ts`; mislabeled fields failed first attempts in both 2.1.200 calibration runs):** each of the 8 sections is headed exactly `## <anchor-id>` (the inventory table's ids, nothing appended); every section contains each of these ten labels verbatim, immediately followed by a colon — `Anchor ID:`, `Patch or helper:`, `Pinned artifact identity:`, `Selected offset and snippet:`, `Host behavior controlled:`, `Required seam rationale:`, `Plausible wrong candidates rejected:`, `Ambiguous/no-match fail-closed evidence:`, `Runtime or model-facing evidence:`, `Reviewer checklist:` — never reworded, extended, or merged into a sentence (the validator matches the literal substring `<label>:` inside each section); and the document contains the phrases `mechanical locator evidence` and `not release-gate` (the validator's reclassification check). Re-verify the label list against `validateSemanticReport`'s `requiredSemanticSections`/`requiredSemanticFields` arrays at edit time.
- Verify patch composition end-to-end against the frozen bundle: `bun run apply --path "$TARGET_NATIVE_BINARY"` must complete with sentinel verification (this also exercises §3.6's runtime binding), then `bun run apply --restore --path "$TARGET_NATIVE_BINARY"` to return the artifact to pristine for the baseline-equivalent state (live e2e re-applies in Phase 6). If `apply` fails closed on any anchor, that anchor's classification is wrong — return to the §3.3 predicates, never weaken.
- Materialize the replay set (Replay-Set Materialization section) from the final scan.

### Phase 5: Post-Replay Local Validation

From side repo (§4.3 canonical set; results appended to the baseline artifact as rows 05+):

- `bun test` — no worse than baseline row 02; net-new failures are hard-fail regressions. The two E2E-05 Constraint-10 compatibility tests must be among the passes.
- `bun run typecheck`.
- `bun run e2e/native-e2e.ts artifact-evidence --bundle /tmp/cc-bonsai-artifacts/claude-code/2.1.201/native/extracted.js --manifest /tmp/cc-bonsai-artifacts/claude-code/2.1.201/native/manifest.json --out /tmp/cc-bonsai-e2e/2.1.201-artifact-evidence.json` — must pass, now validating the new `docs/semantic-anchor-analysis-2.1.201.md` through the rebound `semanticReportPath`.
- `git status --short` — only planned target files modified/added.
- `jq -e 'length==8 and all(.[]; .anchor_id and .source_version=="2.1.200" and .target_version=="2.1.201" and .bucket and .replay_action and .mapping_type and (.target_paths|type=="array") and .rationale and .evidence_ref)' .agents/plans/validation/replay-set-22a0bd06958cd8d60cf4adfe48aa7b6ed08c962c.json`.
- `jq -e '[.[] | select(.bucket=="removed_or_ambiguous_anchor" or .bucket=="manual_review")] | length == 0' <same file>` — a non-empty result is the §1.5 hard block: STOP pending the reviewer+judge resolution recorded in Acceptance Criteria (`escalation-reason-code: input-approval-pending` if the cycle ends there).

### Phase 6: Live E2E Gate

From side repo. Credentials/sign-in per Phase 0; scenario-blocking preconditions produce per-scenario `BLOCKED` with reason codes.

- `"$TARGET_NATIVE_BINARY" --version | grep -F '2.1.201'` — re-asserted immediately before live validation (§3.6); stop on mismatch.
- `bun run apply --path "$TARGET_NATIVE_BINARY"` — the §3.6 runtime binding: explicit frozen install path, no discovery reliance.
- `"$TARGET_NATIVE_BINARY" mcp list` — confirm `context-bonsai` MCP registration is visible to the target binary.
- Execute the immutable scope E2E-00 … E2E-08 per `docs/e2e-protocol.md` (as updated in Phase 4 for 2.1.201 paths), all launches via `"$TARGET_NATIVE_BINARY"`, all seeding per the §3.6 discipline bound in the Immutable Live E2E Scope. Harness commands, argument shapes read from `bun run e2e/native-e2e.ts` usage output (never assumed):
  - `bun run e2e/native-e2e.ts protocol-a-oracle --session <session-jsonl> --secret <secret> --out /tmp/cc-bonsai-e2e/2.1.201-protocol-a-oracle.json` — the secret is one uncommon word chosen fresh, present in no versioned artifact.
  - E2E-08 direct-launch guard drive, with a fresh scratch project directory created immediately before the run: `E2E_SCRATCH=$(mktemp -d /tmp/cc-bonsai-e2e/scratch-XXXXXX)` then `bun run e2e/native-e2e.ts prune-guard-live --binary "$TARGET_NATIVE_BINARY" --cwd "$E2E_SCRATCH" --out /tmp/cc-bonsai-e2e/2.1.201-prune-guard-live.json`. **`--binary` and `--cwd` must never be omitted**: the harness falls back to a `~/.local/share/claude/versions/` default binary (a live-install-shaped path this cycle forbids as the test subject) and to the invoking directory as `cwd`. A new `mktemp -d` scratch directory is created for each run — never reused. `--prompt` stays at the harness default unless the scenario procedure says otherwise.
  - E2E-08 content-removal + footprint-drop oracle. Session copies live outside every repo, at absolute paths: `PRE=/tmp/cc-bonsai-e2e/2.1.201-e2e08-pre.jsonl`, `POST=/tmp/cc-bonsai-e2e/2.1.201-e2e08-post.jsonl` — `cp "$SESSION_FILE" "$PRE"` before the prune drive, `cp "$SESSION_FILE" "$POST"` after (never bare relative names: a `pre.jsonl` created in the side-repo cwd would land in the tracked tree and trip the Phase 5/7 status and change-scope gates). **Boundary-phrase binding**: `ALPHA-PHRASE-001`/`OMEGA-PHRASE-001` below are placeholders, not literals — before seeding, the executor picks two fresh phrases unique to this run (record them in the run evidence), seeds each per the §3.6 discipline (not on the first message; with the bare-"ok"/never-repeat instruction; the ALPHA-substitute seeded strictly before the OMEGA-substitute — the range collector walks the file in order from `--from-uuid` to `--to-uuid`), and substitutes its phrases for the placeholders consistently in every command of this block. This block's absolute paths supersede `docs/e2e-protocol.md`'s relative `pre.jsonl`/`post.jsonl` examples wherever the two differ. The range UUIDs are extracted from `$PRE` by those phrases, fail-closed on non-uniqueness (zero or multiple matches is a FAIL of the capture step — re-seed with genuinely unique phrases; never guess among candidates):

    ```bash
    # The `.uuid and` guard scopes matching to string-uuid rows: uuid-null metadata rows
    # (`queue-operation`, `last-prompt`) echo prompt text and would otherwise inflate a
    # genuinely-unique phrase's count.
    test "$(jq -r 'select(.uuid and (tostring | contains("ALPHA-PHRASE-001"))) | .uuid' "$PRE" | wc -l)" = "1"
    test "$(jq -r 'select(.uuid and (tostring | contains("OMEGA-PHRASE-001"))) | .uuid' "$PRE" | wc -l)" = "1"
    FROM_UUID=$(jq -r 'select(.uuid and (tostring | contains("ALPHA-PHRASE-001"))) | .uuid' "$PRE")
    TO_UUID=$(jq -r 'select(.uuid and (tostring | contains("OMEGA-PHRASE-001"))) | .uuid' "$PRE")
    bun run e2e/native-e2e.ts prune-effect --pre-session "$PRE" --session "$POST" --from-uuid "$FROM_UUID" --to-uuid "$TO_UUID" --out /tmp/cc-bonsai-e2e/2.1.201-prune-effect.json
    ```

    The `prune-effect` invocation runs from the side repo (it imports the harness); the session-copy and jq commands are cwd-independent because every path is absolute.
- Record every scenario in `docs/e2e-results-<DATE>-2.1.201.md`: verdict, reason code, command, exit code, explicit binary path, local artifact paths. Retry rule (fixed, all scenarios): a FAIL is recorded with its evidence, then either the identified defect is fixed (in plan scope, with the fix recorded) and the scenario re-run, or the cycle STOPs — silent re-runs hoping for a different outcome are forbidden. Protocol A keeps its stricter rule: failing on a clean build after prior validation passed is a §1.17 escalation (`structural-protocol-a-regression`), not a retry.
- Live-install protection re-probe: `claude --version` unchanged from Phase 0's recording; `ls ~/.local/share/claude/versions/` unchanged.

### Phase 7: Side-Repo Commit and Seal Gates

- Commit implementation + docs + staged validation artifacts to side-repo `main` (subject + body per repo commit rules; single reviewable concern per commit — harness/tests rebind, docs/evidence, staged artifacts may be separate commits).
- Seal-gate checks (mirroring §1.13, closed-artifact bindings), from side repo:
  1. `jq -e 'length==8' .agents/plans/validation/replay-set-22a0bd0….json` (every inventory anchor mapped; zero unmapped).
  2. The Phase 5 hard-block `jq` check passes (zero unresolved `manual_review`/`removed_or_ambiguous_anchor`), or the Acceptance-Criteria resolution is recorded with reviewer+judge citation.
  3. No late fixes: the relay-drift allowlist check (with the §3.5 byte-identity re-check) still passes against `SOURCE_HEAD_SHA` (implementation commits are this cycle's own; anything else STOPs per §1.9).
  4. Replay-set present and schema-valid (Phase 5 `jq`). Checksum: not required by this shape (§1.4 closed-artifact — the committed, diff-tracked file is the frozen input).
  5. Separate approval artifacts: none in this shape (§1.5).
  6. Baseline artifact complete (Phase 3 `jq` checks; no placeholders; provenance present).
  7. Replay verification per shape: `bun run apply --path "$TARGET_NATIVE_BINARY"` composes with sentinel verification against the frozen bundle (§3.5/§3.6; never identity-equality against source).
  8. Post-replay validation no worse than baseline; rows 02/03/04-equivalents green.
  9. Change-scope: `git diff --name-only 22a0bd06958cd8d60cf4adfe48aa7b6ed08c962c..HEAD` ⊆ (planned target files ∪ relay-drift allowlist paths). An out-of-scope path already landed without an exception recorded in this plan: STOP and revert (`escalation-reason-code: executor-scope-violation` if the cycle ends there).
  10. No unresolved exception records in this plan's validation sections.
  11. E2E gate: `docs/e2e-results-<DATE>-2.1.201.md` shows the full immutable scope PASS, or reviewer+judge-approved exceptions recorded here. A miss solely from credentials-`BLOCKED` scenarios is `escalation-reason-code: input-credentials-missing`; passed-gate evidence stands and the run resumes at this gate.
  12. Spec immutability, from parent: `test -f docs/agent-specs/forward-port-spec.md && test -z "$(git diff --name-only -- docs/agent-specs/forward-port-spec.md)"` (read-only check; runs from the parent checkout without modifying it).
  13. Reviewer and judge approvals recorded (Plan Approval section + any per-row citations).
  14. Release-gate ordering (§3.8) = Phase 8, in order, after Landing Authorization.

### Phase 8: Parent Landing (blocked until Landing Authorization)

**Landing Authorization (§1.8-style approval token)**: the invoker (relay chain) records authorization in this plan's Approval section — an owner-provenance go for the parent landing — before any command below runs. Machine-checkable precondition, from parent: `git status --short` shows at most ` M tweakcc_context_bonsai`.

In order:

1. From side repo: remove the staged copies and commit — `git rm .agents/plans/story-rebase-cycle-22a0bd0….md .agents/plans/validation/replay-set-22a0bd0….json .agents/plans/validation/baseline-22a0bd0….json .agents/plans/maintenance-report-22a0bd0….md` with a commit body citing the landing. (The parent copies become the durable record; side-repo `HEAD` after this commit is the pin target.)
2. From parent: copy the four artifacts into parent `.agents/plans/` and `.agents/plans/validation/` from a working copy taken before step 1 (`LAND_TMP=$(mktemp -d /tmp/cc-bonsai-landing-XXXXXX)`; `cp` the four files there first, then step 1, then copy from `$LAND_TMP`); `git add` them; update `docs/agent-specs/claude-code-context-bonsai-spec.md` only where it states stale target evidence; `git add tweakcc_context_bonsai` (pin at the step-1 tip); one commit (subject + body per repo commit rules).
3. Final verification — from side repo: `git log --oneline -5`; `git diff --name-status HEAD~1..HEAD`; `git status --short`. From parent: `git status --short`; `git diff --submodule=short HEAD~1..HEAD`; the spec-immutability check (gate 12).
4. The routine cycle ends here (§3.8): local pin advance plus final verification. Pushing the side repo and parent is a separate, owner-approved step — this shape has no proven publish ladder, and the executor must not invent one.

If the 2.1.200 cycle's own Phase-8 re-home has still not happened when this phase runs, its staged `f92dfac…` artifacts remain in the side repo's `.agents/plans/` — they are untouchable by this phase (only the four `22a0bd0…` artifacts move) and their presence is not a blocker.

### Phase 9: Routine Maintenance (§1.16 — mandatory after seal or STOP)

- Write `.agents/plans/maintenance-report-22a0bd06958cd8d60cf4adfe48aa7b6ed08c962c.md` (staged-for-parent): changed slot-level facts with evidence; failure-attribution verdicts (`SPEC-GAP`/`EXECUTOR-FAIL`) for every stumble; core/shape gaps flagged for the owner tier; on any run/cycle-ending STOP, exactly one `escalation-reason-code: <code>` line (§1.17 emission format — one line of that form in the whole document, prose mentions of other codes never in that line form).
- Pre-identified flags this cycle carries forward (record even if nothing new): (a) the per-version literal defaults in `e2e/native-e2e.ts`/`patches/discovery.test.ts` force a mechanical rebind every cycle — candidate for deriving from the manifest instead (flag only, owner-tier decision); (b) the installation-e2e instance for Claude Code remains unrecorded anywhere — flagged, not invented; (c) no bound live gauge driver for E2E-04 — the conditional exception recurs until one exists.
- **Disposition of the maintenance edit (§1.16 default applies this cycle — no pilot pause)**: in REAL-CYCLE mode, any Part 4 slot edit is left uncommitted in the parent working tree and the exact edited path is named in the final report for owner review; the executor never commits spec changes. In CALIBRATION mode the parent is untouchable — the report records proposed Part 4 diffs as text instead, and says so explicitly. When no slot-level fact changed, record that explicitly rather than skipping.

## Validation Commands

Grouped by working directory; the source of truth for implementation agents.

### Side repo (`/home/basil/projects/context-bonsai-agents/tweakcc_context_bonsai`)

- `git status --short`; `git rev-parse HEAD`; the relay-drift allowlist check + §3.5 byte-identity re-check (Frozen Inputs / Phase 0)
- `npm view @anthropic-ai/claude-code@2.1.201 version dist.tarball dist.integrity dist.shasum --json`
- `npm view @anthropic-ai/claude-code-linux-x64@2.1.201 version dist.tarball dist.integrity dist.shasum --json`
- `bun install`
- `bun test`
- `bun run typecheck`
- `bun run e2e/native-e2e.ts artifact-evidence --bundle /tmp/cc-bonsai-artifacts/claude-code/2.1.201/native/extracted.js --manifest /tmp/cc-bonsai-artifacts/claude-code/2.1.201/native/manifest.json --out /tmp/cc-bonsai-e2e/2.1.201-artifact-evidence.json`
- the Phase 4 drift-scan block; the Phase 3/Phase 5 `jq` structural checks
- `"$TARGET_NATIVE_BINARY" --version | grep -F '2.1.201'`; `bun run apply --path "$TARGET_NATIVE_BINARY"`; `"$TARGET_NATIVE_BINARY" mcp list`; the Phase 6 harness commands

### Parent (`/home/basil/projects/context-bonsai-agents`) — read-only until Phase 8

- `test -f docs/agent-specs/forward-port-spec.md && test -z "$(git diff --name-only -- docs/agent-specs/forward-port-spec.md)"`
- Phase 8 only: `git status --short`; `git diff --submodule=short HEAD~1..HEAD`

## E2E Gate

- Authoritative procedure: `docs/e2e-protocol.md` (this repo; updated for 2.1.201 in Phase 4, never narrowed) with `docs/context-bonsai-e2e-template.md#protocol-a-secret-prune-oracle` (parent) as the shared oracle reference.
- Required scenarios: the Immutable Live E2E Scope above (E2E-00 … E2E-08 + pinned-target artifact evidence) — this cycle may not narrow it.
- Runtime under test: `TARGET_NATIVE_BINARY`, always by explicit path. The live `claude` shim is never the test subject.
- Evidence: local under `/tmp/cc-bonsai-e2e/`; committed summary `docs/e2e-results-<DATE>-2.1.201.md`. Verdicts come from session/export/oracle evidence (content genuinely absent, measured footprint drop, restoration visible), never model assertions or green typechecks alone.
- Credentials: operator-provisioned sign-in, out of band, never persisted or logged; missing preconditions → per-scenario `BLOCKED` with reason codes; unapproved `BLOCKED` blocks the seal (gate 11).

## Worktree Artifact Check

- Checked At: 2026-07-05 (generation; the executor re-runs the Phase 4 check immediately before its first edit).
- Side-repo planned target files: all tracked and clean at `22a0bd06958cd8d60cf4adfe48aa7b6ed08c962c` (`git status --short` empty at generation). New files (`docs/semantic-anchor-analysis-2.1.201.md`, `docs/e2e-results-<DATE>-2.1.201.md`, the validation JSONs, the maintenance report) verified non-existent at generation — no `tracked-dirty` or `existing-untracked` overlap.
- This plan file itself: created at generation in side-repo staging; no collision (no prior `story-rebase-cycle-22a0bd0…` artifact existed in the side repo or parent `.agents/plans/`).
- The 2.1.200 cycle's staged artifacts exist in the same `.agents/plans/` tree by design (their Phase 8 is parked, owner-gated); different filenames, zero overlap with this cycle's artifact names.
- Parent planned targets: untouched until Phase 8; parent dirt profile at generation is the enumerated pin only.
- `/tmp` artifacts: created at generation with recorded checksums; Phase 2 re-verifies rather than recreating.
- Overlaps Found: none. Escalation Status: none.
- Decision Citation: HAND_OFF next-unit instruction (relay chain, owner-provenance direction 2026-07-05) — generate the 2.1.201 cycle plan on the Fable tier through the full §1.15 loop; the live-install protection constraint carries forward from the 2026-07-03 owner direction.

## Plan Approval and Commit Status

- Approval Status: approved — the §1.15 loop closed early at iteration 2 with zero blocking findings on both review passes (see Validation Loop Results); the closed-artifact transform-application rehearsal ran green at generation.
- Approval Citation: Validation Loop Results below — iteration 1 (missing-details: two blocking findings; ambiguity: two blocking findings; all four fixed), iteration 2 (both passes zero blocking; fixes re-verified), transform-application rehearsal (§1.15) green in a disposable scratch clone at `SOURCE_HEAD_SHA` for both the unmodified source and the planned-rebind states. Judge authority: the executed 2.1.200 precedent's recorded tiering decision (`docs/meta-loop-direction.md`, owner direction) places plan generation and validation on the Fable tier with the spec's own reviewer gates; hard-block rows, exceptions, and the Landing Authorization still require their per-event reviewer+judge citations at execution time.
- Plan Commit Hash: the commit introducing this plan on side-repo `main`, made by the generating session immediately after this validation loop closed (a file cannot contain its own hash). The executor verifies it with `git log --format='%H %s' --diff-filter=A -- .agents/plans/story-rebase-cycle-22a0bd06958cd8d60cf4adfe48aa7b6ed08c962c.md` — exactly one commit must be returned. Empty output means the plan-approval gate never closed: STOP; execution is blocked per §1.14.11, and the executor never commits the plan itself. More than one commit is likewise a STOP (the plan file was removed and re-added at some point — that history needs invoker review before execution).
- Ready-for-Orchestration: yes for Phases 0–7 (calibration and the real cycle); Phase 8 additionally requires the Landing Authorization below.
- **Landing Authorization**: GRANTED 2026-07-05 under the owner's standing order (verbatim via showrunner relay, same day): "Landing Authorizations are ABOLISHED as an owner gate. Local landings (Phase 8 and equivalents — commits to local repos, artifact re-home, spec cleanup) are in-scope routine work: execute them without asking, every cycle, now and in the future." Recorded by the relay chain against the sealed side-repo tip `7d0389a` (seal gates 1–13 green, observer-verified). Outward actions (push, publish) remain owner-gated — the standing order changes nothing about Phase 8 step 4's boundary.

## Validation Loop Results

- Iteration 0 (generation): sources — parent `docs/agent-specs/forward-port-spec.md` (Parts 1, 3, §4.3, including the 2026-07-05 extensions: §1.15 transform-application rehearsal, §1.17 reason-code registry and emission format, §1.18 run continuity, §3.5 bookkeeping allowlist + byte-identity re-check, §3.6 seeding discipline, §4.3 frozen-binary route), parent `docs/agent-specs/claude-code-context-bonsai-spec.md`, the executed 2.1.200 plan + replay-set/baseline artifacts + maintenance report (structure, buckets, bound verdict paths, amendments), side-repo sources (`patches/anchors.ts`, `patches/discovery.ts`, `e2e/native-e2e.ts` incl. `validateSemanticReport` and the stale-site lines, `docs/e2e-protocol.md`, `docs/semantic-anchor-analysis-2.1.200.md`). Generation executed the freeze for real: npm identities captured (dist-tags recorded), the platform tarball downloaded and digest-verified (sha1 + sha256), the binary version-asserted, the bundle extracted via tweakcc 4.0.13 and checksummed, the manifest written, all eight anchor selectors probed against the real 2.1.201 bundle (zero drift; the table records live results, not predictions), and the full artifact-evidence composition run green with all three sentinels. The live install was never touched.
- Transform-application rehearsal (§1.15, closed-artifact — first cycle bound to it): run at generation in a disposable scratch clone of the side repo at `SOURCE_HEAD_SHA` (never the real working tree). Zero plan-bound `updated_anchor` re-derivations exist to realize, so the rehearsal exercised the two states the plan binds: (1) unmodified source (the Phase-3 baseline equivalence): `bun install`, `bun test`, `bun run typecheck`, and the artifact-evidence command against the frozen 2.1.201 bundle/manifest — all green, confirming baseline row 04's must-be-green designation; (2) planned-rebind state (the Phase-4/5 equivalence): the enumerated stale sites version-bumped in place, a rehearsal copy of the 2.1.201 semantic doc written from the real scan values, then `bun test`, `bun run typecheck`, and artifact-evidence (now validating the 2.1.201 doc via the rebound `semanticReportPath`) — all green. The §1.15 wrong-reason trap did not arise (the semantic-report gate had a valid doc in both states). Scratch clone removed after evidence capture. Rehearsal evidence: recorded in this section; the rehearsal semantic doc was disposable and is not the executor's doc (the executor writes its own from its own scan, per Phase 4).
- Iteration 1 missing-details review (independent reviewer, repository-inspecting, Opus tier): **zero blocking findings.** Verified against reality: every frozen literal (both npm identities via live `npm view`, binary/bundle sha256 on disk, manifest fields), every enumerated stale-site line, a repo-wide grep confirming no unenumerated 2.1.200 binding site (the `patches/anchors.ts` comment hits and the 2.1.156 test title correctly designated historical), the Phase-4 drift-scan block re-run reproducing the generation table exactly, all `jq` commands parsing with the stated semantics, both E2E-05 Constraint-10 tests present at `SOURCE_HEAD_SHA` (landed by `2c1c6fd`, `mcp-server/index.test.ts` E2E-05 describe block), README/DEVELOPMENT clean of stale targets, the `validateSemanticReport` contract matching source, all eight cited §1.17 reason codes present in the registry, toolchain present, parent spec git-clean. Non-blocking observations: the plan file is untracked until the approval commit (by design — Phase 0's STOP is the gate working); the manifest's extra `tarballSha256` field is unasserted and harmless.
- Iteration 1 ambiguity review (independent reviewer, repository-inspecting, Opus tier): **six blocking findings, all fixed in-iteration**: (B1) `PLAN_COMMIT` was consumed but never bound as a command, and the Plan Approval verification command's hash+subject output would corrupt a naive capture — fixed by binding a three-command block (`git log -1 --format='%H' --diff-filter=A …`, non-empty test, `git diff --quiet`) in Phase 0, with the resume-branch replay-set variant. (B2) the E2E-08 `ALPHA-PHRASE-001`/`OMEGA-PHRASE-001` tokens read as either literals or placeholders — fixed with an explicit placeholder rule: pick fresh run-unique phrases, record them, seed per §3.6, substitute consistently in every command of the block. (B3) E2E-04 compensating condition (b) had no bound command — fixed with the exact `-p "Reply with exactly: PONG" --output-format json` command and a `jq -e '.modelUsage | …'` predicate matching the 2.1.200 evidence shape. (B4) `pre.jsonl`/`post.jsonl` were bare relative names that could land in the tracked tree and trip the status/change-scope gates — fixed with absolute `/tmp/cc-bonsai-e2e/2.1.201-e2e08-{pre,post}.jsonl` paths and a cwd note. (B5) scan-divergence handling stated both STOP-and-record and classify-per-§3.3 with no selector, and the STOP had no valid reason code — fixed with a single decidable rule: checksum re-verify first; mismatch → `executor-artifact-integrity`; match → classify from the real scan, hard-block route ending (if unresolved) in `input-approval-pending` per gate 2. (B6) no rule for a launch context that omits the intent-log path — fixed with a STOP-and-request symmetric to the mode-missing rule. Non-blocking findings fixed: rerun-safety made checksum-decidable with an explicit skip-the-download-block rule (the generation-time tarball staging path need not exist); extraction cwd bound to the side-repo root; the two `~/.local/share/claude/versions/` protocol-doc lines marked illustrative; E2E-00 predicate (b) bound to a `grep -i` command. Non-blocking accepted as-is: E2E-01/02/03/06 conversation driving remains unscripted beyond `docs/e2e-protocol.md` (the executed precedent's three calibration runs and REAL-CYCLE drove them successfully from the protocol alone; same shape, same latitude).
- Iteration 2 ambiguity review (fresh independent reviewer, repository-inspecting, Opus tier; iteration-1 missing-details already returned zero blocking): **zero blocking findings — loop closed early per §1.15.** The reviewer independently re-verified every consumed shell variable bound, the harness default-substitution guards (`--binary`/`--cwd`, `--bundle`/`--manifest`) against `parseArgs` source, the stale-site enumeration, the semantic-doc format contract against `validateSemanticReport`, the E2E-04 `jq` predicate satisfiable against the 2.1.200 precedent evidence, the frozen `/tmp` state, and the decidability of the scan-divergence rule, the seal-gate reason-code assignments, and the E2E-08 uniqueness guards. Five non-blocking observations; four folded as one-clause tighteners (ALPHA-before-OMEGA seeding order; the Phase-6 absolute-path block explicitly supersedes the protocol doc's relative `pre.jsonl` examples; the intent-log-path STOP marked in-run/no-code like the mode-missing rule; the rerun-safety fourth case — binary green, bundle missing/mismatched → full block). One accepted as-is: E2E-04's compensating command runs from an unbound scratch directory — immaterial, its output path is absolute and nothing touches the tracked tree. No finding recurred across iterations.

## Completion Checklist

- [ ] Plan validation loop closed; plan committed to side-repo `main` (staged-for-parent).
- [ ] Freeze re-verified: both npm identities, tarball digests, binary sha256, bundle sha256, manifest fields.
- [ ] Baseline artifact complete: rows 01–04, no placeholders, all four rows green (row 04 must-be-green this cycle).
- [ ] Drift scan reproduced exactly; replay-set staged with 8 schema-valid rows, all `unchanged_anchor` (or execution's divergence recorded and resolved per §3.3/§1.5); zero unresolved hard-blocking rows.
- [ ] `docs/semantic-anchor-analysis-2.1.201.md` complete for all 8 anchors per the bound format contract.
- [ ] Behavioral Constraints 1–10 preserved with regression evidence.
- [ ] Post-replay validation green; artifact-evidence passes against the frozen bundle with the rebound semantic report.
- [ ] Live e2e immutable scope recorded with verdicts and reason codes; no unapproved BLOCKED/omission; live install untouched (version probe unchanged).
- [ ] Side-repo commits landed; seal gates 1–13 pass.
- [ ] Phase 8 executed only after Landing Authorization; parent commit = landed artifacts + stale-evidence spec lines + pin; final verification green.
- [ ] §1.16 maintenance report staged with the three carried flags, any new verdicts, and (on any ending STOP) exactly one `escalation-reason-code:` line.
