## Judge's Assessment

**Story**: CB-cline.1 — Cline canonical-history implementation plan
**Iteration**: 3 of 5 maximum
**Date**: 2026-04-24

---

### Summary

| Verdict | Count |
|---------|-------|
| APPROVED (must fix) | 0 |
| APPROVED (should fix) | 0 |
| REJECTED (over-engineering) | 0 |
| REJECTED (out of scope) | 0 |
| REJECTED (not valid) | 0 |

Reviewer report: 0 findings.

---

### Verified Validation Results

- **Starting commit:** `d62419c6a` (cline agent repo, HEAD at end of iter 2)
- **HEAD commit under judgment:** `0fa435d40` (cline agent repo); side repo unchanged at `6393aab3b`.
- **Pre-existing failures (reviewer-reproduced):** none
- **HEAD results (judge re-ran):**
  - `cline_context_bonsai` `npm test`: 42 passing
  - `cline_context_bonsai` `npm run typecheck`: clean
  - `cline` `npm run protos`: clean
  - `cline` `npm run check-types`: exit 0, clean
  - `cline` `npm run test:unit`: 1435 passing
  - `cline` `npm run test:webview`: 150 passing
  - `cline` `npm run compile`: clean (lint + proto-lint + build all green)
- **Regressions:** none
- **Regression gate:** clear

---

### Overall Verdict

**APPROVED AS-IS**

Iter 3 landed the four items the iter-2 judge scoped — C1 dead-code removal, H1 variant registration, H3 gauge injection, M1 system-prompt guidance — with no scope creep and no regressions. Every spec §1–§7 MUST is now satisfied for Cline. Reviewer found zero issues. Independent verification (direct diff reads, snapshot greps, full validation-command re-run) confirms the reviewer's report. Story closes.

---

### Finding-by-Finding Evaluation

The iter-3 reviewer reported zero findings. I verified each iter-2-approved item directly:

#### [C1 iter-2] Remove dead idempotent-splice guard
- **Commit**: `f345f39e5`
- **Verification**: `git show f345f39e5 -- src/core/task/ContextBonsaiApplier.ts` confirms lines 356-396 of the prior HEAD removed (55 → 7 lines net, -48). Replacement is a 3-line comment stating partial-failure recovery is not in v1 scope. `grep -rn "alreadyRetrieved\|firstArchivedText\|placeholderMsgText" cline/src cline/test` returns no hits — no leaked references. Retrieve flow at HEAD is now: find-placeholder → return `anchor_unknown` if missing → splice archived messages into history → write cleaned archive store → overwrite canonical history → clear deleted-range → reset context-history updates. Matches iter-2 judge's option 1 recommendation exactly.
- **Verdict**: Closed.

#### [H1 iter-2] Register context-bonsai tools in all production variants
- **Commit**: `4c605373c`
- **Verification**: `grep -l CONTEXT_BONSAI_PRUNE cline/src/core/prompts/system-prompt/variants/*/config.ts` returns 12 files (generic + next-gen, native-next-gen, gpt-5, native-gpt-5, native-gpt-5-1, gemini-3, glm, hermes, xs, trinity, devstral — matches iter-2 guidance exactly). Each variant diff is the additive 2-line enum insertion; no other config churn. Snapshots regenerated: `grep -l "context-bonsai-prune" .../__snapshots__/*.snap` returns 53 files out of 58 total. The 4 non-matching snapshots are orphan `old-*` baselines with no `*.ts` test references — not affected by any live variant. Spot-checked `anthropic_claude_sonnet_4-basic.snap` (prose tool spec), `vertex_gemini_3-basic.snap` (guidance prose), and `openai_gpt_5_native.tools.snap` (native JSON tool definition) — all three contain correct bonsai tool payloads. The minor `native-gpt-5/config.ts` import-reformat (Biome autofix) is preserved from iter-2 judge's explicit "not worth reverting" determination.
- **Verdict**: Closed.

