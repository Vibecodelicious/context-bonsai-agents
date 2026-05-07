## Judge's Assessment

**Story**: P.1 — Pi context-bonsai package scaffold
**Iteration**: 1 of 5 maximum
**Date**: 2026-04-29

---

### Summary

| Verdict | Count |
|---------|-------|
| APPROVED (must fix) | 0 |
| APPROVED (should fix) | 0 |
| REJECTED (over-engineering) | 0 |
| REJECTED (out of scope / log to backlog) | 2 |
| REJECTED (not valid / cosmetic) | 2 |

### Verified Validation Results

- **Starting commit:** pi `7549ca10` (tip of `feat/context-bonsai-port`); judge re-verified via `git rev-parse`.
- **Pre-existing failures (reviewer-reproduced):** none
- **HEAD results (judge re-ran):**
  - `npx vitest --run packages/context-bonsai/test/prompt.test.ts`: **3/3 pass**
  - `npx vitest --run packages/coding-agent/test/suite/context-bonsai/01-scaffold.test.ts`: **1/1 pass**
  - `npm run check` from repo root: **clean** (biome 611 files, tsgo --noEmit, browser smoke, web-ui check all pass; no dist bootstrap required, contradicting the dev's commit-message claim — see L1)
- **Regressions:** none
- **Regression gate:** clear

---

### Overall Verdict

**APPROVED AS-IS**

All 8 acceptance criteria are met. Verbatim port of `BONSAI_GUIDANCE` confirmed via byte-level diff
against `/home/basil/projects/opencode_context_bonsai_plugin/src/prompt.ts` — only differences are
the export wrapper (`getSystemPromptGuidance = () =>` → `BONSAI_GUIDANCE = `), the closing
backtick semicolon, and a single source-comment annotation; the body bytes are identical.
Out-of-scope changes are zero (`git diff 1cf7545a..7549ca10 --name-only` returns exactly the seven
planned target files plus `package-lock.json`). The factory registers only `before_agent_start`,
no `registerTool` or `appendEntry` calls. The integration test reaches the faux-provider
`context.systemPrompt` boundary and asserts the guidance landed.

The two MEDIUMs are real spec-compliance observations but neither is in-scope for this story. M1 is
test-quality polish on a coverage check the dev added voluntarily (the AC only requires "asserts
handler registration"). M2 is an upstream OpenCode content gap that AC4's verbatim-port mandate
explicitly inherits — fixing it here would violate AC4. Both are correctly logged as epic-level
follow-ups.

The iteration budget is preserved (4 remaining unused). Story P.1 closes; orchestrator should
pin the parent submodule at pi HEAD `7549ca10` and proceed to Story P.2.

---

### Finding-by-Finding Evaluation

#### [M1] Unit test "six-meaning coverage" duplicates the retrieve check
- **Reviewer's Issue**: `prompt.test.ts:50-66` claims to cover all six §1 meanings but the third
  `it` block re-asserts `BONSAI_GUIDANCE` contains `context-bonsai-retrieve` (line 53 already
  asserts the same on line 65 via the same regex), instead of distinctly testing the
  "non-destructiveness" meaning. The test passes but the coverage claim is overstated by one item.
- **Verdict**: **REJECTED (out of scope / log to backlog)**
- **Reasoning**: Verified by reading `packages/context-bonsai/test/prompt.test.ts:50-66`. The
  duplicate is real. However, AC5 only requires "one unit test that imports the factory and
  asserts handler registration for `before_agent_start`" — the six-meaning assertions are
  voluntary additional coverage the dev added, not an AC requirement. The test as written passes
  and adds positive value (five distinct §1-meaning checks land); the overstated claim is a comment
  accuracy issue, not a correctness issue. Tightening the test now would touch test code the
  reviewer correctly notes is going to be revisited when M2 is addressed at the epic level (the
  non-destructiveness assertion is the natural pair to a non-destructiveness clause in the
  guidance). Logging M1 + M2 together as a single epic-backlog item is the cleaner trajectory.
- **Action**: Log to epic backlog as part of the §1 non-destructiveness follow-up. Not required
  for P.1 close.

#### [M2] BONSAI_GUIDANCE does not state pruning is non-destructive
- **Reviewer's Issue**: Cross-agent spec §1 ("System Guidance") requires guidance to tell the model
  "that pruning is non-destructive and retrieval remains available". The Pi guidance mentions
  `context-bonsai-retrieve` (covering the retrieval half) but never states pruning is
  non-destructive. The gap is inherited from upstream OpenCode source.
- **Verdict**: **REJECTED (out of scope / log to backlog)**
- **Reasoning**: This is a real §1 compliance gap, but it is structural to the port-by-mandate
  rather than introduced by Pi. The story's AC4 reads: "exports `BONSAI_GUIDANCE` — port verbatim
  from `/home/basil/projects/opencode_context_bonsai_plugin/src/prompt.ts`
  `getSystemPromptGuidance()`." The plan was approved 2026-04-23 and was deliberately re-examined
  on 2026-05-06 in commit `1cf7545a` ("docs(plans): align epic + stories with cross-agent spec
  drift"), which updated stories 2-5 and the epic for spec drift but **explicitly did not** modify
  Story P.1. That deliberate non-modification means the planner reviewed P.1 against the drifted
  spec and chose to keep verbatim-port intact. The right place to resolve §1 compliance is at the
  upstream OpenCode source (so all agent ports benefit), not by adding a Pi-specific addendum that
  diverges from the verbatim-port mandate other agents are also tracking.
- **Critical question disposition**: The plan's AC4 takes precedence over §1 for P.1 specifically.
  AC4 is unambiguous and was deliberately preserved through the spec-drift sweep. The Pi per-agent
  spec does say at line 90 "Guidance semantics MUST remain aligned with the shared spec:
  protected context, ranking, drift, non-destructive pruning, and retrieval rules must be
  model-visible" — but it also accepts "minor wording adaptation" per shared spec §1. Treating
  this as a cross-port content gap rather than a Pi-specific bug is the correct read.
- **Action**: Log to the epic backlog. Track as "OpenCode upstream §1 non-destructiveness
  guidance gap" with downstream syncing for all verbatim-port agent implementations. Resolution
  options for the future: (a) patch upstream OpenCode prompt and re-port across agents, (b) add
  a per-agent guidance addendum where the verbatim-port mandate is relaxed, or (c) explicitly
  waive §1 non-destructiveness in the per-agent specs that mandate verbatim port. Not required
  for P.1 close.

#### [L1] Commit message claims `npm run check` requires workspace-dist bootstrap
- **Reviewer's Issue**: Commit `7549ca10`'s message states: "`npm run check` is clean once pi-tui,
  pi-ai, pi-agent-core, and pi-web-ui dist/ are built (a pre-existing pi-mono workspace bootstrap
  requirement, not a regression introduced by this story)." Reviewer verified the bootstrap is not
  actually required.
- **Verdict**: **REJECTED (cosmetic)**
- **Reasoning**: Judge re-verified by running `npm run check` from a clean repo-root state
  (working tree clean, no prior `npm run build`, only `node_modules` from `npm install`). Output:
  biome clean (611 files, no fixes applied), tsgo --noEmit clean, browser smoke clean, web-ui
  biome+tsc --noEmit clean. No bootstrap was required. The dev's claim is inaccurate. However,
  rewriting commit history over a footnote in a commit message is not warranted; the commit's
  factual claims about the code (test passes, etc.) are correct. The harm is zero.
- **Action**: None. Don't rewrite history over commit-message wording.

#### [L2] `src/index.ts` re-exports `BONSAI_GUIDANCE`
- **Reviewer's Issue**: `src/index.ts` includes `export { BONSAI_GUIDANCE } from "./prompt.js";`
  (used by the integration test). Not in the plan's AC; harmless.
- **Verdict**: **REJECTED (not valid / utility)**
- **Reasoning**: The re-export is functionally necessary for the integration test at
  `packages/coding-agent/test/suite/context-bonsai/01-scaffold.test.ts` which imports
  `bonsaiFactory, { BONSAI_GUIDANCE }` from `../../../../context-bonsai/src/index.js`. The
  alternative would be to deep-import from `prompt.js`, which is no cleaner and breaks the
  package-public-API stance. The re-export is the right call. Not a fix candidate.
- **Action**: None.

---

### Loop/Conflict Detection

**Previous Iterations**: 0 (this is iter 1)
**Recurring Issues**: n/a
**Conflicts Detected**: none
**Assessment**: Healthy first iteration. Reviewer's APPROVED-AS-IS recommendation is well-supported
by the evidence. Judge concurs.

---

### Recommendations

**APPROVED AS-IS** — the implementation meets all 8 acceptance criteria. P.1 closes. Orchestrator
should:
1. Pin parent submodule at pi HEAD `7549ca10`.
2. Proceed to Story P.2 (prune tool + archive store + context transform).
3. Log M1 + M2 as a single epic-level follow-up item: "§1 non-destructiveness guidance gap
   inherited from upstream OpenCode prompt; resolve cross-port (patch upstream + re-sync agents,
   OR per-agent spec relaxation of verbatim-port mandate, OR per-agent guidance addendum)." Tie
   the unit-test cleanup to the same item — once non-destructiveness language exists in the
   guidance, the unit test's third `it` block should assert it distinctly instead of duplicating
   the retrieve check.

No items require fixing in P.1.

---

### Complexity Guard Notes

Deliberately not approved to prevent over-engineering or scope-creep into P.1:

- **M1 (test cleanup)**: The duplicate-check is real but the AC only requires handler-registration
  assertion. Forcing a test-fix iteration over a voluntary coverage claim would burn iteration
  budget on test polish rather than the core epic work (Stories 2-5). Better to fix M1 in the
  same change that fixes the underlying M2 content gap.
- **M2 (non-destructiveness clause)**: Adding the clause to Pi-only would violate AC4's
  verbatim-port mandate, fragmenting agent-port consistency. The right resolution is upstream or
  cross-cutting, not Pi-specific.
- **L1 (commit message accuracy)**: Rewriting commits over a wording footnote is pure churn.
- **L2 (re-export)**: Useful API surface; removing it would force the integration test into
  deeper imports.

Iteration budget reminder: this is iter 1 of 5. With APPROVED AS-IS, 4 iterations remain
unused — no budget concern. Stories 2-5 carry the bulk of the epic complexity (prune logic,
archive store, context transform, gauge, e2e loop), so preserving the budget is correct.
