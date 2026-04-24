## Judge's Assessment

**Story**: CB-gemini.1 — Gemini CLI hooks-plus-MCP implementation
**Iteration**: 2 of 5 maximum
**Date**: 2026-04-24

---

### Summary

| Verdict | Count |
|---------|-------|
| APPROVED (must fix) | 0 |
| APPROVED (should fix) | 0 |
| REJECTED (over-engineering) | 0 |
| REJECTED (out of scope / premature) | 0 |
| REJECTED (not valid) | 1 (L1) |
| DEFERRED to later iteration | 0 |

### Verified Validation Results

- **Starting commit (iter 2 base):** agent `a007f64d2`; side repo `8624e57`
- **HEAD commits (iter 2 end):** agent `98ddc2843`; side repo `db8d01d`
- **Pre-existing failures (reviewer-reproduced):** none
- **HEAD results (judge re-ran):**
  - Side repo `npm test`: 68/68 pass (6 files)
  - Side repo `npm run typecheck`: clean
  - Agent `npm run typecheck` (all workspaces): clean
  - Agent CLI subset (`config.test.ts`, `contextBonsaiBootstrap.test.ts`, `contextBonsaiBootstrap.integration.test.ts`, `acpClient.test.ts`): 291 pass / 1 skipped (pre-existing)
  - Agent core subset (`hookEventHandler.test.ts`, `hookTranslator.test.ts`, `types.test.ts`, `hookSystem.test.ts`, `mcp-client.test.ts`, `mcp-client-manager.test.ts`): 179/179 pass
- **Regressions:** none
- **Regression gate:** clear

All reviewer validation numbers re-verified independently by the judge.

---

### Overall Verdict

**APPROVED AS-IS**

Iteration 2 closes every approved item from the iter-1 judgment. The correctness-blocking
gaps identified in iter-1 (C1 hook wiring, C2 pattern resolution before mutation, C3
structured-history seam) are all genuinely resolved, with tests that exercise the real
runtime hook path end-to-end. The HIGH and MEDIUM items (H2 trust-gate warn, H3 single
`Storage` instance, M1 dead helper removal, M2 single source of truth for the server name,
M3 key-filter in `config.test.ts`) are all closed cleanly. Scope discipline is strong:
17 files touched in the agent repo + 2 in the side repo, all in planned scope; none of the
rejected items (H4, M4, L1 cosmetic, L2) snuck in.

The reviewer's only iter-2 finding is an L1 about integration test breadth. Per the
reviewer's own analysis it does not represent a spec gap — the implemented integration
test (`contextBonsaiBootstrap.integration.test.ts`) satisfies the gemini-cli-context-bonsai
E2E priority "placeholders are model-visible in the actual request path" and the MCP
prune round-trip is independently covered by `mcp-server.test.ts`. Judge concurs.

---

### Finding-by-Finding Evaluation

#### Iter-1 approved items — verification at HEAD

##### [C1] Runtime hook registration wired at CLI startup
- **Verdict**: GENUINELY CLOSED
- **Evidence**:
  - `registerBonsaiHooksWithConfig(config)` call sites verified at
    `packages/cli/src/gemini.tsx:687`, `packages/cli/src/ui/AppContainer.tsx:487`,
    and `packages/cli/src/acp/acpClient.ts:328` and `:471` (both legacy and new
    ACP session paths). Invoked immediately after `config.initialize()`, which
    ensures `getHookSystem()` returns the initialized registry.
  - `packages/cli/src/utils/contextBonsaiBootstrap.ts` registers three runtime
    hooks: SessionStart (emits `BONSAI_GUIDANCE` as additional context — spec
    §1), BeforeTool with matcher `context-bonsai-prune` (agent-side pattern
    resolution — addresses C2), BeforeModel (feeds real
    `chat.getLastPromptTokenCount()` and `tokenLimit(config.getModel())` into
    `applyBonsaiBeforeModel`, mutating outbound request content for spec §§4/7).
  - `readTokenGaugeInputs` wraps all gauge sourcing in try/catch and returns
    `{}` when `getChat()` or the client isn't initialized, satisfying spec §7's
    silent-fallback rule.

