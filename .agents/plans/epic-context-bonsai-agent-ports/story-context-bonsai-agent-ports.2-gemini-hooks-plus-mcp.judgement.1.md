## Judge's Assessment

**Story**: CB-gemini.1 — Gemini CLI hooks-plus-MCP implementation
**Iteration**: 1 of 5 maximum
**Date**: 2026-04-23

---

### Summary

| Verdict | Count |
|---------|-------|
| APPROVED (must fix) | 6 |
| APPROVED (should fix) | 2 |
| REJECTED (over-engineering) | 0 |
| REJECTED (out of scope / premature) | 3 |
| REJECTED (not valid) | 0 |
| DEFERRED to later iteration | 2 |

### Verified Validation Results

- **Starting commit:** side `9eb0c74` + `8624e57`, agent `aafc21585` (reviewer-verified; judge re-verified via `git show --stat`)
- **Pre-existing failures (reviewer-reproduced):** none
- **HEAD results:** side repo 67/67 vitest green (judge re-ran); agent CLI subset 290/290, core subset 176/176 (per reviewer; not re-run by judge — reviewer's evidence is internally consistent)
- **Regressions:** none
- **Regression gate:** clear

---

### Overall Verdict

**NEEDS REVISION**

This is iteration 1 of 5. The MCP transport half of the story landed cleanly and is well-tested.
The hooks half — guidance injection, in-band gauge, structured-placeholder re-rendering, pattern
resolution at the mutation boundary, and the core hook-translator seam — is entirely missing from
the agent repo, even though the story plan explicitly lists those files as "Files Modified (agent
repo)". Three shared-spec MUSTs are unmet (§1 system guidance, §2 pattern resolution before
mutation, §7 in-band gauge) and the plan-required core seam in `packages/core/src/hooks/*` was not
touched. The dev was honest about the partial delivery, which is valuable, but acceptance criteria
remain unmet.

Plenty of iteration headroom remains (4 left). Focus iteration 2 on closing the hook-path gap and
the two correctness-of-seam HIGHs. Defer stylistic / quality-of-life items.

---

### Finding-by-Finding Evaluation

#### [C1] Gauge/guidance hooks never registered at runtime
- **Reviewer's Issue**: `registerBonsaiHooks`, `applyBonsaiBeforeModel`, `BONSAI_GUIDANCE` are
  exported from the side repo but have no call sites in `packages/`. Spec §1 (guidance) and §7
  (in-band gauge) are MUST-level behavioral requirements; §4 placeholder re-rendering requires
  a pre-model rewrite path. None happens at runtime.
- **Verdict**: **APPROVED (must fix)**
- **Reasoning**: Confirmed by `grep -rn "registerBonsaiHooks\|applyBonsaiBeforeModel\|BONSAI_GUIDANCE" packages/`
  → zero hits. Spec §1 and §7 are MUST-level. The plan lists `gemini.tsx`, `AppContainer.tsx`,
  and `acpClient.ts` as "Files Modified (agent repo)" precisely for this wiring and none of
  them were touched (verified via `git log --oneline --all -- <path>`; only pre-existing
  commits exist on those files). The gemini-cli-context-bonsai-spec is unambiguous: "If request
  mutation hooks are unavailable, prune/retrieve MUST not claim parity." Full parity is the
  story target; this is a blocking correctness gap.
- **Guidance for the fix**:
  - Call `registerBonsaiHooks(adapter)` once at CLI startup (likely in `gemini.tsx` for
    interactive, and `acpClient.ts` for ACP) against a concrete adapter that bridges
    `BonsaiHookAdapter` to the Gemini `HookRegistry`/`HookSystem`.
  - Make `applyBonsaiBeforeModel` reachable through the `BeforeModel` hook path so the gauge
    text and structured placeholders are emitted against the outbound request contents.
  - Source `tokenUsage`/`tokenLimit` for the gauge from the real Gemini request path
    (`geminiChat.ts` / `tokenLimits.ts`). Leave gauge silent when usage is unavailable, per
    spec §7 fallback.
  - Source `sessionId` + `archiveDir` from the same `Storage` instance the rest of the CLI
    uses (see H3 below).

