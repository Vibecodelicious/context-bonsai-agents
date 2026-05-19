## Judge's Assessment

**Story**: pi-bonsai-relocation.3 - Rewrite the e2e harness for an installed Pi
**Iteration**: 1 of 5 maximum
**Date**: 2026-05-18

---

### Summary

| Verdict | Count |
|---------|-------|
| APPROVED (must fix) | 1 |
| APPROVED (should fix) | 2 |
| REJECTED (over-engineering) | 0 |
| REJECTED (out of scope) | 0 |
| REJECTED (not valid) | 0 |

### Verified Validation Results

- **Starting commit:** `23d8d3d` (reviewer-verified)
- **Pre-existing failures (reviewer-reproduced):** none
- **HEAD results:** reviewer re-ran the harness on the `story3-e2e-harness` sprite (`zen`/`kimi-k2.5`): exit 0; model called `context-bonsai-prune` (`Archived 1 messages`); turn 4 honored `--no-tools` (0 tool calls); recall returned `UNAVAILABLE`; turn-4 thinking observed the `[PRUNED: ...]` placeholder.
- **Regressions:** none
- **Regression gate:** clear

---

### Overall Verdict

**NEEDS REVISION**

The rewrite meets every acceptance criterion: the harness has no `PI_ROOT`/`pi-test.sh`/in-tree dependency, installs pinned `@mariozechner/pi-coding-agent@0.69.0`, stages the extension through `~/.pi/agent/extensions/`, launches Pi from an unrelated cwd, runs Protocol A, and the reviewer's independent behavioral run passed. The story's functionality is in place and verified.

The three findings are all genuine and all small. None require rejection. M2 is the load-bearing one: the recall oracle can PASS spuriously on an empty model reply, which weakens the very assertion that closes AC4. M1 is a comment that overstates the check's reach. L1 is a trivial stale argument. All three are proportionate fixes (a few lines each) on the validation logic itself — exactly the kind of correctness the story is about — so all three are approved. They do not block the behavior, hence NEEDS REVISION rather than NEEDS DISCUSSION.

---

### Finding-by-Finding Evaluation

#### [M1] Oracle comment overstates what the turn-4 transcript contains
- **Reviewer's Issue**: The comment at `run-e2e.sh:239-240` claims the secret "left active context iff it does not appear anywhere in turn 4's captured transcript (post-prune model-visible context + assistant reply)." But `turn4.jsonl` is the `--mode json` event stream of that single turn — it carries only that turn's new events (the turn-4 user prompt and the assistant reply/thinking), not the assembled model-visible context and not the `[PRUNED ...]` placeholder.
- **Verdict**: APPROVED (should fix)
- **Reasoning**: Verified valid. `RECALL_CHECK` scans `$LOG_DIR/turn4.jsonl` via `countMatchesInEventStream`. The harness's own predecessor comments (deleted scenarios E and G in this very diff) explicitly state that "the post-`context`-event transform output (i.e. the placeholder `[PRUNED: ...]`) never lands in the captured `--mode json` stdout." The new comment contradicts that known constraint and claims a stronger check than the code performs. The PASS conclusion is still sound — it is a behavioral inference (the model did not recite the nonce) — but a misleading comment in a verification harness is a real defect because it misrepresents what the oracle proves to anyone reading or trusting it.
- **If Approved**: Reword the comment so it describes the actual check: turn 4's emitted event stream (its user prompt + the assistant's reply/thinking) does not contain the nonce, which proves the model did not reproduce the secret. Drop the "post-prune model-visible context" / placeholder framing. This pairs naturally with the M2 fix.

#### [M2] Recall oracle is purely negative; an empty assistant reply passes spuriously
- **Reviewer's Issue**: `RECALL_CHECK` passes whenever the nonce count is 0. If the model returns an empty text part, or only thinking with no text, the leak count is still 0 and the harness reports PASS without any positive recall-failure signal. Protocol A step 6 expects the model to respond that the secret is unavailable.
- **Verdict**: APPROVED (must fix)
- **Reasoning**: Verified valid. The oracle is the assertion that closes AC4. As written, "no leak" is the sole gate; a degenerate or empty turn-4 response satisfies it. Protocol A step 6 in `docs/context-bonsai-e2e-template.md` requires the model to *respond* that the secret is unavailable / no longer in active context. A pure-negative check can therefore green a run where the model did nothing meaningful — a false positive in a pre-release gate. The fix is small and directly strengthens the criterion the story exists to verify, so it is in scope and proportionate. Marked must-fix because it is a correctness gap in the acceptance oracle itself.
- **If Approved**: Add a positive assertion that the turn-4 assistant message contains a non-empty text part, so PASS requires both "no nonce leak" AND "the model actually produced a textual answer." The harness already extracts and prints turn-4 assistant text in the evidence block, so the data is in hand; promote that extraction into an assertion. Asserting a literal "UNAVAILABLE" substring is acceptable but optional and model-sensitive — a non-empty-text assertion is the minimum required; do not over-fit to exact wording.

#### [L1] Stale `--all` argument in `package.json` `e2e` script
- **Reviewer's Issue**: `"e2e": "bash test/e2e/run-e2e.sh --all"` — the rewritten harness no longer parses positional args, so `--all` is silently ignored.
- **Verdict**: APPROVED (should fix)
- **Reasoning**: Verified valid. The rewrite deleted all argv parsing; `--all` is dead text. Harmless (it does not error), but misleading in a committed script that this story rewrote. Removing it is a one-token edit fully within the story's surface (`run-e2e.sh` invocation contract). Approved as a should-fix cleanup, not blocking.
- **If Approved**: Change the `e2e` script to `"bash test/e2e/run-e2e.sh"`.

---

### Loop/Conflict Detection

**Previous Iterations**: 0 (this is iteration 1)
**Recurring Issues**: none
**Conflicts Detected**: none
**Assessment**: First iteration; no loop risk. Findings are small and convergent.

---

### Recommendations

**NEEDS REVISION** — the developer should address these approved items:

1. **[M2]** Add a positive assertion to the recall oracle: turn 4's assistant message must contain a non-empty text part, so PASS requires both no nonce leak and an actual textual answer.
2. **[M1]** Reword the turn-4 oracle comment to accurately describe what it scans (this turn's emitted event stream), dropping the "post-prune model-visible context" / placeholder claim.
3. **[L1]** Remove the stale `--all` argument from the `e2e` script in `package.json`.

Focus ONLY on these three items. There are no rejected items.

The reviewer's note that `check-credentials.ts` is now orphaned by the harness and that `docs/e2e-testing.md` still documents `pi-test.sh` is correctly scoped out — AC5 explicitly defers the doc rewrite to Story 5, and removing `check-credentials.ts` is not in this story. No action there.

---

### Complexity Guard Notes

- No findings rejected for over-engineering. The reviewer's suggested fixes are all minimal (a comment reword, one assertion, one token removal) and proportionate to genuine defects in the verification logic.
- Explicitly did NOT escalate M2's fix toward exact-wording matching ("UNAVAILABLE" literal). A non-empty-text assertion is sufficient and avoids brittle coupling to model phrasing across providers — noted in the M2 guidance so the developer does not over-fit.
