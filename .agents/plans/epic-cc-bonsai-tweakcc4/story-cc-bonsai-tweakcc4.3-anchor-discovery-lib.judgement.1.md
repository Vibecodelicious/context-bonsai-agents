## Judge's Assessment

**Story**: 3 - Resilient anchor-discovery library
**Iteration**: 1 of 5 maximum
**Date**: 2026-05-17

---

### Summary

| Verdict | Count |
|---------|-------|
| APPROVED (must fix) | 2 |
| APPROVED (should fix) | 0 |
| REJECTED (over-engineering) | 0 |
| REJECTED (out of scope) | 0 |
| REJECTED (not valid) | 0 |

### Verified Validation Results

- **Starting commit:** `34627f9910266500ba261887925ade1ad0ac5633` (reviewer-verified)
- **Pre-existing failures (reviewer-reproduced):** `cd tweakcc_context_bonsai && bun run typecheck`: `TS2307`, `TS7006`, `TS18048`, `TS2339`, `TS2322`, `TS2345`; `cd tweakcc_context_bonsai && bun test patches/discovery.test.ts`: no matching test files at baseline
- **HEAD results:** 1 pass / 1 fail
- **Regressions:** none
- **Regression gate:** clear

---

### Overall Verdict

**NEEDS REVISION**

The review identifies two acceptance-criteria gaps in Story 3. Neither requested fix is broad or over-engineered: one requires making the required real-bundle ambiguity evidence mandatory and durable, and the other is a one-operator boundary fix plus a regression test.

---

### Finding-by-Finding Evaluation

#### [C1] Real-bundle 133-candidate disambiguation acceptance criterion is not actually validated
- **Reviewer's Issue**: AC 5 requires discovery scoring to be demonstrated against real extracted Claude Code JS, selecting exactly one visibility-predicate candidate from the observed 133 `switch(X.type)` sites, but the committed test skips unless `CB_CLAUDE_EXTRACT_JS` is set and no committed artifact or required validation evidence proves the assertion ran.
- **Verdict**: APPROVED
- **Reasoning**: This is valid and in scope. The epic identifies the 133 `switch(X.type)` sites as the central Story 3 risk, and Story 3 AC 5 explicitly requires the real extracted JS demonstration. An optional skip is acceptable for developer convenience only if the story also records mandatory successful evidence from the real extract; the submitted validation instead shows the high-risk assertion was skipped.
- **If Approved**: Add durable mandatory evidence for the real extracted JS run. Prefer a committed validation artifact or report generated from the real extract that records the extract source/version, total `switch(X.type)` candidate count of 133, selected candidate evidence, and the exact command/environment used. If a fixture is added instead, it must be clearly derived from the observed real-bundle ambiguity shape and preserve the 133-candidate disambiguation behavior; do not replace the real-extract evidence with a purely synthetic three-candidate unit fixture. Keep the optional local test skip if useful, but the story completion evidence must no longer rely on an unrun optional path.

#### [H1] `selectUnique` accepts candidates exactly at the ambiguity margin
- **Reviewer's Issue**: Contract B says `AnchorAmbiguousError` is thrown when the top two candidates are within `minMargin`, but `selectUnique` only throws for `best.score - second.score < opts.minMargin`, allowing an exact-margin tie boundary through.
- **Verdict**: APPROVED
- **Reasoning**: This is valid and in scope. The story requires the `minMargin` disambiguation rule as a fail-closed guard, and accepting a candidate exactly at the configured ambiguity boundary is a small fail-open edge case. The fix is proportionate and localized.
- **If Approved**: Change the comparison to treat the exact margin as ambiguous, e.g. `best.score - second.score <= opts.minMargin`, and add a unit test where scores differ by exactly `minMargin` and `selectUnique` throws `AnchorAmbiguousError`.

---

### Loop/Conflict Detection

**Previous Iterations**: 0
**Recurring Issues**: none
**Conflicts Detected**: none
**Assessment**: First review cycle. The approved fixes are specific acceptance-criteria corrections, not evidence of a review loop.

---

### Recommendations

**If NEEDS REVISION:**
The developer should address these approved items:
1. Provide mandatory, durable evidence that the real extracted Claude Code JS 133-candidate visibility-switch disambiguation ran successfully, while keeping tests independent of ephemeral `/tmp` paths.
2. Make `selectUnique` fail closed at the exact `minMargin` boundary and add a regression test for that boundary.

Focus ONLY on approved items. Rejected items should NOT be addressed.

---

### Complexity Guard Notes

- No findings were rejected for over-engineering.
- The real-bundle evidence fix should stay narrow: do not build a new extraction framework or broaden Story 3 into harness behavior beyond recording or exercising the required AC 5 validation.