#### [C2] Pattern resolution not implemented in MCP server — spec §2 violation
- **Reviewer's Issue**: `mcp-server.ts:93-104` does not call `resolveBoundary(...)` from
  `guards.ts`. The MCP server uses caller-supplied `anchor_id`/`range_end_id` or falls back to
  using the patterns as ids, then mutates archive state. Spec §2 requires boundary resolution
  BEFORE any mutation, with deterministic ambiguity errors.
- **Verdict**: **APPROVED (must fix)**
- **Reasoning**: Verified by reading `mcp-server.ts` lines 78–140 and confirming `resolveBoundary`
  is exported from `guards.ts` but never imported by `mcp-server.ts` (`grep resolveBoundary src/mcp-server.ts`
  → no hits). The MCP server runs as a stdio subprocess with no transcript access, so resolution
  must happen agent-side before the tool invocation (or the side repo must expose a transcript
  snapshot via IPC). The current design silently accepts ambiguous patterns and stores them as
  ids, which is the opposite of the spec's "fail deterministically, perform no mutation"
  requirement.
- **Guidance for the fix**: Pick one of:
  1. **Agent-side pre-resolution** (simpler, preferred): move pattern resolution into the
     `BeforeTool`/tool-dispatch path so `resolveBoundary(transcript, args)` runs against the
     current Gemini chat history and the resolved `anchor_id`/`range_end_id` are passed through
     to the MCP tool call. The MCP server then reliably receives ids and the current "state-only"
     mode becomes correct by contract. Reject the tool call deterministically when resolution
     fails.
  2. **Transcript snapshot via env/IPC** (heavier, not recommended for iter 2): hand the MCP
     server a transcript snapshot per turn. Adds complexity without buying much over (1).
  Either way, remove the "fall back to patterns as ids" path in `mcp-server.ts`. If the
  resolver is unavailable, return a deterministic compatibility error.

#### [C3] Core hook-translator seam not implemented
- **Reviewer's Issue**: `packages/core/src/hooks/hookEventHandler.ts`, `hookTranslator.ts`,
  `types.ts` are all unchanged. Without the structured-history seam, `applyBonsaiBeforeModel`'s
  placeholder re-render can never survive text-only translation.
- **Verdict**: **APPROVED (must fix)**
- **Reasoning**: Verified: `git show aafc21585 --stat | grep hooks/` returns nothing; the story
  plan explicitly lists those three files as "Files Modified (agent repo)" (lines 102–104 of
  the story). Gemini-spec Capability Evidence Matrix explicitly flags "Transcript fidelity
  through hooks" as Partial precisely because the translator is text-oriented, which is the
  whole reason the narrow core seam was scoped into this story. Without it, C1's placeholder
  fidelity is lossy even after C1 is fixed.
- **Guidance for the fix**: Follow the plan literally. Add a structured-history payload type
  in `types.ts`, thread it through `hookEventHandler.ts`, and have `hookTranslator.ts` preserve
  the structured bonsai placeholder envelope instead of flattening it to text. Keep the seam
  narrower than the bonsai logic on top — it should know about "structured content that must
  round-trip unchanged", not about bonsai specifically.

#### [H1] No test proves placeholder reaches model in real request path
- **Reviewer's Issue**: All existing tests verify pure-logic behavior or seam shape. No test
  constructs an LLM request, runs it through the hook system, and asserts `[PRUNED: …]` in the
  outbound payload.
- **Verdict**: **APPROVED (must fix)** — required once C1/C2/C3 exist
- **Reasoning**: Gemini-spec E2E Priorities explicitly lists "proof that placeholders are
  model-visible in the actual request path" as a priority. The acceptance criterion
  "Validation commands cover both CLI and core test surfaces that are touched" in the story
  also requires this. Without such a test, parity claims cannot be backed up, which the spec
  flags as a fail-closed condition. That said, this test is only meaningfully writable AFTER
  C1+C3 land, so the fix ordering is: land C1/C3, then add the E2E test in the same iteration.