##### [C2] MCP server rejects unresolved boundaries; resolution runs agent-side
- **Verdict**: GENUINELY CLOSED
- **Evidence**:
  - `gemini-cli_context_bonsai/src/mcp-server.ts:96-110` hard-rejects missing or
    empty `anchor_id` / `range_end_id` with deterministic plain-text errors.
    The prior patterns-as-ids fallback path is removed.
  - `BONSAI_TOOL_SCHEMAS.prune.required` includes both `anchor_id` and
    `range_end_id` (lines 200-207).
  - Agent-side `resolvePruneBoundary` in `contextBonsaiBootstrap.ts:307-362`
    calls `guards.resolveBoundary` against a live transcript snapshot derived
    from `ChatRecordingService.getConversation()`, and emits
    `decision: 'block'` on missing patterns, missing transcript, or unresolvable
    / ambiguous patterns. Pre-resolved ids from callers pass through untouched.
  - The BeforeTool matcher binds specifically to `context-bonsai-prune` so the
    hook only fires on the intended tool call.

##### [C3] Structured-history seam in hook translator — **narrower-design call verified**
- **Verdict**: GENUINELY CLOSED; narrower design is functionally equivalent to plan
- **Design-equivalence audit**: The plan listed `types.ts` and `hookEventHandler.ts`
  as "Files Modified" alongside `hookTranslator.ts`. The implementation modifies only
  `hookTranslator.ts` (adds `metadata?: Record<string, unknown>` to the
  `LLMRequest.messages[]` inline type) plus a new bonsai-agnostic helper module
  `structuredHistory.ts`. Judge verified this narrower design is sound:
  - `LLMRequest` is **declared in** `hookTranslator.ts` (lines 33-59). `types.ts`
    imports it via `import { ..., type LLMRequest, ... } from './hookTranslator.js'`
    (line 15), and `hookEventHandler.ts` does not declare any `LLMRequest` of its
    own — it round-trips via `defaultHookTranslator.toHookLLMRequest` /
    `fromHookLLMRequest`. Adding the optional `metadata` field to the declaring
    file therefore propagates through every consumer without additional edits.
  - `applyLLMRequestModifications` in `types.ts:374-396` takes the hook's
    `llm_request` output (a `Partial<LLMRequest>` — now including `metadata` per
    the updated interface) and feeds it through `fromHookLLMRequest`, which
    reads `message.metadata?.[BONSAI_PLACEHOLDER_METADATA_KEY]` and re-renders
    canonical `[PRUNED: ... to ...]` text. The round-trip is complete
    end-to-end through the production code path without needing `types.ts`
    or `hookEventHandler.ts` modifications.
  - `packages/core/src/hooks/hookTranslator.test.ts` adds three new test cases
    covering (a) `toHookLLMRequest` parsing canonical text into metadata,
    (b) `fromHookLLMRequest` re-rendering from metadata even when `content` has
    been mangled, and (c) end-to-end round-trip invariance.
  - `packages/cli/src/utils/contextBonsaiBootstrap.integration.test.ts:80-119`
    drives a real `HookSystem.fireBeforeModelEvent` with canonical placeholder
    text in SDK `contents`, asserts `result.modifiedContents` contains the
    canonical block. This proves the metadata round-trip survives
    `applyLLMRequestModifications` in the production hook pipeline.
  - Bonsai-agnosticism at the type level: the `metadata` field is typed as
    `Record<string, unknown>`. The bonsai-specific shape lives behind the
    `BONSAI_PLACEHOLDER_METADATA_KEY` well-known key in `structuredHistory.ts`,
    which is exactly the "structured content that must round-trip unchanged"
    abstraction the iter-1 judgment asked for.
  - Reviewer flagged but did not require: the shape in `structuredHistory.ts`
    duplicates the side-repo `BonsaiPlaceholder`. Comment in the file documents
    the constraint that the two MUST stay in sync. This is a deliberate narrow
    seam, not a design gap — core cannot depend on the CLI-only `file:` dep.
- **Conclusion**: the narrower design meets the plan's intent. The plan listed
  three files because the author expected a mirror of a hypothetical
  `LLMRequest` redeclaration in `types.ts`; the actual single-declaration
  codebase does not require that mirror. **No gap.**