#### [H3 iter-1 deferred] Wire in-band gauge on 5-turn cadence
- **Commit**: `0fa435d40`
- **Verification**:
  - `Task.injectBonsaiGaugeIfDue` defined at `cline/src/core/task/index.ts:2342-2371`, called at line 2640 — immediately before `say("api_req_started", ...)` at line 2644 and `addToApiConversationHistory` at line 2651. The `<system-reminder>`-wrapped gauge text is pushed onto `userContent`, so it lands in the same user message sent to the provider. Model-visible, in-band, as spec §7 requires.
  - Cadence gate: `turn <= 0 || turn % DEFAULT_GAUGE_CADENCE_TURNS !== 0 → return`. `apiRequestCount` is pre-incremented at line 2384 (top of `recursivelyMakeClineRequests`), so first gauge fires at turn 5, matching spec default.
  - Tokens parsed from prior `api_req_started` message (`ClineApiReqInfo.tokensIn/Out/cacheWrites/Reads`). Usable budget from `getContextWindowInfo(this.api).maxAllowedSize` — reuses existing helper rather than duplicating.
  - Fail-silent paths: `previousApiReqIndex < 0`, missing `previousRequestText`, `JSON.parse` throw, `buildGaugeReading` null all `return` without side effects. No logging, no placeholder gauge. Matches spec §7 "If token usage or model-limit data is unavailable, the gauge MUST remain silent."
  - Side-repo `gauge.ts` band logic (at `cline_context_bonsai/src/gauge.ts`): `<30` info, `30-60` advisory (inclusive), `61-80` reminder (inclusive), `>80` urgent. Boundary test: 30 → advisory, 60 → advisory, 61 → reminder, 80 → reminder, 81 → urgent. Reminder text contains both "Recency" and "drift". Urgent text contains literal "PRUNE NOW". Matches spec §7 band wording and the "stronger reminder including recency and drift" / "explicit urgent prune language, including `PRUNE NOW`" MUSTs.
- **Verdict**: Closed.

#### [M1 iter-1 deferred] Inject bonsai system-prompt guidance on the internal path
- **Commit**: `9525b2b16`
- **Verification**:
  - New file `cline/src/core/prompts/system-prompt/components/bonsai_guidance.ts` exports `getBonsaiGuidanceSection(variant)` which returns the guidance block only when the variant's `.tools` list includes either `CONTEXT_BONSAI_PRUNE` or `CONTEXT_BONSAI_RETRIEVE`. Returns empty string otherwise.
  - `PromptBuilder.build()` (at `registry/PromptBuilder.ts`) adds post-processing step `appendBonsaiGuidance` after `postProcess(prompt)`. The seam bypasses the per-variant `componentOrder` / template machinery entirely, so all 12 variant templates pick up guidance automatically via the tool-enum presence gate — no template edits, no placeholder additions.
  - Guidance content reviewed against spec §1 MUSTs: tool names (`context-bonsai-prune` / `context-bonsai-retrieve`), prioritization (older completed contiguous blocks first; do not expose internal ranking), non-destructive + retrievable (explicit first bullet), protected content (operational rules, session goal, unresolved task instructions, unmet acceptance criteria, active validation/fix-loop), from_pattern/to_pattern boundary rules, summary/index_terms usage, gauge presence/act-on-signal. All §1 MUSTs present.
  - Snapshot coverage: `grep -l "CONTEXT BONSAI"` returns 49 production full-prompt snapshots. The 4 `.tools.snap` files do not contain the prose block — expected, since those snapshots render only the native tool-schema JSON and the guidance lives in the prompt body.
  - Architectural note: because guidance emission is tool-enum-gated, it is structurally impossible to ship tools without the guidance, or guidance without the tools. This is the tightest possible coupling between M1 and H1, and worth preserving.
- **Verdict**: Closed.

---

### Scope Discipline Check

`git diff --name-only d62419c6a..HEAD | grep -v __snapshots__` returns exactly the expected file set:

```
src/core/prompts/system-prompt/components/bonsai_guidance.ts          (M1 new)
src/core/prompts/system-prompt/registry/PromptBuilder.ts              (M1 seam)
src/core/prompts/system-prompt/variants/{devstral,gemini-3,glm,gpt-5,hermes,
  native-gpt-5-1,native-gpt-5,native-next-gen,next-gen,trinity,xs}/config.ts  (H1: 11 files)
src/core/task/ContextBonsaiApplier.ts                                 (C1 dead-code removal)
src/core/task/index.ts                                                (H3 gauge)
```

