# Story: Fix Inert Archived-Filter Caused By Encoding-less Wrapper readFileSync

## Goal

Restore Context Bonsai prune behavior on the Claude Code / tweakcc port. The injected `archived-filter` transcript-rewrite seam currently never hides any archived range, so prune reports success but the model still sees the "pruned" content and context pressure rises instead of falling. The single change is to call the host fs helper's `readFileSync` with an explicit encoding argument (matching the host's own convention), add a regression guard that exercises the host's stricter fs-wrapper signature, and re-prove the behavior live with Protocol A on the pinned native 2.1.143 target before advancing the parent submodule pin.

This is a conformance bug fix. The shared behavior spec already requires prune to hide archived content (`docs/context-bonsai-agent-spec.md` §4, §6, Invariants), so no shared-spec change is needed.

## Root Cause (confirmed, evidence-backed)

The injected filter (`tweakcc_context_bonsai/patches/archived-filter.patch.ts:34`, function `buildInjectedFilter`) reads the per-session archive marker with:

```
const __cbRaw=__cbFs.readFileSync(__cbMarkerPath);
```

`__cbFs` is `helpers.fsFunc()` (the discovered host fs helper, minified `R$()` in 2.1.143). On the live binary this returns the host's **fs wrapper**, not Node's `fs`. The wrapper's `readFileSync(path, options)` dereferences `options.encoding`; called with a single argument, `options` is `undefined`, so it throws `undefined is not an object (evaluating '$.encoding')`. The surrounding `try{...}catch{__cbIds=[]}` swallows the throw, leaving the archived-id set empty, so `if(__cbArchivedIds.size>0)` is false and the `messages.filter(...)` never runs.

Runtime probe evidence (instrumented copy of `/home/basil/.local/share/claude/versions/2.1.143`, disposable session): `{exists:true, readOk:false, err:"undefined is not an object (evaluating '$.encoding')", idCount:0, wouldMatch:0}` while the session id resolved correctly, the marker file existed, and the in-memory message uuids matched the marker entries. This rules out session-id resolution, uuid provenance, and wrong-seam hypotheses; the read throw is the sole cause.