#### [H2] Silent degradation in untrusted CWD
- **Reviewer's Issue**: `mcp-client-manager.ts:476,591` `!isTrustedFolder()` → early return,
  built-in bonsai server silently dropped. Gemini-spec Fail-closed: "If request mutation hooks
  are unavailable, prune/retrieve MUST not claim parity." No warn emitted when the trusted-
  folder gate drops bonsai.
- **Verdict**: **APPROVED (should fix)**
- **Reasoning**: Verified at `packages/core/src/tools/mcp-client-manager.ts:476,591`. The
  fail-closed requirement from the spec demands explicit deterministic notification when a
  required primitive (the MCP transport) is unavailable. A warn-level console log when
  `context-bonsai` is dropped for trusted-folder reasons satisfies the contract without
  weakening the security posture. Low-complexity fix (~3 lines). Could also just leave the
  trusted-folder check as-is for third-party servers but log specifically when
  `context-bonsai` is the one being dropped.
- **Guidance**: Add a one-shot warn log at the point where the bonsai server would have been
  started but was dropped due to untrusted CWD. Do not change the gate itself.

#### [H3] Dual `Storage.initialize()` calls
- **Reviewer's Issue**: `config.ts:887-888` creates and initializes a `bonsaiStorage` only to
  pull `getProjectTempDir()` off it, then `new Config(...)` constructs another `Storage(targetDir, sessionId)`
  which also calls `initialize()`. ProjectRegistry is shared on-disk state.
- **Verdict**: **APPROVED (should fix)** — but narrow-scope fix only
- **Reasoning**: Verified in `config.ts`. ProjectRegistry uses `proper-lockfile`, so this is
  not a data-corruption bug, but it is wasteful (double migration, double lock) and architecturally
  wrong — it creates a second `Storage` for the same project and throws it away. The clean fix is
  a tiny refactor: expose `Storage.getProjectTempDir()` as a static given `(cwd, sessionId)` OR
  compute the temp dir path directly without instantiating a second `Storage`. Low complexity.
- **Guidance**: Either (a) extract the path computation into a static helper on `Storage` that
  does not require `initialize()`, or (b) have `loadCliConfig` construct the `Storage` once,
  initialize it once, and pass it through to `Config` instead of letting `Config` build its own.
  Prefer whichever the gemini-cli codebase style already supports. Do not broaden this to a
  wider `Storage` refactor.

#### [H4] No `sanitizeFilenamePart` applied to sessionId at injection time
- **Reviewer's Issue**: Env var `CONTEXT_BONSAI_SESSION_ID` is set to the raw sessionId; side
  repo sanitizes before filename use. Refactor-fragile.
- **Verdict**: **REJECTED (premature / not a real hazard today)** — document for future
- **Reasoning**: Child processes receive env vars as a map, not a shell line. The consuming
  side (`ArchiveStore`) already sanitizes before filename construction. There is no current
  code path where the raw sessionId can cause filesystem or injection harm. This is a defence-
  in-depth nit, not a correctness issue. Adding double sanitization now risks divergent
  normalization behavior between the agent side (sanitized) and the side-repo side
  (double-sanitized → potentially different filenames than an earlier session).
- **Action**: If the dev or reviewer still wants this, it can be handled later. Not approved
  for iter 2.

#### [M1] `extendAllowedMcpServersForBonsai` exported but never called
- **Reviewer's Issue**: Allowlist bypass is handled via name carve-out in `mcp-client-manager.ts`.
  The exported helper has no call site.
