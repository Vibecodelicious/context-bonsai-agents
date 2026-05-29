# Story: Make Prune Success Trustworthy — Fix Runtime-Patch Detection And Error Surfacing On Claude Code/tweakcc

## Goal

Restore trustworthy Context Bonsai prune behavior on the Claude Code / tweakcc port for the launch shape Basil actually runs: a natively-installed, version-named Claude binary started directly (no `--resume`). Today, a prune against that runtime returns a **success-shaped** tool result while archiving **nothing**, so the model still sees the content the user asked to prune. Two independent defects compose to produce that experience:

- **Defect A — false-negative patch detection.** The MCP server's pre-prune guard `assertRunningClaudeHasArchivedFilterPatch` cannot identify the running binary, so it concludes the patch is absent and refuses the prune — even though the running binary carries the patch.
- **Defect B — refusals shaped as successes.** Every deterministic failure/refusal is returned via `plainText(...)` with no `isError`, so the host renders the refusal as a successfully-completed tool call. The "Error:" text is just a string inside a success result.

The story fixes both and gates completion on a behavioral e2e that reproduces Basil's experience (prune appears to succeed; content remains) on the pinned native target, and proves the fix end to end. Per the spec-first rule, Defect B introduces a small shared-spec clause first (failures must be surfaced through the host's error channel, not presented as successful operations); Defect A is a conformance fix already covered by the spec's no-silent-no-op intent and needs no spec change.

## Root Cause (confirmed, evidence-backed)

Verified against the running binary `/home/basil/.local/share/claude/versions/2.1.143-cbfix` (the literal process serving the current session; `claude --version` reports `2.1.143`) and the source at side-repo `HEAD` (`bfb12e3`).

### Defect A — the guard cannot find the running binary

The guard chain is `assertRunningClaudeHasArchivedFilterPatch` (`mcp-server/index.ts:327`) → `resolveRunningClaudeExecutableCandidates` (`:240`) → `archivedFilterPatchPresentInAny` (`:313`) → `fileContainsSentinel` (`:291`). The sentinel scan (Step B of detection) is correct and was reproduced by hand: the running binary contains exactly one `/*cb:archived-filter:v1*/` sentinel and the fixed `readFileSync(__cbMarkerPath, "utf8")` form. The break is in *finding which file to scan* (Step A):

- `findClaudeProcessContext` (`:192`) collects executable candidates **only inside an `if (sessionId)` branch** (`:210`-`:231`), where `sessionId` comes from a `--resume`/`resume <id>` token in a process's argv (`sessionIdFromArgv`, `:157`). This session has no `--resume`, so no sessionId is found and the function returns `null`.
- The fallback `findClaudeAncestorExecutableCandidates` (`:249`) only treats a process as Claude when `argv[0] === "claude" || endsWith("/claude") || argv.some(a => a.includes("@anthropic-ai/claude-code"))` (`:267`). This session's `argv[0]` is the versioned path `…/versions/2.1.143-cbfix`, which matches none, so `looksLikeClaude` is false and it returns `[]`.
- With zero candidates, `assertRunningClaudeHasArchivedFilterPatch` returns `false` (`:329`-`:331`), and the prune refuses at `:607`-`:608`.

The most reliable signal — `readlink(/proc/<pid>/exe)`, which resolves directly to the running binary — is read at `:221` and `:278` but **only after** a process has already passed the sessionId or argv-name gate. For a directly-launched native binary, the gate never passes, so the authoritative exe link is never consulted. The detection logic is modeled on the npm `cli.js` / `claude`-shim launch path, while the project's own run vehicle is the native version-named binary (e.g., its own e2e docs apply against `…/.local/share/claude/versions/2.1.143`).

Process-tree evidence (this session, verified live): MCP server PID = `bun run …/mcp-server/index.ts` (its own `/proc/self/exe` is `~/.bun/bin/bun`; `bun run` does NOT exec-replace into the script), its **direct parent** = `…/versions/2.1.143-cbfix` (cmdline has no `--resume`), whose `/proc/<pid>/exe` resolves straight to the patched binary; then `bash` → `konsole`. There is no intermediate `bun`/shell between the MCP server and Claude for this shape. The current code simply never consults that exe link because the gate never passes.

