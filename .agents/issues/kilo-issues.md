# Kilo Context Bonsai — Known Issues

Source spec: `/home/basil/projects/context-bonsai-agents/docs/context-bonsai-agent-spec.md` (Pattern Matching Contract, current as of commit `9f1ca61`).
Per-agent spec: `/home/basil/projects/context-bonsai-agents/docs/agent-specs/kilo-context-bonsai-spec.md` (commit `4d87eb9`).
v1 implementation pinned at parent commit `4b7d0c8` (kilo_context_bonsai @ `00fe03555`, kilo @ `ab8ca53e9`).

## Issue K1: text extraction skips all non-text parts (spec violation, MUST)

**Currently understood:** `getText` at `kilo_context_bonsai/src/factory.ts:147-156` does `if (p.type !== "text") continue`, so any `Part` whose type is not `"text"` (including all tool-use parts, tool-result parts, and any other non-text part type) is silently dropped from the `MessageText.text` field that the resolver searches against. As a result, an assistant message that is only a tool call yields empty search text and is unreachable by `from_pattern` / `to_pattern`. A user tool-result message likewise has empty search text. This violates Pattern Matching Contract bullet 1 (MUST: "Matching MUST operate on message text and stable representations of every completed tool-call's name, input, and output").

**Verification:** Yes. `getText` in `kilo_context_bonsai/src/factory.ts:147-156` does `if (p.type !== "text") continue`, so all `type: "tool"` parts (which carry `tool` name, `state.input`, and `state.output` per the Kilo runtime's `MessageV2.ToolPart`) are dropped before `resolvePattern` runs. A turn whose only assistant part is a tool call produces an empty `MessageText.text` and is unreachable by `from_pattern`/`to_pattern`. No other code path supplements the search text.

**Evidence:**
- `kilo_context_bonsai/src/factory.ts:147-156` — full extractor; only `type === "text"` parts contribute, and `synthetic`/`ignored` text is also stripped. Output is then fed to `buildMessageTexts` (line 158-160) and consumed by `resolvePattern` via `resolveRange` (line 310).
- `kilo_context_bonsai/src/guards.ts:17-32` — `resolvePattern` does `messages[i].text.includes(pattern)`. With empty `text`, no tool-only message can ever match.
- `kilo_context_bonsai/src/factory.ts:44-52` — `OtherPart` has `type: string` plus arbitrary keys; tool parts pass through here at runtime but never reach `chunks`.
- Kilo runtime `ToolPart` shape, `kilo/packages/opencode/src/session/message-v2.ts:344-353`: `type: "tool"`, `callID: string`, `tool: string`, `state: ToolState`. Tool calls and their results are NOT split — both live on the same single part, and `state` transitions in place from `pending` → `running` → `completed`/`error` (lines 274-336). On `completed`, `state.input` (record) and `state.output` (string) are populated; on `error`, `state.error` is populated.
- Construction sites `kilo/packages/opencode/src/session/processor.ts:270-337` (streaming `tool-input-start`/`tool-call`) and `kilo/packages/opencode/src/session/prompt.ts:562-579` (subtask) confirm fields: `tool` (name), `state.input` (args), `state.output` (result string).
- Reference impl `opencode_context_bonsai_plugin/src/prune-pattern.ts:53-83` (`buildMessageSearchCorpus`): for each `type: "tool"` part with `state.status === "completed"`, emits `` `tool:${part.tool}\ninput:${stableSerialize(part.state?.input)}\noutput:${stableSerialize(part.state?.output)}` `` joined by a `\n<bonsai-part>\n` delimiter. `stableSerialize` (lines 6-51) sorts object keys for deterministic output. This is the architectural model the Kilo port should mirror.
- Existing tests `kilo_context_bonsai/test/plugin.test.ts:26-33` only ever build text-only messages via `msg()`, so no current test exercises tool-part extraction — there is no regression risk from the existing suite.

**Implementer notes:**
- Field names on Kilo `Part` (tool variant): `tool` (string, tool name), `state.input` (Record<string, any>, args), `state.output` (string, result text on `state.status === "completed"`), `state.error` (string, on `state.status === "error"`). Tool call and result share one part; do not look for a separate `type: "result"`.
- Minimal fix: extend `getText` (or factor a sibling `getSearchText`) to also handle `p.type === "tool"`. For each tool part with `state.status === "completed"`, append `` `tool:${tool}\ninput:${stableSerialize(state.input)}\noutput:${state.output ?? ""}` ``. For `status === "error"`, append `` `tool:${tool}\ninput:${stableSerialize(state.input)}\nerror:${state.error}` ``. Skip `pending`/`running` (incomplete; `detectToolCut` already rejects ranges ending on these). "Stable representation" = canonical-JSON for `input` (sort object keys, recursive, `bigint → string`, drop `undefined`/`function`/`symbol`); plain string for `output`/`error` since the runtime already stores those as strings. Port `stableSerialize` + `normalizeForStableJson` from the opencode reference verbatim — only ~45 lines, no deps.
- Use a clear separator between parts so a pattern doesn't accidentally bridge two parts (the reference uses `\n<bonsai-part>\n`; the existing Kilo code joins with `\n` which is too weak once tool input JSON enters the stream). Also keep `text:` / `tool:` / `input:` / `output:` prefixes so users can target specifically.
- Test fixtures to add to `kilo_context_bonsai/test/`:
  - `factory.test.ts` (new) or extend `plugin.test.ts`: a message with only a `type: "tool"` completed part, asserting `from_pattern` matching the tool name, the input value, and a substring of the output all resolve.
  - A message mixing one text part and one tool part — pattern hitting the tool part still resolves, and pattern hitting the text part still resolves (no regression).
  - Pending/running tool parts must NOT contribute to search text (reject with `pattern not found`).
  - Stable-serialization determinism: two equal-keyed-but-differently-ordered `state.input` objects yield identical search text.
  - Update `msg()` helper or add a `toolMsg()` helper so future tests can build tool-only messages cleanly.
- Side effects to watch:
  - Tool-call strings now searchable means a `from_pattern` like `"context-bonsai-prune"` could match the placeholder text (`[PRUNED: ...]`) only via Index/Summary, not via tool name — but a literal pattern like `"context-bonsai-prune"` would now match any prior prune turn. That's why the reference plugin special-cases `tool === "context-bonsai-prune"` ambiguity (`prune-pattern.ts:90-104`). Kilo's spec edit at commit `cb61f00` (prune-wrapper filter) covers this; ensure the implementer wires the tool-name disambiguation alongside this fix or the new searchable surface will introduce ambiguity errors.
  - `appendGauge` only inspects trailing text parts (`factory.ts:209-229`); unaffected by this change.
  - `detectToolCut` (`factory.ts:412-429`) reads `p.type === "tool"` with `state.status` — already aligned with the runtime shape this fix relies on; no change needed.

## Issue K2: prune-wrapper filter not implemented (spec violation, MUST)

**Currently understood:** The shared spec's Pattern Matching Contract requires that on ambiguous matches, the resolver MUST exclude messages whose canonical content is a prior `context-bonsai-prune` tool-use wrapper before returning the deterministic ambiguity error. `kilo_context_bonsai/src/guards.ts` `resolvePattern` (lines 17, 28-30) does not implement this. Today the bug is masked by Issue K1 (tool calls are not in search text at all so they cannot collide with retry patterns), but once K1 is remediated to comply with bullet 1, the wrapper filter becomes load-bearing because failed-prune args will then be searchable.

**Verification:** Yes. `kilo_context_bonsai/src/guards.ts:17-32` `resolvePattern` returns the deterministic ambiguity error immediately on `hits.length > 1` with no wrapper-filter step. No caller-side filtering exists either: `factory.ts:158-160` flattens to `{id, text}` only and `factory.ts:309-311` calls `resolveRange` directly without inspecting the original `PluginMessage[]` for prune wrappers.

**Evidence:**
- `kilo_context_bonsai/src/guards.ts:8-11` — `MessageText` is exactly `{ id: string; text: string }`; no wrapper signal is carried.
- `kilo_context_bonsai/src/guards.ts:28-30` — current ambiguity branch verbatim:
  ```ts
  if (hits.length > 1) {
    return { ok: false, error: `pattern ambiguous: ${pattern} matched ${hits.length} messages` }
  }
  ```
- `kilo_context_bonsai/src/factory.ts:158-160` — `buildMessageTexts` drops every part except text via `getText`, so the resolver has no view of `parts`.
- `kilo_context_bonsai/src/factory.ts:309-311` — prune `execute` calls `resolveRange(texts, ...)`; `resolveRange` (`guards.ts:51-53`) calls `resolvePattern` twice; nothing in this chain touches wrapper-ness.
- `kilo_context_bonsai/src/factory.ts:381` — tool name is registered as `"context-bonsai-prune"` (native plugin tool, no MCP prefix). This is the literal to match.
- Reference `opencode_context_bonsai_plugin/src/prune-pattern.ts:90-91`:
  ```ts
  const isPruneCandidate = (message: WithParts): boolean =>
    message.parts.some(part => part.type === 'tool' && part.tool === 'context-bonsai-prune' && part.state?.status === 'completed')
  ```
- Reference `opencode_context_bonsai_plugin/src/prune-pattern.ts:97-103` — filter only fires inside the `matchingIds.length > 1` branch; falls through to original error if filter does not yield exactly one survivor.

**Implementer notes:**
- Kilo `Part` for tool parts has the same shape as the OpenCode reference: `factory.ts:412-426` `detectToolCut` already gates on `p.type === "tool"` and accesses `(p as OtherPart).state`, and tool registration confirms the literal `"context-bonsai-prune"` (`factory.ts:381`). The OpenCode predicate translates 1:1: `m.parts.some(p => p.type === "tool" && (p as OtherPart).tool === "context-bonsai-prune" && isCompleted((p as OtherPart).state))`. No MCP prefix.
- Minimal change: add an optional `isPruneWrapper: boolean` field to `MessageText` in `guards.ts`. Populate it in `buildMessageTexts` (`factory.ts:158-160`) by mapping each `PluginMessage` through the predicate above. In `resolvePattern` ambiguity branch (`guards.ts:28-30`), before returning the error, compute `nonWrapperHits = hits.filter(i => !messages[i].isPruneWrapper)`; if `nonWrapperHits.length === 1`, return `{ ok: true, index: nonWrapperHits[0] }`; otherwise return the existing ambiguity error unchanged. Single-match path (`hits.length === 1`) is untouched. `resolveRange` does not need changes — it consumes `resolvePattern`'s result.
- Required outcome tests (in side-repo test suite alongside existing guards tests):
  1. **filter→1 (resolves)**: messages = `[{id:"m1", text:"foo bar", isPruneWrapper:false}, {id:"m2", text:"foo bar", isPruneWrapper:true}]`, pattern `"foo bar"` → `{ok:true, index:0}`.
  2. **filter→0 (still ambiguous)**: both candidates `isPruneWrapper:true` → original ambiguity error preserved verbatim.
  3. **filter→>1 (still ambiguous)**: two `isPruneWrapper:false` plus one `isPruneWrapper:true` all matching → original ambiguity error.
  4. **single-match-untouched**: one match with `isPruneWrapper:true` → returns `{ok:true, index:0}` (filter never runs on the single-match path).
  Plus an integration-level `factory.ts` test where `buildMessageTexts` runs against a `PluginMessage[]` containing a real prune tool part to confirm the flag is populated correctly.
- **Coupling with K1 (load-bearing ordering):** K1's recommended fix embeds `tool:context-bonsai-prune\ninput:{...from_pattern...to_pattern...summary...}\noutput:...` into search text per-message. After K1 lands, every prior prune tool-use message will textually contain the exact `from_pattern`/`to_pattern`/`summary` strings of any retry attempt, so any retry after a first ambiguity error will match both the real target and every prior prune wrapper. K1 alone re-introduces the self-poisoning bug across the entire prune history. **K2 must land in the same change as K1** (or strictly before K1 is merged). Reviewers should reject a K1-only PR.
