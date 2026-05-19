## Judge's Assessment

**Story**: pi-bonsai-relocation.1 - Rebuild the integration-test harness on Pi's SDK
**Iteration**: 1 of 5 maximum
**Date**: 2026-05-18

---

### Summary

| Verdict | Count |
|---------|-------|
| APPROVED (must fix) | 0 |
| APPROVED (should fix) | 0 |
| REJECTED (over-engineering) | 0 |
| REJECTED (out of scope) | 1 |
| REJECTED (not valid) | 1 |

### Verified Validation Results

- **Starting commit:** `4d4d092d` (reviewer-verified; judge re-verified as parent of `2d953af9`)
- **Pre-existing failures (reviewer-reproduced):** the reviewer reported `none` at the parent. This is **incorrect**. Judge reproduced a pre-existing flake at the parent: `npx vitest run test/suite/context-bonsai`: `03-retrieve.test.ts > retrieves a previously-pruned range...`, `02-prune.test.ts > the prune persists in the session and reload reproduces the same placeholder` — both intermittent 30000ms timeouts, 2 failing runs in 36 parallel runs at parent `4d4d092d`.
- **HEAD results:** 9 pass / 0 fail on a clean run; intermittently 8 pass / 1 fail — `03-retrieve.test.ts` 30000ms timeout, reproduced 1 failing run in 16 parallel runs at HEAD `2d953af9`.
- **Regressions:** none. The reload-driven 30s-timeout flake exists identically at the parent commit with the old harness; it is not introduced by this commit.
- **Regression gate:** clear. The flake is a pre-existing condition in shared `AgentSession.reload()` code (`resetApiProviders()` clears the uniquely-named faux api), exercised identically by both the old and new harness. No `pass→fail` or new-identifier `fail→fail` transition is attributable to this story.

---

### Overall Verdict

**APPROVED AS-IS**

The story's five acceptance criteria are met. A dedicated SDK-based harness (`test/suite/context-bonsai/sdk-harness.ts`) is built only on the `@mariozechner/pi-coding-agent` public entry point; it imports no `test/utilities.ts` helper and no `src/` deep path (validation grep returns no matches). The shared `harness.ts` and `utilities.ts` are unmodified. The seven integration tests are repointed and pass against the in-tree extension. The SDK feasibility finding is recorded positively in the commit message.

The reviewer raised one HIGH and one LOW finding. The HIGH (H1) is a real flake but is **not a regression** — it pre-exists at the parent commit, as the judge confirmed by direct reproduction. The LOW (L1) is explicitly out of this story's scope, as the reviewer themselves acknowledged. Neither finding is an approvable blocker for this story.

---

### Finding-by-Finding Evaluation

#### [H1] New harness intermittently hangs `03-retrieve` under the story's own validation command
- **Reviewer's Issue**: Under `npx vitest run test/suite/context-bonsai` (parallel), `03-retrieve.test.ts` intermittently times out at 30000ms (~20% of runs). Root cause: `AgentSession.reload()` calls `resetApiProviders()`, which clears all api providers and re-registers only built-ins; the uniquely-named faux api is wiped, so the post-reload `prompt()` dispatches to a missing provider and the stream never resolves. The reviewer classifies this as a regression introduced by the new harness, citing "8/8 parallel passes at parent `4d4d092d`."
- **Verdict**: REJECTED (not valid as stated — not a regression)
- **Reasoning**: The root-cause mechanism is correct and judge-confirmed: `agent-session.ts:2382` `reload()` unconditionally calls `resetApiProviders()` (`register-builtins.ts:428-431` = `clearApiProviders()` + `registerBuiltInApiProviders()`), and `registerFauxProvider` (`faux.ts:391`) assigns the api a unique random name (`api = options.api ?? randomId(DEFAULT_API)`), so the faux api does not survive the reset. The flake is real — judge reproduced it at HEAD (1 fail / 16 runs). **But the reviewer's regression claim is false.** The reviewer sampled only 8 parallel runs at the parent and concluded "8/8 — flake is new." The judge ran the parent (`4d4d092d`, old `harness.ts`) 36 times and reproduced the identical 30s-timeout flake in `03-retrieve` and `02-prune` (2 fails / 36 runs). The parent's `03-retrieve.test.ts` has the same `reload()` + `prompt()` structure, and `AgentSession.reload()` is shared `coding-agent` code traversed identically by both harnesses. The flake rate is statistically indistinguishable between parent (~6%) and HEAD (~6%). This story did not introduce the flake; it inherited it. Under the Regression Gate, a pre-existing failure is not a regression and does not block approval. The story's scope was to repoint the harness onto the public SDK, not to fix a latent host-level race in `resetApiProviders()` vs. the faux registry — that is a separate, pre-existing defect outside this story's acceptance criteria. The reviewer's suggested fix (re-register the faux provider after reload) is a reasonable improvement and should be captured as follow-up work, but it is not a defect this commit must remediate to satisfy its acceptance criteria.
- **If Rejected**: Not a regression and out of this story's scope. Recommend the orchestrator log a separate tech-debt/follow-up item: the bonsai integration suite carries a pre-existing reload-vs-faux-provider flake; a future change (in this epic's Story 2 relocation, or a dedicated fix) should make the SDK harness re-register the faux provider after `session.reload()` so reload-driven tests are deterministic. The `02b` test already documents this hazard and works around it by avoiding `reload()`; `03-retrieve` and `02-prune` do not, which is why they flake — at both commits.

