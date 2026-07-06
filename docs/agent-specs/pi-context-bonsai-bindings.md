# Pi Context Bonsai Bindings

This is the exploration-derived bindings layer for the Pi port: the structural facts about the harness and the side repo (file paths, function names, storage locations, JSON shapes) that realize the obligations in [`pi-context-bonsai-spec.md`](pi-context-bonsai-spec.md). It is the derivation pipeline's Stage 1 output (`derivation-pipeline-spec.md` §4) and the demotion target for `structural-*` escalation codes (§2.2): on a structural break, everything in this document becomes an untrusted prior and may be rewritten from fresh exploration. The sibling contract spec changes only when the product's behavior contract changes or a Stage 2/3 re-run revises the posture; it references this document by binding key, never the reverse direction for obligations.

Evidence in this document was verified against the pinned Pi fork repo (`pi/`, packages under `pi/packages/`) and the side repository `pi_context_bonsai/`. This harness is bound in `forward-port-spec.md` §4.4 (derivation pipeline Stages 5–6, 2026-07-05); the Binding Sites table below is that slot's seam/anchor registry — each routine cycle's §3.2 drift scan re-verifies every row against the frozen target version.

## Capability Evidence Matrix

| Area | Status | Notes |
|---|---|---|
| Persistent transcript | Verified | SessionManager stores append-only JSONL/tree entries with custom entries |
| Tool execution layer | Verified | `ExtensionAPI.registerTool` supports TypeBox parameters and per-tool execution mode |
| Context transform hook | Verified | The `context` event rewrites outgoing `AgentMessage[]` before model invocation |
| System guidance path | Verified | `before_agent_start` can replace or extend the effective system prompt |
| Archive persistence | Verified | `pi.appendEntry(customType, data)` persists extension-owned custom session state |
| Token/context tracking | Verified | `ctx.getContextUsage()` exposes tokens, context window, and percent when available |
| Stable message ids | Partial | LLM messages have timestamps but no ids; archive ids must use `SessionEntry.id` plus correlation metadata |

## Verified Host Primitives

- Extension factories and `ExtensionAPI` are defined in [types.ts](/home/basil/projects/context-bonsai-agents/pi/packages/coding-agent/src/core/extensions/types.ts).
- Tool registration is exposed through `registerTool` in [types.ts](/home/basil/projects/context-bonsai-agents/pi/packages/coding-agent/src/core/extensions/types.ts) and wired by [loader.ts](/home/basil/projects/context-bonsai-agents/pi/packages/coding-agent/src/core/extensions/loader.ts).
- Tool execution can be forced sequential through `executionMode`, with default parallel execution in [agent.ts](/home/basil/projects/context-bonsai-agents/pi/packages/agent/src/agent.ts) and selection logic in [agent-loop.ts](/home/basil/projects/context-bonsai-agents/pi/packages/agent/src/agent-loop.ts).
- The outgoing transcript transform path is `transformContext` in [agent-loop.ts](/home/basil/projects/context-bonsai-agents/pi/packages/agent/src/agent-loop.ts), surfaced to extensions as the `context` event in [runner.ts](/home/basil/projects/context-bonsai-agents/pi/packages/coding-agent/src/core/extensions/runner.ts).
- System guidance can be appended through `before_agent_start`, defined in [types.ts](/home/basil/projects/context-bonsai-agents/pi/packages/coding-agent/src/core/extensions/types.ts) and chained in [runner.ts](/home/basil/projects/context-bonsai-agents/pi/packages/coding-agent/src/core/extensions/runner.ts).
- Archive state can persist through `pi.appendEntry`, backed by `SessionManager.appendCustomEntry` and append-only session persistence in [session-manager.ts](/home/basil/projects/context-bonsai-agents/pi/packages/coding-agent/src/core/session-manager.ts).
- Session lifecycle includes startup, reload, resume, new, and fork reasons in [types.ts](/home/basil/projects/context-bonsai-agents/pi/packages/coding-agent/src/core/extensions/types.ts), with reload/resume paths in [agent-session.ts](/home/basil/projects/context-bonsai-agents/pi/packages/coding-agent/src/core/agent-session.ts) and [agent-session-runtime.ts](/home/basil/projects/context-bonsai-agents/pi/packages/coding-agent/src/core/agent-session-runtime.ts).
- Usage data for the gauge is exposed by `ctx.getContextUsage()` in [types.ts](/home/basil/projects/context-bonsai-agents/pi/packages/coding-agent/src/core/extensions/types.ts) and implemented in [agent-session.ts](/home/basil/projects/context-bonsai-agents/pi/packages/coding-agent/src/core/agent-session.ts).
- Pi LLM messages carry role/content/timestamp but no stable message id in [types.ts](/home/basil/projects/context-bonsai-agents/pi/packages/ai/src/types.ts). Session entries provide ids in [session-manager.ts](/home/basil/projects/context-bonsai-agents/pi/packages/coding-agent/src/core/session-manager.ts).

## Unverified Or Weak Areas