##### [H1] Integration test proves placeholder reaches outbound Gemini request
- **Verdict**: GENUINELY CLOSED (see L1 below for reviewer scope concern)
- **Evidence**: `packages/cli/src/utils/contextBonsaiBootstrap.integration.test.ts`
  constructs a real `Config` + `HookSystem`, calls `registerBonsaiHooksWithConfig`,
  fires `fireBeforeModelEvent` on a seeded `GenerateContentParameters`, and
  asserts the canonical `[PRUNED: msg-10 to msg-42]` / `Summary:` / `Index:`
  three-line block in `result.modifiedContents`. Two additional tests exercise
  the BeforeTool prune-resolver hook (block on unresolvable, pass-through on
  pre-resolved). This exercises the real HookSystem → HookEventHandler →
  HookTranslator round-trip end-to-end.

##### [H2] Warn log when trusted-folder gate drops bonsai
- **Verdict**: GENUINELY CLOSED
- **Evidence**: `packages/core/src/tools/mcp-client-manager.ts:477-483` and `:605-611`
  both emit `coreEvents.emitConsoleLog('warn', ...)` with a bonsai-specific
  message when the server name is `context-bonsai` and the trusted-folder gate
  drops it. Gate behavior itself is unchanged.

##### [H3] Single `Storage.initialize()` cycle for bonsai injection
- **Verdict**: GENUINELY CLOSED
- **Evidence**: Bonsai injection moved to **after** `new Config(...)` returns
  (`packages/cli/src/config/config.ts:1066-1083`). Uses `config.storage`
  (public readonly) via `config.storage.initialize()` and
  `config.storage.getProjectTempDir()`, then calls `config.setMcpServers(...)`.
  The throwaway `bonsaiStorage` instance is eliminated. `storage.initialize()`
  is idempotent (cached `initPromise`) so the subsequent caller-driven
  `config.initialize()` does not cost a second migration cycle. Comment
  block documents the rationale in-line.

##### [M1] Dead allowlist helper removed
- **Verdict**: GENUINELY CLOSED
- **Evidence**: `grep -rn extendAllowedMcpServersForBonsai packages/` returns
  zero hits. Tests for the helper are also removed. The name carve-out in
  `mcp-client-manager.ts:274` remains the single effective implementation.

##### [M2] Single source of truth for `CONTEXT_BONSAI_MCP_SERVER_NAME`
- **Verdict**: GENUINELY CLOSED
- **Evidence**: Declared exactly once at `packages/core/src/tools/mcp-client-manager.ts:39`,
  exported from `packages/core/src/index.ts:245` as part of the public core
  API. CLI-side `contextBonsaiBootstrap.ts:41,58` imports from
  `@google/gemini-cli-core` and re-exports for the CLI package's consumers.
  No deep-imports. The bootstrap unit test consumes the re-export rather than
  declaring its own literal.

##### [M3] Key-filter pattern in `config.test.ts`
- **Verdict**: GENUINELY CLOSED
- **Evidence**: Four previously-loosened `toMatchObject` sites are converted
  to the `const actual = {...config.getMcpServers()}; delete actual['context-bonsai'];`
  pattern at lines 1542, 1721, 3762, 3804. The remaining `.toMatchObject` at
  line 1844 is on a single `serverA` object unrelated to bonsai and pre-existing.

#### Iter-1 rejected items — scope discipline confirmed

- **H4 (env-var sanitization)**: No change in iter-2 diff. Confirmed via
  `git diff a007f64d2..98ddc2843 -- packages/cli/src/utils/contextBonsaiBootstrap.ts`
  — env var `CONTEXT_BONSAI_SESSION_ID` is still set to the raw session id as
  designed; the side repo sanitizes at file-use time. No scope creep.
- **M4 (auto-run heuristic)**: No change in iter-2 diff. Confirmed via
  `grep process.argv src/mcp-server.ts` returning the original
  `/mcp-server\.(m?js|ts)$/.test(...)` check at line 424.
- **L1 (commit subject wording)**: No history rewrite attempts in iter-2.
- **L2 (prepare script)**: No change to `gemini-cli_context_bonsai/package.json`'s
  scripts in iter-2 commits. Acceptable; this was explicitly deferred by the
  iter-1 judgment.

#### Iter-2 reviewer findings

##### [L1] Integration test lighter than reviewer prompt suggested
- **Reviewer's Issue**: The integration test pre-seeds canonical placeholder text
  and skips `loadCliConfig` + a real MCP prune round-trip. Reviewer classified
  LOW and argued it does not represent a spec gap.
