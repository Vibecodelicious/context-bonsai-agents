# Maintenance report — Hermes Context Bonsai forward-port cycle (pressure test)

Plan: `.agents/plans/story-rebase-cycle-39c6bac3f1c3226b415347881b27245df3c4a500.md`
Mode: CALIBRATION / `uncommitted-pressure-test` (§1.11). Executor: below owner tier (§1.18 in full).
Run: cal-run-2. Intent log: `/tmp/hermes-bonsai-e2e-logs/cal-run-2/intent.log`. Log dir: `/tmp/hermes-bonsai-e2e-logs/cal-run-2/`.
Frozen inputs: `SOURCE_HEAD_SHA=39c6bac3f1c3226b415347881b27245df3c4a500`; target tag `v2026.7.1`, peeled SHA `7c1a029553d87c43ecff8a3821336bc95872213b`.

## Result: SEAL (no STOP)

All bound phases (0–9) completed. No §1.17 reason code raised. Every applicable seal gate passed with the pressure-test realizations the plan states. Nothing committed to the side repo; nothing pushed.

## Per-phase outcomes

| Phase | Outcome | Evidence |
|---|---|---|
| 0 — rig preflight | PASS | `ollama list` shows `qwen25-6k` (present; no provision needed) |
| 1 — bootstrap + frozen-identity | PASS | toolchain (git/uv/uvx/sqlite3) all succeed; side HEAD = `39c6bac…`; clone HEAD = peeled SHA `7c1a029…`; `.venv` present |
| 2 — workspace preflight | PASS | side repo clean; parent status = exact Phase 2 enumeration; plan + replay-set already tracked |
| 3 — baseline capture | PASS | b01 hydration PASS; b02 pytest 91 passed; b03 ruff clean; b04 seed doc `present-as-expected` |
| 4 — replay | PASS (null edit set) | zero `updated_anchor` rows; no side-repo edits applied |
| 5 — post-replay validation | PASS | p02 pytest 91 passed; p03 ruff clean; p05 run-scenarios 8/8 ALL ROWS PASS; side repo status empty |
| 6 — e2e gate | PASS | 8-row matrix PASS (carried from p05); e01 Protocol A live drive `DRIVE PASS` — 5 host-state verdicts PASS |
| 7 — final verification | PASS | side HEAD unmoved; side clean; parent status = Phase 2 enum + own baseline artifact; spec untouched; detector exit 0 `up-to-date` |
| 8 — maintenance + final report | PASS | this document |
| 9 — scratch removal | PASS | scratch + artifact clone removed (see below) |

## Acceptance criteria (§6)

1. Baseline + post-replay canonical validation green: pytest 91, ruff clean, run-scenarios 8/8. ✓
2. E2E gate: 8-row matrix PASS + live Protocol A oracle PASS. ✓
3. Detector reports `up-to-date` (exit 0). ✓
4. Side repo clean, HEAD unmoved at `SOURCE_HEAD_SHA`. ✓
5. Zero unresolved exception records; spec untouched. ✓

## Artifacts (left uncommitted for the invoker)

- `.agents/plans/validation/baseline-39c6bac3f1c3226b415347881b27245df3c4a500.json` — baseline + post-replay + e2e rows (b01–b04, p02, p03, p05, e01), all `result: PASS`.
- Captured logs under `/tmp/hermes-bonsai-e2e-logs/cal-run-2/` (`<row_id>.log`).

## §1.16 maintenance record — SPEC-GAP vs EXECUTOR-FAIL

No stumbles requiring adjudication. Execution followed the plan verbatim; every gate passed on first attempt. No Part 4 slot-fact changed. **Nothing changed** in the spec, the slot table, or any binding document during this run — recorded explicitly per Phase 8.

One benign presentation choice worth noting (not a stumble, no verdict owed): the run-scenarios post-replay row was assigned id `p05` (not `p04`) because it has no baseline mirror — b04 is the seed-doc probe, and the plan reserves `p`→`b` mirroring for re-run rows (p02↔b02, p03↔b03). Its log is `p05.log`, consistent with the plan's `<row_id>.log` binding.

## Phase 9 disposition

`$HERMES_BONSAI_SCRATCH_ROOT` (`/tmp/hermes-bonsai-scratch-cycle`) and `/tmp/hermes-bonsai-artifacts/hermes-agent/2026.7.1` removed after this document was written on disk. Intent log and run log dir left for the invoker to sweep after review.