**Correct fix shape (validated against existing code).** Session discovery is the precedent: `discoverSessionPath` (`mcp-server/index.ts:463-490`) calls `findClaudeProcessContext` first, gets `null` for the no-`--resume` shape, then falls through to a cwd-based fallback (`findCurrentSession`, `src/lib/session.ts:35`) that matches the project's `history.jsonl` independent of `--resume`. So prune's *session discovery already works* for Basil's shape; only the *patch guard* lacks the equivalent fallback. The fix is to give the guard an analogous launch-shape-independent path: walk ancestors from the MCP server's pid up to pid 1, and for each ancestor consider `readlink(/proc/<pid>/exe)`, scanning each resolved exe for the sentinel (Step B remains the gate). Do not stop at the immediate parent only — under `--resume`/npm launches the immediate parent may be a `node`/shim, so the walk must continue. Do NOT collect argv-derived `cli.js` candidates for the guard (see false-positive note below).

### Defect B — refusals are returned as success-shaped results

`plainText` (`:129`) returns `{ content: [{ type: "text", text }] }` with no `isError` field, and `isError` appears nowhere in the file. Successes use `successResponse` (`:336`). Every deterministic failure/refusal returns through `plainText`: `:604` (invalid args), `:608` (patch missing — the one in Basil's experience), `:615`/`:622`/`:641`/`:746`/`:753` (compatibility), `:631` (boundary resolution error), `:635` (matcher order), `:716` ("prune failed"), `:739` (invalid retrieve args), `:762` (retrieve not found), `:767`/`:785` (retrieve not archived). Because none set `isError`, the host treats each as a completed, successful tool call whose body merely begins with "Error:". This is the transport-layer instance of "looked like it worked but didn't."

### Why existing tests did not catch either defect

- **Defect A:** there is **no test for the discovery layer.** `index.test.ts` "patch-presence guard" tests (`:227`-`:313`) exercise only the sentinel *scanner* with a directly-supplied path / injected `assertArchivedFilterPatchPresent` dep — they never simulate `/proc` process discovery, so `resolveRunningClaudeExecutableCandidates` / `findClaudeProcessContext` / `findClaudeAncestorExecutableCandidates` are entirely unexercised. The fallback shipped in commit `485581d` ("Fix interactive MCP patch guard") changed only `index.ts` (+48/−1) and touched **no test file**. The requirement "identify the running binary however it was launched" was never pinned by a test, so nothing forced generalization beyond the one observed launch shape.
- **Defect B:** no test asserts the *shape* of a failure result (`isError`). Tests assert failure *text* (e.g., "prune fails closed … when patch sentinel is absent", `:261`), which passes whether or not `isError` is set.

## User Model

### User Gamut
- Examples only, spanning broad dimensions:
  - Claude Code users on the native installer (the common `~/.local/share/claude/versions/<v>` layout) who launch the binary directly and currently get a silently-refused prune.
  - The maintainer (Basil) dogfooding Context Bonsai in this very session — the concrete reporter of the experience.
  - A security-minded user trusting the Secret Prune Oracle: a refusal that looks like success is a confidentiality hazard (they believe a secret was archived when it was not).
  - Maintainers forward-porting across Claude Code releases who need detection that does not depend on launcher naming or invocation flags.
  - Reviewers who must distinguish a real behavioral fix from green-unit-tests-only claims.
  - Downstream port owners (OpenCode, Codex, Gemini, Cline, Kilo, Pi) who read this port as the Claude Code reference and who also need "a failure must not look like a success" to hold on their transports.

### User-Needs Gamut
- Examples only, spanning broad dimensions:
  - Truthful outcomes: if prune reports success, content is actually archived; if it cannot guarantee that, it fails **visibly**, never as a success.
  - Launch-shape independence: detection works for native version-named binaries, npm `cli.js`, `--resume` resumes, and fresh interactive sessions alike.
  - Fail-closed safety preserved: when the running binary genuinely cannot be identified or is genuinely unpatched, prune still refuses (does not loosen into scanning arbitrary on-disk files), and that refusal is surfaced as an error.
  - No dangerous false-positive: the guard scans the **actual running binary**, not an unrelated patched file that happens to be on disk.
  - Regression durability: the discovery layer and the failure-result shape are both pinned by tests that fail pre-fix and pass post-fix.
  - Auditability: behavioral evidence drawn from host/session state, not the tool's success string; no secrets or credentials in artifacts.

### Ambiguities From User Model
- **How permissive should binary recognition be, and where does the walk stop?** Resolved: candidates MUST derive from `readlink(/proc/<pid>/exe)` of a real ancestor process — never a directory scrape or guessed install location. Walk ancestors from the MCP server pid up to pid 1; consider each ancestor's exe; the sentinel scan (Step B) is the gate. This mirrors the existing `discoverSessionPath` fallback (`index.ts:469-488`); model the guard fix on that pattern rather than inventing a new traversal.
- **False-positive vector — argv-derived candidates.** `executableCandidatesFromArgv` (`index.ts:176-190`) currently pushes argv `cli.js`/`@anthropic-ai/claude-code` paths into the candidate set, and `archivedFilterPatchPresentInAny` (`:313`) returns true if ANY candidate has the sentinel. A stale/other patched `cli.js` on disk could then satisfy the guard while a different binary is actually running — the dangerous false-positive. Resolved: the guard MUST scan only exe-of-ancestor paths; either drop argv-derived candidates from the guard path or document explicitly why they are safe. (Argv-derived candidates may remain for any non-guard use.)
- **Scope of Defect B fix.** Resolved: route **all** deterministic failure returns through an `isError` helper (the defect is systemic), not just the patch-missing path; the patch-missing path is the load-bearing one for the e2e. Note `index.ts:716` ("prune failed") is a post-mutation `catch` (mutation began at `:654`), i.e., a partial-failure, not a pre-mutation refusal — tagging it `isError` is still correct, but categorize it accurately (do not call it a pure deterministic pre-mutation refusal). Ambiguity/boundary errors (`:631`, from `resolveUniqueBoundary` throws) are retry-expected "be more specific" errors; `isError` does not impede the model reading the text and retrying (content is preserved).
- **Does Defect B need a shared-spec change?** Resolved: yes, a small clause — it is cross-port behavior. The clause must reconcile with the existing "failures MUST be plain text" wording (`docs/context-bonsai-agent-spec.md:156,177`): `isError:true` does not contradict plain-text *content*; it governs the result's error *channel/flag*. Defect A needs no strict spec change (covered by the no-silent-no-op intent at `:326`; this is the inverse — a false refusal — still a conformance fix), though an optional one-line "detection MUST be launch-shape independent" clause would harden it.
- **E2E is net-new launch+assert infrastructure, not an extension (scope decision — see Open Scope Decision).** `e2e/native-e2e.ts` never launches Claude (offline JSONL analysis only, `:67-76`); `docs/e2e-protocol.md` launches exclusively via the `claude` shim / `sprite exec` (`:112-115,154,290`), never the direct versioned path. Reproducing Basil's experience requires NEW capability: launch `~/.local/share/claude/versions/<v>` directly with no `--resume`, and assert that shape (e.g., read `/proc/<claude-pid>/cmdline`, confirm argv[0] is the versioned path and no `--resume` token).

## Context References

### Relevant Codebase Files (must read)
- `tweakcc_context_bonsai/mcp-server/index.ts:240-289` — `resolveRunningClaudeExecutableCandidates`, `findClaudeProcessContext`, `findClaudeAncestorExecutableCandidates`; the Defect A discovery layer to fix. Preserve `findClaudeProcessContext`'s session-discovery role (it also returns `sessionId`/`cwd` used elsewhere); change only how executable candidates are identified.
- `tweakcc_context_bonsai/mcp-server/index.ts:291-334` — `fileContainsSentinel`, `archivedFilterPatchPresentInAny`, `assertRunningClaudeHasArchivedFilterPatch`; the sentinel scan (correct, do not change) and the assert that returns false on empty candidates.
- `tweakcc_context_bonsai/mcp-server/index.ts:129-131,336-339` — `plainText` / `successResponse`; Defect B lives here (no `isError`).
- `tweakcc_context_bonsai/mcp-server/index.ts:604,608,615,622,631,635,641,716,739,746,753,762,767,785` — every deterministic failure return to route through the new `isError` helper.
- `tweakcc_context_bonsai/mcp-server/index.ts:138-155,176-190` — `readParentPid`, `splitProcCmdline`, `executableCandidatesFromArgv`; the proc primitives that need an injectable seam for unit testing. `executableCandidatesFromArgv` is the argv-derived candidate source to exclude from the guard path.
- `tweakcc_context_bonsai/mcp-server/index.ts:463-490` — `discoverSessionPath`: the existing launch-shape-independent fallback pattern (cwd-based) the guard fix should mirror.
- `tweakcc_context_bonsai/src/lib/session.ts:35` — `findCurrentSession`: the `--resume`-independent session match used by that fallback.
- `tweakcc_context_bonsai/mcp-server/index.ts:75-78,595-601,858-868` — `PruneDependencies` injection pattern; mirror it for the injectable proc-reader seam.
- MCP SDK `CallToolResult` supports optional `isError` (`@modelcontextprotocol/sdk` types) — confirmed available; setting it is valid and transport-safe.
- `tweakcc_context_bonsai/mcp-server/index.test.ts:227-313` — existing patch-presence (scanner) tests; the new discovery-layer and result-shape tests go alongside.
- `tweakcc_context_bonsai/patches/archived-filter.patch.ts` — the patch that embeds the `/*cb:archived-filter:v1*/` sentinel (context only; not modified here).
- `tweakcc_context_bonsai/docs/e2e-protocol.md` — side-repo self-contained live e2e procedure (Protocol A / native harness); the new e2e scenario extends this.
- `tweakcc_context_bonsai/e2e/native-e2e.ts` — native e2e harness to extend with the bug-shape launch scenario.
- `tweakcc_context_bonsai/docs/semantic-anchor-analysis-2.1.143.md` — anchors unaffected (no patch-template change here).

### Relevant Documentation
- `docs/context-bonsai-agent-spec.md` §2 "Output rules", "Policy and Safety Constraints" (`Unsupported runtime states MUST not silently no-op when the model believes pruning succeeded`), Invariants — the contract Defect A violates and the place the Defect B clause is added.
- `docs/agent-specs/context-bonsai-e2e-spec.md` disciplines 1 (verify from host state), 2 (Secret Prune Oracle), 5 (BLOCKED ≠ FAIL) — the e2e disciplines this story's gate obeys.
- `docs/agent-specs/claude-code-context-bonsai-spec.md` — per-agent notes; update if the verified outcome contradicts current wording.
- Provenance: commit `485581d` ("[Story 8] Fix interactive MCP patch guard") introduced the untested fallback; `5d1136b` ("[Story 7] Add MCP patch presence guard") introduced the scanner + tests.

## Acceptance Criteria

- [ ] **Defect A fix.** The guard identifies the running Claude binary by walking ancestors from the MCP server pid to pid 1 and scanning each ancestor's `readlink(/proc/<pid>/exe)` for the sentinel, independent of `--resume` and `argv[0]` naming — mirroring the existing `discoverSessionPath` cwd-fallback pattern (`index.ts:463-490`). For a directly-launched native version-named binary with no `--resume`, the guard resolves to the actual running binary and (when patched) returns `true`. The walk does not stop at the immediate parent only.
- [ ] **Guard scans only exe-of-ancestor; no argv-derived candidates.** The guard path excludes `executableCandidatesFromArgv` output (`index.ts:176-190`), or documents explicitly why those are safe, to remove the false-positive vector where a stale/other patched `cli.js` satisfies the guard while a different binary runs.
- [ ] **No regression in other launch shapes.** npm `cli.js` launch, `claude`-shim launch, and `--resume` resume all still resolve to the correct running binary. `findClaudeProcessContext`'s session-discovery outputs (`sessionId`, `cwd`) and `discoverSessionPath` behavior are unchanged.
- [ ] **Fail-closed preserved.** When no Claude ancestor can be identified, or the identified binary genuinely lacks the sentinel, the guard returns `false` and the prune refuses. Detection is NOT loosened into scanning arbitrary on-disk files or guessed install directories. No dangerous false-positive (scanning a patched binary other than the one running).
- [ ] **Discovery layer is testable and tested.** A minimal injectable proc-reader seam is added so discovery can run against synthetic `/proc` trees. New unit tests cover, at minimum: (1) direct native version-named binary, no `--resume` (Basil's shape) → resolves to that binary; (2) npm `cli.js` launch → resolves; (3) `--resume` launch → resolves and yields the sessionId; (4) no Claude ancestor → empty/fail-closed. Test (1) FAILS against the pre-fix code and PASSES against the fixed code; record both observations.
- [ ] **Defect B spec clause first.** `docs/context-bonsai-agent-spec.md` §2 Output rules gains a clause requiring deterministic failures to be surfaced through the host's error channel (e.g., MCP `isError`) so a refusal is never presented to the host/user as a successful operation. Committed before the implementation commit that depends on it.
- [ ] **Defect B fix.** A failure-result helper sets `isError: true`; all deterministic failure/refusal returns in `mcp-server/index.ts` route through it (the 14 sites listed in Context References). Successes are unchanged. Return types are widened to include the optional `isError`.
- [ ] **Defect B test.** A unit test asserts the patch-missing refusal (and at least one other failure path) returns `isError === true` and is NOT shaped like a success. Fails pre-fix (no `isError`), passes post-fix.
- [ ] **Side-repo gates green.** `bun test` and `bun run typecheck` pass in `tweakcc_context_bonsai`, or any pre-existing unrelated baseline failure (e.g., the recorded `mcp-server/index.test.ts:169` TS2769) is carried as a reviewer/judge-approved exception.
- [ ] **Behavioral e2e gate (load-bearing) — reproduces Basil's experience.** This requires NET-NEW e2e capability (no existing harness launches the direct versioned-path shape; see Open Scope Decision). On a native `claude --version == 2.1.143` install with the patch applied, launched **in the bug-triggering shape** (binary invoked directly by its versioned path, no `--resume`): a contiguous prune is **allowed** and **actually removes the archived range from the model-visible transcript** (verified from session/transcript state and a drop in input-token footprint, not from the tool's success string); retrieve restores it. The harness MUST assert the launch shape (read `/proc/<claude-pid>/cmdline`; confirm argv[0] is the versioned path and no `--resume`). The same scenario run against pre-fix code reproduces the failure (success-shaped refusal; content remains). A run that launches via the `claude` shim does not satisfy this AC.
- [ ] **Behavioral e2e — Defect B surfacing.** In a genuinely-unpatched configuration, a prune attempt yields a tool result carrying `isError` (a visible failure), not a success-shaped result. This may be proven at the MCP-handler integration level if a live unpatched runtime is impractical; record which.
- [ ] **Secret Prune Oracle still holds (Protocol A).** Post-prune the seeded disposable secret cannot be recalled from active context; the secret never enters the prune patterns/summary/index terms. Verified from session state.
- [ ] **Evidence recorded** in a new `tweakcc_context_bonsai/docs/e2e-results-<date>-prune-guard-detection.md` with commands, exit codes, target version, the asserted launch shape, scenario verdicts, and pointers to local-only artifacts. No secrets, credentials, auth paths, or full transcripts committed.
- [ ] **History hygiene.** Defect A and Defect B are separate commits (single concern each); the spec clause is its own commit ordered before the Defect B implementation commit. Side-repo tree clean before each commit.
- [ ] **Pin discipline.** Side repo committed first; the parent `tweakcc_context_bonsai` submodule pin is advanced in the same turn as the judgment, per the per-story pin discipline; parent README/`docs/agent-specs/claude-code-context-bonsai-spec.md` status corrected only if the verified outcome contradicts current wording.

## Implementation Tasks

1. **Confirm starting state.** From `tweakcc_context_bonsai`: `git status --short` clean; `git rev-parse HEAD` == `bfb12e3`. Confirm running-binary facts hold (sentinel present in the binary under test).
2. **Spec-first (Defect B).** Add the one-clause requirement to `docs/context-bonsai-agent-spec.md` §2 Output rules (deterministic failures surfaced via the host error channel, never presented as a successful operation), reconciling with the existing "failures MUST be plain text" wording (`:156,177`) — `isError` governs the error flag, not the content form. Optionally add a one-line "patch/runtime detection MUST be launch-shape independent" clause for Defect A. Update `docs/agent-specs/claude-code-context-bonsai-spec.md` if it enumerates failure-output behavior. Commit (parent repo) as its own commit.
3. **Defect A — testability seam.** Introduce a minimal injectable proc-reader (parent-pid read, cmdline read, exe readlink) with the current `/proc` behavior as the default, used by the discovery functions — mirroring the existing `PruneDependencies` injection pattern (`index.ts:75-78,595-601`). Keep the surface small; do not refactor unrelated code.
4. **Defect A — fix.** Give the guard a launch-shape-independent ancestor walk modeled on `discoverSessionPath` (`index.ts:463-490`): from the MCP server pid up to pid 1, scan each ancestor's `/proc/<pid>/exe` for the sentinel, independent of `--resume`/argv naming; exclude `executableCandidatesFromArgv` from the guard path; preserve `findClaudeProcessContext` session-discovery outputs; preserve fail-closed on no-ancestor. Brief inline note on why exe-of-ancestor is the correct seam and why argv-name matching was insufficient.
5. **Defect A — tests.** Add discovery-layer unit tests for the four shapes (AC); confirm the native-direct-launch test fails pre-fix / passes post-fix; record both. Commit (side repo) the seam + fix + tests as one Defect-A commit.
6. **Defect B — fix + tests.** Add the `isError` failure helper; route all 14 deterministic failure returns through it; widen return types. Add the result-shape test (fails pre-fix, passes post-fix). Commit (side repo) as one Defect-B commit.
7. **Side-repo non-interactive validation.** Run the Validation Commands; all green or recorded exception.
8. **Behavioral e2e on pinned native 2.1.143 (NET-NEW capability).** Build the missing capability: a harness that launches `~/.local/share/claude/versions/<v>` directly (no `--resume`) and asserts that shape via `/proc/<claude-pid>/cmdline`. (Today `native-e2e.ts` is offline-only and `docs/e2e-protocol.md` launches only the `claude` shim — this is new, not an extension.) Run prune→retrieve and Protocol A; verify content removal from session/transcript state and token-footprint drop; demonstrate the pre-fix failure (success-shaped refusal, content remains) and post-fix pass. Prove Defect B surfacing (handler-integration level acceptable if a live unpatched run is impractical; record which). Record evidence doc. `BLOCKED` only for genuine environmental preconditions (e.g., missing credentials) and requires reviewer/judge approval before any release-gate PASS.
9. **Commit and pin.** Ensure clean tree and ordered commits (spec → Defect A → Defect B → e2e-results doc). Advance the parent submodule pin in the judgment turn. Correct parent status wording only if contradicted by the verified outcome.

## Open Scope Decision — RESOLVED

**Decision (Basil, 2026-05-29): (a) Single story, hard live gate.** Completion is blocked on the new live direct-launch e2e proving the experience is fixed; the live direct-launch harness is built as part of this story. The fork below is retained for context.

Validation surfaced one genuine fork that depends on your preference, not on analysis:

- The source fixes (Defect A + Defect B + unit/integration tests + spec clause) are small and self-contained.
- The behavioral e2e that "covers the experience you had" is **net-new infrastructure**: nothing today launches the native binary by its versioned path or asserts the launch shape. Building a live direct-launch + shape-assertion harness (plus credentials) is a substantial, separable effort.

Two defensible shapes:
- **(a) Single story, hard live gate.** One story; completion blocked on the new live direct-launch e2e proving the experience is fixed. Maximizes fidelity to your "gate on an e2e that covers my experience," at the cost of building the live harness now.
- **(b) Epic, two stories.** Story 1: the source fixes, gated on discovery-layer unit tests (four launch shapes, native-direct fails-pre/passes-post) + handler-level `isError` tests — fast, fully verifiable offline. Story 2: the live direct-launch e2e capability, with the live native run `BLOCKED`-eligible if credentials/host aren't available. Ships the fix sooner; treats the live gate as its own deliverable.

This plan is currently written as (a). If you prefer (b), I'll split it into an epic. Recommendation: (a) if you want the live proof bound to the fix before it lands; (b) if you want the verified source fix to land without waiting on live-harness construction.

## Out Of Scope / Known Related Issues
- The latent writer/reader config-dir asymmetry and the writer-Bun-APIs/reader-host-wrapper asymmetry (tracked from the read-encoding story) — unchanged here.
- The 2.1.156 forward-port (separate plan). Both fixes are version-agnostic at the source level and will be inherited by that port; this story validates on the pinned native 2.1.143 target that the running session uses.
- Gauge behavior and the retrieve same-step guard — untouched.

## Testing Strategy
- **Unit (helper mechanics, regression guards — not host-seam acceptance evidence):** discovery-layer tests over synthetic `/proc` trees (four launch shapes; native-direct fails pre-fix/passes post-fix); failure-result `isError` shape test (fails pre-fix/passes post-fix); existing scanner + injected-dep tests stay green.
- **Typecheck:** `bun run typecheck`; widened return types must not regress.
- **Behavioral e2e (load-bearing acceptance):** native 2.1.143, bug-shape launch asserted; prune actually mutates the model-visible transcript and footprint drops; retrieve restores; Protocol A confirms no secret leak; Defect B surfacing shown. Verdicts from session/transcript/host state, never the tool's success string.

## Validation Commands

These are the source of truth for the developer's starting-state check and completion rerun; no runtime substitution.

### Side-Repo Non-Interactive Commands
- Working directory: `/home/basil/projects/context-bonsai-agents/tweakcc_context_bonsai`
  - `git status --short`
  - `git rev-parse HEAD`
  - `bun install`
  - `bun test`
  - `bun run typecheck`

### Live E2E Commands (classified live; require native 2.1.143 + ambient CLI auth provisioned out of band)
- Working directory: `/home/basil/projects/context-bonsai-agents/tweakcc_context_bonsai`
  - `claude --version | grep '2.1.143'`
  - `bun run apply`
  - `claude mcp list`
  - The new bug-shape prune/retrieve scenario and Protocol A per the side repo's self-contained `docs/e2e-protocol.md` and `e2e/native-e2e.ts` (the harness MUST assert the runtime was launched directly by versioned path with no `--resume`). Secrets must not appear in prune patterns/summary/index terms; credentials never written to any artifact.

### Parent Final Verification
- Working directory: `/home/basil/projects/context-bonsai-agents`
  - `git -C tweakcc_context_bonsai log --oneline -5`
  - `git -C tweakcc_context_bonsai status --short`
  - `git status --short`
  - `git diff --submodule=short HEAD~1..HEAD`

## Worktree Artifact Check
- Checked At: `2026-05-28T22:30:00Z` (planner; implementer re-checks immediately before edits)
- Planned Target Files:
  - `docs/context-bonsai-agent-spec.md` (parent; one clause)
  - `docs/agent-specs/claude-code-context-bonsai-spec.md` (parent; conditional)
  - `tweakcc_context_bonsai/mcp-server/index.ts`
  - `tweakcc_context_bonsai/mcp-server/index.test.ts`
  - `tweakcc_context_bonsai/e2e/native-e2e.ts`
  - `tweakcc_context_bonsai/docs/e2e-protocol.md` (extend)
  - `tweakcc_context_bonsai/docs/e2e-results-<date>-prune-guard-detection.md` (new)
  - parent `tweakcc_context_bonsai` submodule pin
- Overlaps Found (path + class): none for planned targets. Verified: parent `docs/context-bonsai-agent-spec.md` and `docs/agent-specs/claude-code-context-bonsai-spec.md` clean; submodule `mcp-server/index.ts`, `mcp-server/index.test.ts`, `e2e/native-e2e.ts`, `docs/e2e-protocol.md` clean; submodule HEAD `bfb12e3` (matches starting-state assumption). Only `existing-untracked`: this plan file itself (expected). Unrelated untracked parent files (`docs/agent-specs/context-bonsai-e2e-spec.md`, `.agents/plans/story-rebase-cycle-…`) are NOT planned targets.
- Escalation Status: none required for planned targets.
- Decision Citation: Basil directed this fix and the e2e gate after the root-cause investigation in this session.

## Plan Approval and Commit Status
- Approval Status: approved
- Approval Citation: Basil approved on 2026-05-29 ("Approve"); scope resolved single story + hard live gate same day.
- Plan Commit Hash: 511702d6d177238ca72a05c379eaaf194b54000c
- Ready-for-Orchestration: yes

## Validation Loop Results
- Iteration 1 (independent adversarial sub-agent, read `mcp-server/index.ts`, `index.test.ts`, `src/lib/session.ts`, `e2e/native-e2e.ts`, `docs/e2e-protocol.md`, and live `/proc`):
  - **Confirmed sound:** the proc-tree premise (MCP server's direct parent is the patched binary; `bun run` does not exec-replace; `/proc/<pid>/exe` is authoritative); `isError` is supported by the MCP SDK and transport-safe; the 14 failure line numbers are accurate at HEAD `bfb12e3`; the testability seam is a small in-file refactor mirroring `PruneDependencies`; tests belong in `index.test.ts` (no `discovery.test.ts`).
  - **CRITICAL (resolved):** specify the ancestor walk + stop rule (walk to pid 1; scan each ancestor's exe), not just the immediate parent. Folded into Root Cause, Ambiguities, AC, Task 4.
  - **CRITICAL (resolved, corrected a wrong assumption):** session discovery is NOT broken — `discoverSessionPath` (`:463-490`) already has a `--resume`-independent cwd fallback via `findCurrentSession` (`session.ts:35`). Only the guard lacks it. Reframed to model the guard fix on that existing pattern.
  - **HIGH (resolved):** false-positive vector — `executableCandidatesFromArgv` (`:176-190`) argv candidates + `archivedFilterPatchPresentInAny` ANY-match. Guard must scan only exe-of-ancestor. Folded into Ambiguities, AC, Task 4.
  - **HIGH (resolved):** the live direct-launch e2e is net-new, not an extension (`native-e2e.ts` is offline; `e2e-protocol.md` launches only the `claude` shim). Folded into AC, Task 8, and the Open Scope Decision.
  - **MEDIUM (resolved):** reconcile the Defect B spec clause with existing "plain text" wording; categorize `:716` as post-mutation partial-failure, not pre-mutation refusal. Folded into Ambiguities, Task 2.
  - **MEDIUM (escalated):** single-story vs epic given the net-new e2e infra — surfaced to the user in Open Scope Decision.
  - Sub-agent verdict: PLAN-NEEDS-REVISION on the two CRITICALs + two HIGHs; all folded in this revision.
- Worktree artifact risk check: PASS — no planned-target overlaps (see Worktree Artifact Check).
- Plan-commit status check: pending user approval and plan commit (Phase 6).
- Iterations run: 1. One genuine scope decision remains for the user (Open Scope Decision); all technical blocking findings resolved.