No rejected items from iter 1 (M2, L2, L3) or iter 2 (M1/M2/M3/M4, L1, L2) snuck in. No `.skip` / `xit` / `xdescribe` added. No unrelated refactors. The only cosmetic churn is the Biome-autofix import reformat in `native-gpt-5/config.ts`, which iter-2 judge already classified as not worth reverting.

---

### Spec Compliance End-to-End

| Spec section | Requirement | Met at iter-3 HEAD |
|---|---|---|
| §1 System Guidance | tools named; prioritization; non-destructive; protected content | Yes (M1) |
| §2 Prune Tool | name + inputs + id rejection + pattern resolution + atomic + one range | Yes (iter 1) |
| §3 Retrieve Tool | name + anchor_id + same-step guard + atomic | Yes (iter 1/2; C1 cleanup iter 3) |
| §4 Placeholder | anchor + end + summary + index | Yes (iter 1; side-repo `placeholder.ts`) |
| §5 Archive Persistence | per-task sidecar JSON | Yes (iter 1) |
| §6 Context Transform | canonical history overwrite before next API call | Yes (iter 1) |
| §7 Gauge | in-band + 5-turn cadence + 4 bands + fail-silent | Yes (H3) |

All §1–§7 MUSTs are satisfied. Minimum validation scenarios from the shared spec §"Minimum Validation Scenarios" are covered by the existing side-repo and agent tests (contiguous prune success, ambiguous boundary rejection, retrieve by anchor, gauge cadence/severity, same-step guard). Secret-content prune oracle is an e2e evidence item, acceptable to defer past this story per the "minimum" framing.

---

### Loop/Conflict Detection

**Previous Iterations**: 2
**Recurring Issues**: None. Iter 3 cleanly resolved everything iter-2 judge approved:
  - C1 (iter-2 dead-code) — removed per judge's recommended option 1.
  - H1 (iter-2 variant registration) — completed the iter-1 judge's under-scoped direction.
  - H3 (iter-1 gauge) — landed in iter 3.
  - M1 (iter-1 guidance) — landed in iter 3.
**Conflicts Detected**: None. No reviewer/judge contradictions.
**Assessment**: Healthy close. Each iteration had a bounded, concrete scope and achieved it. No 3+ cycle repeats, no contradictory guidance.

---

### Recommendations

**APPROVED AS-IS.**

The implementation meets every acceptance criterion in the story plan and every §1–§7 MUST in the shared Context Bonsai spec. The reviewer found zero issues; independent judge verification confirmed. Story CB-cline.1 closes with this judgment.

Items deferred through the 3-iteration cycle (each explicitly rejected by prior judgments as out-of-scope or tech-debt) remain appropriate to defer:
- `resetContextHistoryUpdates` unit test (iter-2 M1 rejected): trivial function, indirectly exercised.
- Handler-level step-counter wiring test (iter-2 M2 rejected): one-line closure, low-signal.
- Checkpoint-restore gate test (iter-2 M3 rejected): ~25 LoC gate, story AC explicitly says avoid coupling to checkpoint unless needed.
- `apiRequestCount` resume persistence (iter-2 M4 rejected): cross-cutting; same-step guard is SHOULD per spec §3.
- Atomic `context_history.json` write (iter-2 L1 rejected): matches pre-existing house style; cross-module refactor if touched.

---

### Complexity Guard Notes

No new complexity rejections in iter 3. The only stylistic note worth recording for future calibration:

- **M1 seam choice**: developer placed guidance at `PromptBuilder.build()` as a post-processing step rather than adding a new `SystemPromptSection` enum + placeholder + 12 per-variant `componentOverrides` entries. Judge endorses this: the section-plus-placeholder path would have added ~150 LoC of template boilerplate for zero additional capability, and would not satisfy §1 more completely than the current seam. The tool-enum presence gate couples guidance + tool-registration tightly — future tool additions cannot accidentally de-sync. Worth preserving as a pattern.

- **H3 seam choice**: gauge injection reuses the already-computed `previousApiReqIndex` from line 2462 (same method) and calls `getContextWindowInfo(this.api)` (existing helper), rather than instrumenting a new token-usage observer. Minimal intrusion, no new abstractions.