#### [L1] Uncommitted `package-lock.json` drift left in the `pi` working tree
- **Reviewer's Issue**: `npm install` (validation command 1) adds a `typebox` entry to `package-lock.json` for the in-tree `context-bonsai` package; this leaves the submodule working tree dirty after a clean validation run. The reviewer states this is pre-existing drift, not caused by this commit's diff, and not part of this story's scope.
- **Verdict**: REJECTED (out of scope)
- **Reasoning**: Judge confirmed: `git status` shows `package-lock.json` modified before running anything, and `npm install` produces a one-line diff adding `"typebox": "^1.1.24"` to the `context-bonsai` package's dependency block. The reviewer correctly identifies this as pre-existing drift unrelated to the commit's diff (the commit touches only test files and the new harness). It is explicitly outside this story's planned target files and acceptance criteria. The reviewer themselves marked it out of scope. Nothing for this story's developer to fix.
- **If Rejected**: Out of scope for pi-bonsai-relocation.1. The lock drift originates from the in-tree `context-bonsai` package's manifest, which Story 2 (relocate the extension and convert dependencies to explicit pinned versions) and Story 4 (strip the fork, regenerate the lockfile) will both touch. Recommend the orchestrator note it so a later story in this epic handles the lockfile deliberately rather than letting it ride silently into an unrelated commit.

---

### Loop/Conflict Detection

**Previous Iterations**: 0 (this is iteration 1)
**Recurring Issues**: none
**Conflicts Detected**: none
**Assessment**: First iteration. No loop. The implementation satisfies the acceptance criteria on a clean run; the one substantive finding turned out to be a pre-existing condition rather than a defect of this commit.

---

### Recommendations

**APPROVED AS-IS**

The implementation meets all five acceptance criteria. The SDK harness is built on Pi's public surface, imports no non-public path, leaves the shared harness untouched, and the seven integration tests pass against the in-tree extension.

Two non-blocking items the orchestrator should record as follow-up (NOT to be fixed under this story):
1. Pre-existing flake: reload-driven integration tests (`03-retrieve`, `02-prune`) intermittently time out at 30s because `AgentSession.reload()` → `resetApiProviders()` wipes the uniquely-named faux api. Present at both the parent and this commit. A future change should have the SDK harness re-register the faux provider after `reload()`.
2. Pre-existing `package-lock.json` drift (`typebox` entry for the in-tree `context-bonsai` package). Story 2 / Story 4 of this epic should regenerate the lockfile deliberately.

The developer should address neither item under pi-bonsai-relocation.1 — both are out of scope.

---

### Complexity Guard Notes

- No over-engineering findings were rejected. The harness itself is appropriately minimal: it builds directly on `createAgentSession` and `DefaultResourceLoader.extensionFactories` (the SDK's real public extension path) rather than reproducing private test helpers, which is exactly the story's preferred direction.
- The reviewer's H1 fix suggestion (wrap/patch `session.reload()` to re-register the faux provider) is sound and low-complexity, but rejected here as a fix-under-this-story only because the defect is pre-existing and out of scope — not because the fix is over-engineered. It is recommended as follow-up work.