Corroborating static evidence:
- The host's own extracted usage calls the wrapper with an encoding: `A1().readFileSync(J0(C2(),"history.jsonl"),"utf8")` (`tweakcc_context_bonsai/patches/__fixtures__/runtime-helpers.fixture.js:4`).
- The MCP writer (`tweakcc_context_bonsai/src/lib/compact.ts:74-76,86-112`) writes the marker under `homedir()/.claude` with **Bun runtime APIs** (`Bun.file(markerPath).json()` to read-merge, `Bun.write(markerPath, ...)` to write — see `compact.ts:96,100`), which works — hence the marker file is correctly written. The runtime asymmetry (writer = Bun APIs; reader = the host's fs wrapper via `helpers.fsFunc()`) is why the write side has always worked while the read side throws.
- The bug predates the `remove-archived-marker-cache` story: commit `3505c66` (side repo) shows both the pre-cache and post-cache versions call `readFileSync(__cbMarkerPath)` without an encoding argument. The cache removal did not introduce it.

### Why existing tests did not catch it

`tweakcc_context_bonsai/patches/archived-filter.patch.test.ts:142-146` (`buildPatchedVisibilityPredicate`) injects the patch and runs it with **real Node `fs`** (`nodeFs`) as the fs helper, and the test runtime bundle's own sample call (`testRuntimeBundle`: `A1().readFileSync(J0(C2(),"history.jsonl"))`) is itself encoding-less — so Node's lenient `readFileSync(path)` (returns a Buffer without an encoding argument) makes the test pass. The host-convention `readFileSync(...,"utf8")` evidence in `__fixtures__/runtime-helpers.fixture.js:4` is wired only into the anchor/fail-closed tests, not into `buildPatchedVisibilityPredicate`, so no existing test exercises the host wrapper's stricter signature; the throw only manifests on the live binary. This is the exact "green type/unit tests, dead model-visible behavior" trap the e2e spec warns about (`docs/agent-specs/context-bonsai-e2e-spec.md` "acceptance bar"). The regression guard in this story (a purpose-built throwing fs stub, Task 3) closes that fidelity gap.

## User Model

### User Gamut
- Examples only, spanning broad dimensions:
  - Claude Code users running long sessions who invoke prune to reclaim context and currently get silent no-ops (the immediate harm).
  - A security-minded user relying on the Secret Prune Oracle guarantee — for them this bug is a confidentiality failure, since "pruned" secrets remain fully in model-visible context.
  - Maintainers forward-porting the patch across Claude Code releases who need the fs-calling convention to be correct and guarded against re-regression.
  - Reviewers who must distinguish a real behavioral fix from a green-tests-only claim.
  - Downstream port owners (other harnesses) who read this port as the Claude Code reference for how to call host fs helpers.

### User-Needs Gamut
- Examples only, spanning broad dimensions:
  - Correctness: prune must actually remove archived ranges from the model-visible transcript, and retrieve must restore them.
  - Confidentiality: a pruned secret must not remain recallable from active context (Protocol A).
  - Regression durability: the test suite must fail if the injected filter ever again calls the host fs helper in a way the wrapper rejects.
  - Auditability: live behavioral evidence (host/session state, not the tool's success string) recorded without leaking secrets or credentials.
  - Minimal blast radius: the smallest change that fixes the read, with no weakening of fail-closed anchor discovery or ambiguity thresholds.

### Ambiguities From User Model
- Exact encoding form (`"utf8"` string vs `{encoding:"utf8"}` object). Resolved by: (a) the host's own convention uses the `"utf8"` string form, and (b) an empirical probe against the real wrapper. Default to `"utf8"`; the `Buffer.isBuffer` branch already handles a Buffer return defensively, so either form is safe. Resolved: the probe confirms `"utf8"` works with `wouldMatch:1` against the real wrapper (see Validation Loop Results).
- Whether to also fix the writer/reader config-dir asymmetry (writer uses `homedir()/.claude`; reader uses the host config-dir helper, which honors `CLAUDE_CONFIG_DIR`). This is a real but separate latent bug that does not cause the current symptom (`CLAUDE_CONFIG_DIR` is unset in the affected environments). Declared **out of scope** here to keep the fix minimal; see "Out Of Scope / Known Related Issue."

## Context References

- `tweakcc_context_bonsai/patches/archived-filter.patch.ts:30-35` - `buildInjectedFilter`; the single line to change is the `__cbFs.readFileSync(__cbMarkerPath)` call inside the injected template string.
- `tweakcc_context_bonsai/patches/archived-filter.patch.test.ts:69-131,142-146` - injected-filter behavior tests and the `buildPatchedVisibilityPredicate` harness that currently injects real Node `fs`; regression guard goes here.
- `tweakcc_context_bonsai/patches/__fixtures__/runtime-helpers.fixture.js:4` - host's own `readFileSync(...,"utf8")` convention evidence.
- `tweakcc_context_bonsai/src/lib/compact.ts:74-76,86-112,126-132` - MCP marker writer/remover (Bun APIs: `Bun.file`/`Bun.write` under `homedir()/.claude`); confirms the write side is correct; do not change.
- `tweakcc_context_bonsai/patches/discovery.ts:102` - fs-helper discovery regex (matches `readFileSync`/`writeFileSync`/`existsSync` calls); confirms the discovered helper is the host wrapper. Do not weaken.
- `tweakcc_context_bonsai/docs/e2e-protocol.md` - Claude Code live e2e procedure (Protocol A); the live validation follows this.
- `tweakcc_context_bonsai/docs/semantic-anchor-analysis-2.1.143.md` - existing 2.1.143 anchor analysis; the fix does not change anchors, so anchor evidence is unaffected.
- `docs/context-bonsai-agent-spec.md` §4 (placeholder rendering), §6 (context transform), Invariants - the behavior this fix restores.
- `docs/agent-specs/context-bonsai-e2e-spec.md` disciplines 1-2 - verify from host state; the Secret Prune Oracle is load-bearing.
- `tweakcc_context_bonsai/docs/e2e-protocol.md` §"E2E-07 — Secret prune oracle (Protocol A)" (lines 367-410, harness at 390) - the self-contained live oracle procedure run from the side repo (`bun run e2e/native-e2e.ts protocol-a-oracle`). The parent-repo `docs/context-bonsai-e2e-template.md` is the shared scaffold but is NOT reachable from the side-repo working directory used by Live E2E commands; do not reference it from side-repo-cwd steps.

## Acceptance Criteria

- [ ] `buildInjectedFilter` calls the host fs helper's `readFileSync` with an explicit encoding argument confirmed to work against the real 2.1.143 wrapper (default `"utf8"`); the `Buffer.isBuffer(__cbRaw)` defensive branch is retained.
- [ ] No other behavior in the injected filter changes: same anchor/discovery, same `messages.filter` predicate on `__cbMessage.uuid`, same fail-safe `try/catch`, same `if(size>0)` guard.
- [ ] A regression test exercises a host-wrapper-style fs stub whose `readFileSync(path)` throws unless an encoding/options argument is supplied, and asserts the injected filter still reads the marker and filters the archived uuid. This test fails against the pre-fix code and passes against the fixed code.
- [ ] Existing injected-filter tests (marker read, rewrite pickup, empty-array, fail-safe for missing/empty/corrupt) still pass.
- [ ] `bun test` and `bun run typecheck` pass in `tweakcc_context_bonsai`, or any pre-existing unrelated baseline failures are recorded with reviewer/judge-approved exceptions.
- [ ] Fail-closed anchor discovery and ambiguity thresholds are unchanged (no weakening to force anything through).
- [ ] Live validation on a native `claude --version == 2.1.143` install with the rebuilt patch applied: MCP tools register; a contiguous prune **removes the archived range from the model-visible transcript** (verified from session/transcript state, not the tool's success string); retrieve restores it; Protocol A confirms a seeded secret cannot be recalled post-prune and the secret never entered the prune patterns/summary/index terms.
- [ ] Live evidence recorded in a new `tweakcc_context_bonsai/docs/e2e-results-2026-05-28-archived-filter-read-fix.md` (or actual run date) with command, exit codes, target version, scenario verdicts, and pointers to local-only artifacts; no secrets, credentials, auth paths, or full transcripts committed.
- [ ] The side repo working tree is clean before commit (investigation probe debris already removed; delete any residual untracked investigation files if present).
- [ ] Side repo is committed first; then the parent `tweakcc_context_bonsai` submodule pin is advanced; parent README/spec status for Claude Code is corrected only if its current wording is contradicted by the verified outcome.

## Implementation Tasks

1. Confirm starting state.
   - From `tweakcc_context_bonsai`: `git status --short` is clean; `git rev-parse HEAD` == `7a60c93`.
   - If any untracked investigation debris remains (e.g., a `cb-instrument-tmp.mjs`), delete it so the working tree is clean before edits.

2. Apply the read fix.
   - In `patches/archived-filter.patch.ts` `buildInjectedFilter`, change `__cbFs.readFileSync(__cbMarkerPath)` to `__cbFs.readFileSync(__cbMarkerPath, "utf8")` (use the form confirmed by the probe in Validation Loop Results). Change nothing else in the template string.

3. Add the regression guard.
   - In `patches/archived-filter.patch.test.ts`, add a NEW purpose-built wrapper-fs stub (do not reuse `__fixtures__/runtime-helpers.fixture.js`, which is only wired into the anchor/fail-closed tests) whose `readFileSync(path)` throws when called without an encoding/options second argument (mirroring the host wrapper) and returns the file contents when given one. Wire a variant of `buildPatchedVisibilityPredicate` to inject this stub instead of `nodeFs`, and add a test asserting the injected filter still reads the marker and filters the archived uuid. Keep at least one existing real-`nodeFs` test path so both fs shapes are covered.
   - Confirm the new test FAILS on the pre-fix template (encoding-less read) and PASSES on the fixed template; record both observations.

4. Run side-repo non-interactive validation (see Validation Commands).

5. Live behavioral validation on pinned native 2.1.143.
   - Assert `claude --version` is exactly `2.1.143`; stop otherwise.
   - Rebuild/apply the patch to the native install per `tweakcc_context_bonsai/README.md` / `docs/e2e-protocol.md` (`bun run apply`).
   - Confirm MCP registration (`claude mcp list`).
   - Drive a contiguous prune in a live session; verify from the session store / transcript that the archived range is absent from the model-visible context and a placeholder is shown; verify retrieve restores it.
   - Run Protocol A per `tweakcc_context_bonsai/docs/e2e-protocol.md` §"E2E-07 — Secret prune oracle (Protocol A)" (uses `bun run e2e/native-e2e.ts protocol-a-oracle`): seed a disposable secret, drive the prune by referring to the message (never quoting the secret), forbid further tool use, then confirm the model cannot produce the secret. Confirm the secret is absent from the prune patterns, summary, and index terms.
   - Record results in the new e2e-results doc. `BLOCKED` is permitted only for genuine environmental preconditions (e.g., missing credentials/sprite) and requires reviewer/judge approval before any release-gate PASS claim.

6. Commit and pin.
   - Commit side-repo changes (fix + test + e2e-results doc) with a body explaining the root cause and the live evidence.
   - Advance the parent `tweakcc_context_bonsai` submodule pin in the same turn as the judgment, per the per-story pin discipline.
   - Update parent README/`docs/agent-specs/claude-code-context-bonsai-spec.md` Claude Code status only if the verified outcome contradicts current wording; describe what is, not what was.

## Out Of Scope / Known Related Issue

- **Writer/reader config-dir asymmetry.** The MCP writer derives the marker path from `homedir()/.claude` (`src/lib/compact.ts:74`), while the injected reader derives it from the host config-dir helper, which honors `CLAUDE_CONFIG_DIR`. If a user sets `CLAUDE_CONFIG_DIR` to a non-default location, writer and reader diverge and prune silently no-ops again. This does not cause the present symptom (`CLAUDE_CONFIG_DIR` unset), so it is out of scope here. The writer also uses Bun runtime APIs (`Bun.file`/`Bun.write`) while the reader uses the host fs wrapper — a runtime-API asymmetry worth naming alongside the config-dir follow-up. Recommend a follow-up story to make the writer honor the same config-dir source as the reader. Do not fix either in this story.
- Gauge behavior, retrieve same-step guard, and the 2.1.156 forward-port (separate drafted plan) are unaffected; the corrected template string is version-agnostic and will be inherited by the 2.1.156 port automatically.

## Testing Strategy

- Unit/patch tests (`bun test`): existing injected-filter tests must stay green; the new wrapper-fs-stub regression test must fail pre-fix and pass post-fix. These are helper-mechanics tests (allowed as regression guards); they are not the acceptance evidence for the host seam.
- Typecheck (`bun run typecheck`): no type regressions.
- Live behavioral e2e (load-bearing acceptance): prune actually mutates the model-visible transcript on native 2.1.143, retrieve restores, Protocol A confirms no secret leakage. Verdicts come from session/transcript/host state, never from the tool's success string (e2e-spec discipline 1).

## Validation Commands

These are the source of truth for the developer's starting-state check and completion rerun; no runtime substitution.

### Side-Repo Non-Interactive Commands
- Working directory: `/home/basil/projects/context-bonsai-agents/tweakcc_context_bonsai`
  - `git status --short`
  - `git rev-parse HEAD`
  - `bun install`
  - `bun test`
  - `bun run typecheck`

### Live E2E Commands (classified live; require native 2.1.143 + ambient CLI auth)
- Working directory: `/home/basil/projects/context-bonsai-agents/tweakcc_context_bonsai`
  - `claude --version | grep '2.1.143'`
  - `bun run apply`
  - `claude mcp list`
  - `bun run e2e/native-e2e.ts protocol-a-oracle --session <session-jsonl> --secret <disposable-secret> --out <local-tmp>/protocol-a-oracle.json`
  - Protocol A and prune/retrieve visibility per the side repo's self-contained `docs/e2e-protocol.md` §"E2E-07 — Secret prune oracle (Protocol A)" (do not depend on the parent-repo template from this working directory). The secret literal must not appear in prune patterns, summary, or index terms. Credentials are provisioned out of band and never written to any artifact.

### Parent Final Verification
- Working directory: `/home/basil/projects/context-bonsai-agents`
  - `git -C tweakcc_context_bonsai log --oneline -3`
  - `git -C tweakcc_context_bonsai status --short`
  - `git status --short`
  - `git diff --submodule=short HEAD~1..HEAD`

## Worktree Artifact Check

- Checked At: `2026-05-28T21:05:00Z` (planner; implementer re-checks immediately before edits)
- Planned Target Files:
  - `tweakcc_context_bonsai/patches/archived-filter.patch.ts`
  - `tweakcc_context_bonsai/patches/archived-filter.patch.test.ts`
  - `tweakcc_context_bonsai/docs/e2e-results-2026-05-28-archived-filter-read-fix.md` (new)
  - parent `tweakcc_context_bonsai` submodule pin
  - parent `README.md` / `docs/agent-specs/claude-code-context-bonsai-spec.md` (conditional, status only)
- Overlaps Found (path + class): none for planned target files. The side repo working tree is clean as of re-check (earlier probe debris `cb-instrument-tmp.mjs` has been removed).
- Escalation Status: none required for planned targets.
- Decision Citation: Basil directed root-cause investigation and a validated plan for this fix.

## Plan Approval and Commit Status

- Approval Status: approved
- Approval Citation: Basil approved on 2026-05-28: "Approved. Commit and orchestrate".
- Plan Commit Hash: pending (recorded in a follow-up commit per repo convention)
- Ready-for-Orchestration: yes

## Validation Loop Results

- Empirical fix-form probe: PASS. Against the real 2.1.143 host wrapper: `readFileSync(path)` throws `'$.encoding'` (reproduces the bug); `readFileSync(path,"utf8")` succeeds (returns a Buffer, len 40, parses OK) and yields `wouldMatch:1` — the archived message is removed; `readFileSync(path,{encoding:"utf8"})` also works (returns a string, `wouldMatch:1`). Decision: use `"utf8"` (matches host convention; the existing `Buffer.isBuffer` branch handles the Buffer return).
- Iteration 1 (independent adversarial sub-agent review):
  - Missing details check: fail then fixed. HIGH: Protocol A / Live E2E referenced the parent-repo `docs/context-bonsai-e2e-template.md`, unreachable from the side-repo working directory; repointed to the side repo's self-contained `docs/e2e-protocol.md` §E2E-07 and the `bun run e2e/native-e2e.ts protocol-a-oracle` harness (verified present at `docs/e2e-protocol.md:367,390`).
  - Ambiguity check: pass. Encoding form resolved via probe (`"utf8"`, `wouldMatch:1`).
  - Factual corrections: HIGH — writer uses Bun APIs (`Bun.file`/`Bun.write`), not Node fs (verified `src/lib/compact.ts:96,100`); corrected throughout. MEDIUM — refined the "why tests passed" rationale (test bundle's own encoding-less sample + `nodeFs` injection; fixture `"utf8"` not used by the predicate harness) and made Task 3 require a NEW throwing stub. MEDIUM — probe debris already removed; debris references made conditional and the artifact check updated (verified side repo clean).
  - Reviewer-confirmed sound: one-line fix correct and version-agnostic (template string, not anchor); no weakening of fail-closed discovery; `3505c66` provenance; validation commands (`bun test`/`typecheck`/`apply`) exist.
  - Worktree artifact risk check: pass (no planned-target overlaps; side repo clean).
  - Plan-commit status check: pending user approval and plan commit.
- Iteration 2 (focused confirmation pass): PASS — no blocking gaps. Verified against the repo: Protocol A repointed to the reachable side-repo `docs/e2e-protocol.md` §E2E-07 (`:367,390`); writer-mechanism description matches `compact.ts:96,100` (Bun `Bun.file`/`Bun.write`); Task 3 requires a new throwing stub that fails pre-fix / passes post-fix; debris references conditional and side repo clean; fix target and validation commands (`apply`/`test`/`typecheck`) confirmed in `package.json`; HEAD == `7a60c93`.
- Iterations run: 2. Validation loop complete; no unresolved blocking gaps or high-impact ambiguities. Plan is validated and awaiting user approval before commit/orchestration.