- Message correlation must bridge two shapes: durable `SessionEntry.id` in session state and id-less `AgentMessage[]` in the context transform. The plan resolves this by storing entry ids plus `(role, timestamp)` for anchor and range end.
- `buildSessionContext` can inject synthetic compaction summaries, branch summaries, and custom messages, and can drop entries before `firstKeptEntryId`. Positional zipping between branch entries and outgoing messages is unsafe.
- `getContextUsage()` may be unavailable or may return null token/percent values after compaction until new assistant usage is recorded. Gauge injection must remain silent in those states.
- Tool execution defaults to parallel. Bonsai prune and retrieve tools must opt into sequential execution to avoid overlapping archive mutations.

## Binding Sites

Each key below is referenced from the contract spec's obligations. A key's site column is the current realization; rewriting a site (new path, new function, new storage location) is a bindings-layer change and does not require a contract-spec edit as long as the obligation it realizes still holds.

| Binding key | Current site | Realizes (contract-spec obligation) |
|---|---|---|
| `extension-discovery` | Pi's extension discovery: user-global `~/.pi/agent/extensions/` entry, project-local `.pi/extensions/` entry, or an explicit extension path — wired by `loader.ts` | Integration Posture: extension wiring MUST work regardless of the directory Pi is launched from |
| `extension-api` | `ExtensionAPI` interface defined in `types.ts`; extension factories loaded via `loader.ts` | Integration Posture: Pi requires no fork; integration occurs entirely through the public extension API, no pi-mono source modification |
| `archive-store` | `pi.appendEntry(customType, data)` backed by `SessionManager.appendCustomEntry`, append-only session persistence in `session-manager.ts`; custom entry type tags `context-bonsai:archive` (prune) and `context-bonsai:archive-clear` (retrieve tombstone) | Integration Posture: archive records/tombstones MUST use Pi-native session custom entries rather than an external shadow store; E2E Priorities: persisted archive/tombstone entries verified across reload |
| `message-correlation` | `SessionEntry.id` (`session-manager.ts`) as the durable anchor/range-end id, correlated to id-less outgoing `AgentMessage[]` entries by `(role, timestamp)` during the context transform, in place of a positional zip against `getBranch()` (`agent-loop.ts` / `ai` package `types.ts`) | Prune and retrieve contract: archive records must include correlation metadata to relocate boundaries; Transcript mutation path: anchor correlation MUST NOT use positional zip; Parity Gaps: message-identity bridging risk |
| `sequential-execution` | `executionMode: "sequential"` tool-registration option; default parallel execution in `agent.ts`, selection logic in `agent-loop.ts` | Prune and retrieve contract: prune/retrieve tools MUST opt into sequential execution to avoid overlapping archive mutations |
| `transcript-mutation` | The extension `context` event, i.e. `transformContext` in `agent-loop.ts`, surfaced via `runner.ts` | Transcript mutation path: placeholder rendering and follower-message elision MUST happen through this event; Capability Evidence Matrix "Context transform hook" row |
| `guidance-channel` | `before_agent_start` extension hook (`types.ts`), chained in `runner.ts`, appending to the effective system prompt | System guidance path: bonsai guidance SHOULD be appended through this hook |
| `gauge-channel` | Gauge text appended to the last user message in a `<system-reminder>`-style wrapper during the `context` transform (see `transcript-mutation`) | Gauge path: in-band delivery channel and cadence/band rendering |
| `usage-api` | `ctx.getContextUsage()` (`types.ts`), implemented in `agent-session.ts`; may return unavailable/null token-percent data after compaction until new assistant usage is recorded | Gauge path: gauge MUST remain silent when usage data is unavailable/null; Capability Evidence Matrix "Token/context tracking" row |
| `host-compat-surface` | `sessionManager.getBranch`, `sessionManager.getEntries`, `pi.appendEntry`, and the `context` transform path | Fail-Closed Requirements: prune/retrieve MUST fail closed with deterministic compatibility errors if any of these become unavailable or incompatible |
| `searchable-text` | `toolCall` (name/input) and `toolResult` (name/output) fields within the outgoing `AgentMessage[]` shape (`ai` package `types.ts`; context transform in `agent-loop.ts`) | Prune and retrieve contract: pattern matching MUST include tool-call/tool-result structures, not just message text |

## E2E Credential Discovery