- **Verdict**: **APPROVED (should fix)** — either remove or call it
- **Reasoning**: Verified: only callers in the codebase are the helper's own unit tests.
  Dead public API is a real quality issue because it gives the next maintainer two sources of
  truth on how the allowlist is carved out. The story plan called out the allowlist carve-out
  as a single concept; the code now has two half-implementations of it. Either (a) delete
  `extendAllowedMcpServersForBonsai` plus its tests (the carve-out in `mcp-client-manager.ts`
  is sufficient) or (b) call it from the appropriate config-assembly point and remove the
  name carve-out. Prefer (a): the name carve-out inside `mcp-client-manager.ts` is the narrower
  seam and is already the effective implementation. This also resolves a chunk of M2.

#### [M2] Two sources of truth for `'context-bonsai'` literal
- **Reviewer's Issue**: `CONTEXT_BONSAI_MCP_SERVER_NAME` declared in both `mcp-client-manager.ts:39`
  and `contextBonsaiBootstrap.ts:35`. The bootstrap test enforces equality via deep-import,
  which is fragile.
- **Verdict**: **APPROVED (should fix)**
- **Reasoning**: Verified at both locations. The same literal is defined twice. Correct fix
  is tiny: the core package already exports the constant from `mcp-client-manager.ts`; the
  CLI-side shim should import it from `@google/gemini-cli-core` rather than declaring its own.
  Add the constant to the core package's public `index.ts` exports if it isn't already, and
  drop the redundant declaration in `contextBonsaiBootstrap.ts`. Low complexity; directly
  improves correctness-at-refactor-time.

#### [M3] `config.test.ts` loosening from `.toEqual` to `.toMatchObject`
- **Reviewer's Issue**: 4 of 5 changed sites use `.toMatchObject` which doesn't detect extra
  unexpected keys; only one site uses the key-filter pattern. Loses regression detection.
- **Verdict**: **APPROVED (should fix)** — small, consistent
- **Reasoning**: Verified by inspecting the diff in `aafc21585` for `config.test.ts`. The
  key-filter pattern at the one site (lines 1799–1804) is the correct shape: filter out
  `context-bonsai` and then assert exact size/shape of the remaining map. The other four
  sites silently accept arbitrary extra keys beyond the bonsai injection. Fix is mechanical
  (~15 LOC). Does protect against future accidental MCP-server injection regressions.

#### [M4] `mcp-server.ts` auto-run heuristic fragile
- **Reviewer's Issue**: `/mcp-server\.(m?js|ts)$/.test(process.argv[1])` can miss (loader
  renames argv) or false-positive (user launches a file named `mcp-server.js` that somehow
  imports this module).
- **Verdict**: **REJECTED (premature / pragmatic guard is fine for v1)**
- **Reasoning**: Verified at `mcp-server.ts:396-409`. The agent repo launches this artifact
  with `process.execPath args:[<absolute path to dist/mcp-server.js>]`, so argv[1] is the
  literal dist path and the regex matches. Tests pass because vitest's argv[1] does not
  match the regex. The failure modes the reviewer names (loader renames, user-named
  argv[1]) are unlikely-in-current-usage, and changing to a `process.argv[1] === fileURLToPath(import.meta.url)`
  check would be cleaner but is not worth delaying correctness-blocking work for. Revisit
  in a later iteration if the story still has budget.
- **Action**: Not approved for iter 2. Acceptable tech debt.

#### [L1] Commit subject "scaffold" undersells scope of 9eb0c74
- **Verdict**: **REJECTED (cosmetic)**
- **Reasoning**: Non-issue. Don't rewrite history over commit wording.

#### [L2] `dist/` shipped via `files: [...]` but no `prepare` / `prepublishOnly` build hook
- **Verdict**: **DEFERRED to later iteration**
- **Reasoning**: Verified in `package.json`. Fresh `npm install` through the `file:` dep would
  not rebuild `dist/`. The current repo state works because `dist/` is already built and
  tracked locally, but this is fragile across machines. The clean fix is a one-line
  `"prepare": "npm run build"` in the side-repo `package.json`. Defer to iter 2 or 3 as
  part of packaging hygiene; low impact on the primary correctness work and the dev will
  be busy with C1–C3.

