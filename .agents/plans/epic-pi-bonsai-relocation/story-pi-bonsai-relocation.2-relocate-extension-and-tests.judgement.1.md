# Judge's Assessment

**Story**: pi-bonsai-relocation.2 - Relocate the extension source and tests to the side repo
**Iteration**: 1 of 5 maximum
**Date**: 2026-05-18

---

## Summary

| Verdict | Count |
|---------|-------|
| APPROVED (must fix) | 0 |
| APPROVED (should fix) | 0 |
| REJECTED (over-engineering) | 0 |
| REJECTED (out of scope) | 0 |
| REJECTED (not valid) | 0 |

### Verified Validation Results

- **Starting commit:** `72b71cb` (last commit before this story; reviewer-verified)
- **Pre-existing failures (reviewer-reproduced):** none
- **HEAD results:** 3 / 0 (`npm install`, `npm run typecheck`, `npm test` — all pass; `npm test` = 97/97)
- **Regressions:** none
- **Regression gate:** clear

---

## Overall Verdict

**APPROVED AS-IS**

The reviewer reported zero issues. I independently re-verified every acceptance
criterion and each of the four areas flagged for special attention; all hold up.
The relocation is faithful, the `tsconfig.json` change is a correct match-to-upstream,
the flake fix is deterministic without weakening assertions, and the pi-mono fork
is untouched. The implementation meets the story in full.

---

## Independent Verification Performed

### AC1 / AC2 / AC3 — Faithful relocation
- `diff -rq pi/packages/context-bonsai/src/ pi_context_bonsai/src/` — byte-identical, no output.
- `diff -rq` for `docs/` — byte-identical.
- `diff -rq` for `test/` — identical except `Only in pi_context_bonsai/test/: integration` (the intended Story 1 addition).

### AC4 — Seven integration tests + SDK harness
- All eight files present under `test/integration/` (01, 02, 02b, 02c, 03, 03b, 04 + `sdk-harness.ts`).
- File-by-file diff against `pi/packages/coding-agent/test/suite/context-bonsai/`: the only
  differences are (a) the bonsai factory import rewritten from `../../../../context-bonsai/src/index.js`
  to `../../src/index.js` — required by the move — and (b) the flake fix in `02-prune`, `03-retrieve`,
  and `sdk-harness.ts`. No other content drift.

### AC5 — package.json
- `@mariozechner/pi-coding-agent` and `@mariozechner/pi-agent-core` are dependencies at `0.69.0`.
- `@mariozechner/pi-ai` is a devDependency at `0.69.0`.
- `typebox` retained; `typecheck` script retained; `test:watch` retained; `pi.extensions` retained;
  `private: true` retained. `test` runs unit + integration; `test:integration` added.

### AC6 — tsconfig / vitest
- `tsconfig.json` is self-contained — no `extends`. `vitest.config.ts` carries no in-tree aliases.

### AC7 — `.gitkeep` removal
- `git ls-files | grep gitkeep` returns nothing — all three removed.

### AC8 — Standalone validation
- `npm install` clean; `npm run typecheck` clean; `npm test` 97/97 pass. Working tree clean after install.

### AC9 — pi-mono fork unmodified
- `git -C pi cat-file -t 7de0b23` and `4bc4d3a` both return `fatal: Not a valid object name` —
  the Story 2 commits do not exist in the `pi` submodule.
- Note: the parent repo shows the `pi` submodule pointer at `2d953af-dirty` with a modified
  `package-lock.json`. That pointer (`4d4d092 → 2d953af`) and lockfile state are **Story 1's**
  harness rebuild, not Story 2's. Outside this story's scope; not a finding against Story 2.

### Special-attention area (b) — `noUncheckedIndexedAccess` removal
The relocation commit removes `noUncheckedIndexedAccess: true` from the scaffold's `tsconfig.json`.
Verified this is a legitimate match-to-upstream, not strictness masking real errors:
- `pi/tsconfig.base.json` sets `strict: true` but does NOT set `noUncheckedIndexedAccess`
  (it is not implied by `strict`).
- The in-tree `pi/packages/context-bonsai/tsconfig.json` adds only `noEmit: true` on top of the base.
- Therefore the extension source was always authored and typechecked WITHOUT that flag. The scaffold
  had introduced it; removing it restores the configuration the code targets.
- Independent confirmation: re-running `tsc --noEmit --noUncheckedIndexedAccess` produces 90
  `TS18048`/`TS2532` diagnostics — all indexed-access-without-explicit-undefined-guard patterns,
  consistent with code authored against the looser config. With the story's config, typecheck is clean.

### Special-attention area (c) — flake fix in `4bc4d3a`
- `getApiProvider`, `registerApiProvider`, `registerFauxProvider` confirmed as real ESM exports of
  `@mariozechner/pi-ai` (verified at runtime).
- `reloadSession()` calls the real `session.reload()` unchanged — the extension `session_start`
  hydrate path still executes. The helper only restores the faux *api provider* (test scaffolding)
  that `reload()`'s `resetApiProviders()` wipes. No reload-driven assertion is weakened; the prune
  and retrieve tests still assert placeholder/tombstone persistence across reload.
- Determinism confirmed: I ran the integration suite 8 consecutive times — 9/9 passing every run.

### Special-attention area (d) — pi-mono fork unmodified
Covered under AC9 above — confirmed via `git cat-file`.

---

## Finding-by-Finding Evaluation

The reviewer reported no findings. After independent verification I concur — there are no
issues to evaluate. The zero-issue review is accurate.

---

## Loop/Conflict Detection

**Previous Iterations**: 0 (this is iteration 1)
**Recurring Issues**: none
**Conflicts Detected**: none
**Assessment**: First iteration; no loop concerns.

---

## Recommendations

**APPROVED AS-IS.** The implementation meets every acceptance criterion. The relocation is
byte-faithful, the dependency rework matches the Design Implications, the `tsconfig.json`
adjustment correctly matches the upstream configuration the code was authored against, and the
flake fix makes the integration suite deterministic (verified 8/8 standalone runs) without
weakening any assertion. The pi-mono fork carries no Story 2 footprint. No revision is required.

---

## Complexity Guard Notes

No suggestions were rejected — the reviewer proposed none and I found no issues warranting a fix.
The flake fix itself is appropriately scoped: a single test-harness helper with a doc comment, not
an elaborate abstraction. No over-engineering observed.