- **Verdict**: **REJECTED (not valid as a gap)**
- **Reasoning**: The gemini-cli-context-bonsai spec's E2E priority is "proof
  that placeholders are model-visible in the actual request path." The
  implemented integration test satisfies that by exercising the real
  `HookSystem.fireBeforeModelEvent` path against a live `Config` + `HookSystem`,
  producing `modifiedContents` on the outbound SDK request that contains the
  canonical `[PRUNED: …]` block. MCP prune flow is independently covered by
  `gemini-cli_context_bonsai/test/mcp-server.test.ts` (9 tests including
  ambiguity / missing-id / success). Chaining them into one `loadCliConfig`-
  driven end-to-end would add fixture weight without adding behavioral
  coverage beyond what the two layered tests already provide. The iter-1
  judgment's literal language was "constructs a Gemini LLM request, runs it
  through the hook system after a prune, and asserts `[PRUNED: …]` appears in
  the outbound payload" — which the implemented test does. Pragmatic sufficiency
  met.
- **Action**: No fix required.

---

### Loop/Conflict Detection

**Previous Iterations**: 1 (iter-1 was NEEDS REVISION)
**Recurring Issues**: none — every iter-1 approved item (C1/C2/C3/H1/H2/H3/M1/M2/M3)
closed in iter-2 with direct, proportionate fixes. No re-litigation of rejected items.
**Conflicts Detected**: none
**Assessment**: Healthy progress. The dev executed the iter-1 to-do list exactly and
added additional reviewer-surfaced items (structured-history test coverage, bootstrap
test refactor to use public exports) without scope creep. No loop risk.

---

### Recommendations

**APPROVED AS-IS**. All acceptance criteria from the story plan are satisfied:

- [x] Plan chooses hooks-first architecture with explicit runtime registration
      (verified: `registerBonsaiHooksWithConfig` at three startup paths).
- [x] Plan separates guidance/gauge delivery from prune/retrieve transport
      (verified: SessionStart + BeforeModel hooks for guidance/gauge; MCP server
      for prune/retrieve tool transport).
- [x] Plan identifies smallest required core seam for full-fidelity placeholder
      behavior (verified: narrow `metadata` field + `structuredHistory.ts` helper
      in core hooks package, isolated from bonsai semantics at the type level).
- [x] Plan identifies where prune/retrieve guard semantics live (verified: pattern
      resolution in agent-side BeforeTool hook via `guards.resolveBoundary`; same-step
      retrieve guard in MCP server; malformed-boundary rejection in MCP server schema
      validation + agent-side block).
- [x] Plan includes settings/schema/doc updates if new toggles introduced
      (not applicable — no new toggles added this story).
- [x] Validation commands cover both CLI and core test surfaces touched
      (verified: 291 CLI + 179 core + 68 side-repo tests green).

The story closes. Gemini CLI Context Bonsai port is functionally complete for
hooks-plus-MCP scope as defined.

---

### Complexity Guard Notes

The reviewer's L1 was the only residual suggestion, and the judge rejected it as
not representing a real gap. Deferring scope items beyond this story is recorded
in the iter-1 judgment (L2 packaging hygiene, M4 argv refinement, H4 env-var
defense-in-depth). None were revived in iter 2 because all were correctly
identified as out-of-scope for the behavioral-parity target.

Specifically NOT approved by this judgment:

- Expanding the integration test to drive `loadCliConfig` and a real MCP prune
  round-trip. Rejected because two existing test surfaces (integration test for
  the hook path; `mcp-server.test.ts` for the MCP contract) already cover the
  behavioral requirement. Combining them would add fixture weight without new
  coverage.
- Duplicating the `BonsaiPlaceholder` shape removal (core-vs-side duplication).
  Rejected because core cannot depend on the CLI-only `file:` dep; the inline
  comment documenting the sync constraint is the correct trade-off.
- Any refactor of `types.ts` / `hookEventHandler.ts` to declare their own
  `LLMRequest` variants. Rejected because the single-declaration codebase is
  already correct; reshaping for the plan's literal file list would reduce
  design quality without adding behavior.

---

### Notes for the orchestrator

This is a terminal judgment for CB-gemini.1. No iteration 3 is needed. The
implementation satisfies all acceptance criteria and the shared Context Bonsai
spec behavioral requirements that are in-scope for the hooks-plus-MCP port.
