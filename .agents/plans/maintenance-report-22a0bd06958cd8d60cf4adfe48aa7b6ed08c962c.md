# Maintenance Report — Forward-Port Cycle 22a0bd0… → 2.1.201

- Cycle: forward-port Claude Code Context Bonsai from `SOURCE_HEAD_SHA=22a0bd06958cd8d60cf4adfe48aa7b6ed08c962c` onto `@anthropic-ai/claude-code@2.1.201`.
- Mode: REAL-CYCLE, Opus-4.8-low executor. Landing Authorization ABSENT — Phases 0–7 and 9 executed; Phase 8 (parent landing) not run.
- Outcome: SEALED at the side-repo level (all seal gates 1–13 pass; gate 14 = Phase 8 deferred pending Landing Authorization).

## Changed Slot-Level Facts (with evidence)

- **Anchor registry (`patches/anchors.ts`, `patches/discovery.ts`): zero drift.** The Phase-4 drift scan reproduced the generation table exactly against the frozen bundle sha256 `9f9519b0c93914bd2fda5e6cdc7a74df2b7121909f783fb3b1cc9c86771708ef`: offsets `11749484`/`11690188`/`7663462`/`7776924`/`14376442`, scores `105`/`110`/`62`/`50`/`40`, candidate counts `1`/`24`/`9`/`17`/`1`, helpers `Xt`/`rr`/`Dt`. Every offset shifted uniformly +23 bytes (bundle `18698041`→`18698064`); all identifiers unchanged. No selector, scorer, or threshold edit was required or made. All 8 replay-set rows classify `unchanged_anchor` / `verify-unchanged` / `1:1`.
- **Frozen identity held.** Both npm identities (wrapper + platform), tarball sha1/sha512, binary sha256 `a34809a6…`, extracted-bundle sha256, and manifest fields re-verified against Frozen Inputs literals; `--version` = `2.1.201 (Claude Code)`.
- **Harness/docs rebind.** The enumerated stale 2.1.200 sites were version-bumped in place (path shapes preserved) in `e2e/native-e2e.ts`, `patches/discovery.test.ts`, `mcp-server/index.test.ts`, `docs/e2e-protocol.md`. Historical mentions (the `2.1.156` test title, `patches/anchors.ts` provenance comments) left unchanged. No residual `2.1.200` binding remained in the edited files.
- **Behavioral Constraints 1–10 preserved.** `bun test` green pre- and post-replay (165 tests, 0 fail); the named regression suites (marker coverage incl. system rows, retrieve marker removal, provider-map `api_system` filter, guard/`isError`/wrapper-filter/searchable-text, the two Constraint-10 compatibility tests) all pass. No change to `mcp-server/index.ts` or `src/**` was needed.

## Failure-Attribution Verdicts (stumbles)

1. **E2E-02 model pre-empted the tool call — `EXECUTOR-FAIL` (recovered, not a system defect).** On the first ambiguity drive the model reasoned about the ambiguity itself and declined to invoke `context-bonsai-prune`, so the deterministic tool-side error was not surfaced. Root cause: the drive prompt left the model latitude to refuse. Fix (in-scope drive adjustment, recorded in the intent log): re-drove with an explicit instruction to invoke the tool regardless and paste its verbatim output; the tool then returned `from_pattern matched multiple messages. Provide a more specific pattern.` with zero mutation. Not a retry-for-different-luck — the instruction changed. No product-code implication.
2. **E2E-06 re-prune in the polluted main session correctly refused — no defect.** After the main session's E2E-03 retrieve restored the range AND echoed it in the retrieve tool-output block, the boundary phrases appeared 6× each, so a re-prune by the same phrase was genuinely ambiguous and the system correctly declined (fail-closed, no `isError` misuse). This is expected behavior; E2E-06 was instead driven cleanly in a fresh session (5 archived rows stable across `--resume`). Verdict: `SPEC-GAP`-adjacent note only — the e2e sequencing (retrieve-before-reprune in one session) is an executor sequencing artifact, not a product issue; the protocol does not bind reprune-after-retrieve in-session.

No other stumbles. No STOP occurred. No `escalation-reason-code` line is emitted (the run sealed without a run/cycle-ending STOP).

## Carried Flags (owner-tier decisions)

- (a) **Per-version literal defaults force a mechanical rebind every cycle.** `e2e/native-e2e.ts` (`defaultBundlePath`/`defaultManifestPath`/`semanticReportPath`/`defaultNativeBinary()`/version fallbacks) and `patches/discovery.test.ts` fixture paths hardcode the target version. Candidate for deriving from the manifest instead. Flag only — owner-tier decision; this cycle performed the mechanical bump as bound.
- (b) **The installation-e2e instance for Claude Code remains unrecorded anywhere.** E2E-00 is verdicted locally by its bound predicate rather than via a fresh-sprite install run; no canonical installation-e2e record exists. Flagged, not invented.
- (c) **No bound live gauge driver for E2E-04.** Live gauge cadence/severity rendering has never been driven; the conditional exception (compensating evidence via `apply` sentinels + `modelUsage` record) recurs until a driver exists. Both compensating conditions were satisfied this cycle.

## Disposition of the Maintenance Edit (§1.16, REAL-CYCLE default)

No Part-4 slot-level fact changed this cycle: the forward port was zero-drift, no selector/scorer/threshold edit, no new bucket, no Behavioral-Constraint change. Therefore no parent spec (Part 4) slot edit was authored, and the parent working tree was not touched (correct for REAL-CYCLE with Landing Authorization absent). Recorded explicitly per the §1.16 "no slot-level fact changed" rule.