Line-number citations in this section are against the pinned fork working tree (the stripped v0.69.0-era commit, which does not advance with cycles); each routine cycle's drift scan re-verifies the named surfaces against the frozen target — the 2026-07-05 scan confirmed all of them present and behaviorally identical at v0.73.1 (`hasAuth` at :331, `inMemory` at :210, the `getApiKey` priority docs at :446-451; only line positions moved). The Pi e2e harness MUST defer to Pi's documented credential resolution rather than implement its own. Pi exposes the unified credential surface as `AuthStorage` in [auth-storage.ts](/home/basil/projects/context-bonsai-agents/pi/packages/coding-agent/src/core/auth-storage.ts); the auth file path is resolved by `getAuthPath()` / `getAgentDir()` in [config.ts](/home/basil/projects/context-bonsai-agents/pi/packages/coding-agent/src/config.ts) and defaults to `~/.pi/agent/auth.json` (mode 600), overridable via `$PI_CODING_AGENT_DIR`. The store accepts both `ApiKeyCredential` and `OAuthCredential` shapes, populated by `pi login`, manual edits, or migration from earlier credential formats. `AuthStorage.hasAuth(provider)` (auth-storage.ts:324) is true iff any credential source — runtime override, auth.json entry, `getEnvApiKey(provider)` env-var lookup, or `models.json` fallback resolver — yields a credential, in the priority order `getApiKey()` documents (auth-storage.ts:415-422). An env-var-only credential gate is wrong for Pi: it produces false negatives for `pi login`-authenticated operators, hand-edited `api_key` entries, `$PI_CODING_AGENT_DIR` overrides, OAuth-token env vars (`ANTHROPIC_OAUTH_TOKEN`, `COPILOT_GITHUB_TOKEN`, etc. — see [env-api-keys.ts](/home/basil/projects/context-bonsai-agents/pi/packages/ai/src/env-api-keys.ts)), and `models.json` custom-provider configurations.

- The harness MUST gate scenario execution on `AuthStorage.hasAuth(provider)` rather than implement its own env-var or file-parsing logic. A returned `true` is sufficient credential evidence; OAuth refresh, expiry handling, and fallback resolution are delegated to Pi at invocation time.
- The harness-specific override `BONSAI_E2E_API_KEY`, when set, MUST be applied via `setRuntimeApiKey(provider, $BONSAI_E2E_API_KEY)` before the `hasAuth(provider)` check. This makes the override participate in Pi's documented priority order (runtime override is highest priority per auth-storage.ts:418).
- Provider-specific env vars consumed by Pi (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `ANTHROPIC_OAUTH_TOKEN`, AWS Bedrock variables, GCP Vertex variables, GitHub Copilot tokens, etc.) MUST NOT be re-enumerated by the harness; relying on `getEnvApiKey()` via `hasAuth()` ensures the harness automatically tracks Pi's evolving env-var surface.
- The harness MUST fail closed with a deterministic error only when `hasAuth(provider)` returns false. The error message MUST name (i) the auth-store path (`getAuthPath()` resolution, including the `$PI_CODING_AGENT_DIR` override hint), (ii) the harness override `BONSAI_E2E_API_KEY`, and (iii) the operator-actionable next step (run `pi login <provider>` or set the override env var) so operators can self-diagnose.
- The harness MUST NOT invoke `pi login` automatically; that flow is interactive and out of scope for a non-interactive validation run.
- Credential-discovery logic MUST be covered by deterministic unit tests using `AuthStorage.inMemory(...)` (auth-storage.ts:203) and fixture data — no live LLM call required. Fixtures MUST cover at minimum: (i) `api_key`-shape entry for the configured provider, (ii) `oauth`-shape entry, (iii) entry-for-different-provider-only (gate must reject), (iv) `BONSAI_E2E_API_KEY` runtime override only, (v) no source present (gate must produce the deterministic error).
- Other per-agent specs in this repo do not document credential-discovery conventions because their hosts have different auth primitives. This section is intentionally pi-only; future per-agent specs may need their own analogues.

## Key References

- [epic-port-context-bonsai.md](/home/basil/projects/context-bonsai-agents/.agents/plans/epic-pi-port/epic-port-context-bonsai.md)
- [story-port-context-bonsai.1-package-scaffold.md](/home/basil/projects/context-bonsai-agents/.agents/plans/epic-pi-port/story-port-context-bonsai.1-package-scaffold.md)
- [story-port-context-bonsai.2-prune-and-context-transform.md](/home/basil/projects/context-bonsai-agents/.agents/plans/epic-pi-port/story-port-context-bonsai.2-prune-and-context-transform.md)
- [story-port-context-bonsai.3-retrieve.md](/home/basil/projects/context-bonsai-agents/.agents/plans/epic-pi-port/story-port-context-bonsai.3-retrieve.md)
- [story-port-context-bonsai.4-context-gauge.md](/home/basil/projects/context-bonsai-agents/.agents/plans/epic-pi-port/story-port-context-bonsai.4-context-gauge.md)
- [story-port-context-bonsai.5-e2e-test-fix-loop.md](/home/basil/projects/context-bonsai-agents/.agents/plans/epic-pi-port/story-port-context-bonsai.5-e2e-test-fix-loop.md)
- [types.ts](/home/basil/projects/context-bonsai-agents/pi/packages/coding-agent/src/core/extensions/types.ts)
- [runner.ts](/home/basil/projects/context-bonsai-agents/pi/packages/coding-agent/src/core/extensions/runner.ts)
- [session-manager.ts](/home/basil/projects/context-bonsai-agents/pi/packages/coding-agent/src/core/session-manager.ts)
- [agent-loop.ts](/home/basil/projects/context-bonsai-agents/pi/packages/agent/src/agent-loop.ts)
- [ai types.ts](/home/basil/projects/context-bonsai-agents/pi/packages/ai/src/types.ts)
