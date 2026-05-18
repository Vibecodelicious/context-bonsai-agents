## Judge's Assessment

**Story**: 3 - Resilient anchor-discovery library
**Iteration**: 2 of 5 maximum
**Date**: 2026-05-17

---

### Summary

| Verdict | Count |
|---------|-------|
| APPROVED (must fix) | 1 |
| APPROVED (should fix) | 0 |
| REJECTED (over-engineering) | 0 |
| REJECTED (out of scope) | 0 |
| REJECTED (not valid) | 0 |

### Verified Validation Results

- **Starting commit:** top-level `58e6b15fbd1028654933d4b774b03bae2380bfdb` pointing nested repo to `e9fe02364f75c4f3421b3120e9f9cedd05b3da06` (reviewer-verified)
- **Pre-existing failures (reviewer-reproduced):** `cd tweakcc_context_bonsai && bun run typecheck`: `TS2307`, `TS7006`, `TS18048`, `TS2339`, `TS2322`, `TS2345`; `cd tweakcc_context_bonsai && bun test patches/discovery.test.ts`: none
- **HEAD results:** 1 pass / 1 fail
- **Regressions:** none
- **Regression gate:** clear

---

### Overall Verdict

**NEEDS REVISION**

The exact-margin ambiguity defect from iteration 1 is fixed. The remaining C1 is still valid because Story 3 AC 5 requires durable evidence that discovery scoring selected one visibility-predicate candidate from the real extracted Claude Code JS with 133 `switch(X.type)` candidates, and the current revision still only makes the real-extract path optional while adding a synthetic count-preserving fixture.

---

### Finding-by-Finding Evaluation

#### [C1] Real-bundle 133-candidate evidence is still not durable or mandatory
- **Reviewer's Issue**: The new committed fixture exercises 133 `switch(<id>.type)` candidates, but the real extracted Claude Code bundle validation still skips when `CB_CLAUDE_EXTRACT_JS` is unset, and the fixture does not record source/version, command/environment, total real candidate count, or selected-candidate evidence from the observed bundle.
- **Verdict**: APPROVED
- **Reasoning**: This is valid, in scope, and proportionate. AC 5 explicitly says discovery scoring must be demonstrated against the real extracted JS, and the epic identifies the 133 `switch(X.type)` sites in the extracted Claude Code bundle as the central risk for this story. The fixture is useful as a committed regression guard, but its header describes it as representative and its body is mechanically generated boilerplate plus one visibility-shaped candidate; that does not satisfy the previously approved requirement for durable real-bundle evidence. Keeping the real-bundle test optional is acceptable for local developer convenience only if the repository also contains a committed validation artifact proving that the real extract assertion ran successfully.
- **If Approved**: Add a narrow committed evidence artifact or test fixture derivation note generated from the real Claude Code extract. It should record the Claude Code source/version or extract identity, the exact command/environment used, total `switch(<id>.type)` candidate count of 133, selected candidate evidence sufficient to identify why it is the visibility predicate, and the successful validation result. Do not build new extraction infrastructure or broaden Story 3 beyond recording the required AC 5 evidence.

---

### Loop/Conflict Detection

**Previous Iterations**: 1
**Recurring Issues**: C1 recurs from iteration 1; H1 was resolved.
**Conflicts Detected**: none
**Assessment**: This is not yet an unhealthy loop. Progress was made by fixing H1 and adding a 133-candidate fixture, but the implementation addressed only part of the approved C1 guidance and still lacks the real-bundle evidence required by AC 5.

---

### Recommendations

**If NEEDS REVISION:**
The developer should address this approved item:
1. Provide mandatory, durable real-extract validation evidence for the 133-candidate visibility-switch disambiguation, while keeping tests independent of ephemeral `/tmp` paths.

Focus ONLY on approved items. Rejected items should NOT be addressed.

---

### Complexity Guard Notes

- No findings were rejected for over-engineering.
- The C1 fix should stay small: record the real extracted bundle evidence or clearly document the committed fixture's derivation from it; do not add a broader extraction framework in this story.