---

### Loop/Conflict Detection

**Previous Iterations**: 0 (this is iter 1)
**Recurring Issues**: n/a
**Conflicts Detected**: none
**Assessment**: Healthy start. Dev was honest about which half landed. No loop risk yet.

---

### Recommendations

**NEEDS REVISION** — the developer should address these approved items in iteration 2, in this
rough order of priority:

1. **[C1]** Wire runtime hook registration at CLI startup (interactive path in `gemini.tsx`,
   ACP path in `acpClient.ts`). Construct a concrete `BonsaiHookAdapter` that bridges to the
   Gemini `HookRegistry`/`HookSystem`. Feed real token counts and model limits into the gauge.

2. **[C3]** Add the narrow structured-history seam in
   `packages/core/src/hooks/hookEventHandler.ts`, `hookTranslator.ts`, and `types.ts`. Keep
   it bonsai-agnostic (it should know about "structured content that must round-trip"), and
   make sure the placeholder envelope from `placeholder.ts` survives translation.

3. **[C2]** Move pattern resolution out of the MCP server and into the agent-side tool-
   dispatch path so `resolveBoundary` runs against the real transcript before the tool call
   is issued. The MCP server should receive resolved ids. Remove the "fall back to patterns
   as ids" escape hatch in `mcp-server.ts`; fail deterministically if resolution is
   unavailable.

4. **[H1]** Add at least one integration test that constructs a Gemini LLM request, runs it
   through the hook system after a prune, and asserts `[PRUNED: …]` appears in the outbound
   payload. This is the model-visibility proof the spec requires.

5. **[H2]** Emit a warn-level log when `context-bonsai` is dropped by the trusted-folder gate
   in `mcp-client-manager.ts` (don't change the gate).

6. **[H3]** Eliminate the second `Storage` construction in `config.ts` — either expose a
   static path helper on `Storage` or construct once and pass through.

7. **[M1]** Remove the unused `extendAllowedMcpServersForBonsai` helper and its tests. The
   name carve-out inside `mcp-client-manager.ts` is the effective implementation; keep that.

8. **[M2]** Drop the duplicate `CONTEXT_BONSAI_MCP_SERVER_NAME` declaration in
   `contextBonsaiBootstrap.ts`; import it from `@google/gemini-cli-core` instead (add to the
   core package's public exports if not already). Update the one test that currently
   deep-imports to reuse the public export.

9. **[M3]** Convert the remaining four `.toMatchObject` sites in `config.test.ts` to the
   key-filter pattern already used at line 1799.

**Rejected / deferred (do NOT address in iter 2):**
- **[H4]** Env-var sanitization: not a real hazard today; document and move on.
- **[M4]** mcp-server auto-run heuristic: pragmatic guard works; revisit later iteration.
- **[L1]** Commit subject wording: cosmetic.
- **[L2]** `prepare` script: deferred to iter 3 as packaging hygiene.

---

### Complexity Guard Notes

Deliberately not approved to prevent over-engineering iteration 2:

- **H4 (env-var sanitization)**: Adding double-sanitization creates a second normalization
  seam that must track the first one. Not warranted for a non-hazard.
- **M4 (auto-run heuristic refinement)**: Switching to `import.meta.url`-based detection is
  cleaner in principle but would not fix any current breakage. Defer until someone observes
  a real launch-shape problem.
- **L2 (build hook)**: Approved to defer. A one-line `prepare` script is fine, just not the
  priority while correctness gaps exist.

Iteration budget reminder: this is iter 1 of 5. Focus iter 2 on C1/C2/C3 plus the two
correctness-of-seam HIGHs and the mechanical quality items. If C1/C2/C3 are nontrivial,
the dev may split the work over iter 2 + iter 3 — that is acceptable. Do not land parity
claims until C1 is resolved (per gemini-cli-context-bonsai-spec fail-closed requirement).
