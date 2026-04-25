# Cline Context Bonsai — Known Issues

Source spec: `/home/basil/projects/context-bonsai-agents/docs/context-bonsai-agent-spec.md` (Pattern Matching Contract, current as of commit `9f1ca61`).
Per-agent spec: `/home/basil/projects/context-bonsai-agents/docs/agent-specs/cline-context-bonsai-spec.md` (commit `4d87eb9`).
v1 implementation pinned at parent commit `4b7d0c8` (cline_context_bonsai @ `6393aab3b`, cline @ `0fa435d40`).

## Issue C1: tool_use blocks drop input arguments (spec violation, MUST)

**Currently understood:** `extractMessageText` at `cline/src/core/task/ContextBonsaiApplier.ts:131-153` renders an Anthropic `tool_use` block as `[tool_use:${name}]` only — the `input` arguments object is dropped entirely. As a result, a `from_pattern` matching a tool-call argument value (e.g. a file path or a search query) cannot resolve. Violates Pattern Matching Contract bullet 1 (MUST: "Matching MUST operate on … completed tool-call's name, input, and output").

**Verification:** Yes — confirmed. `extractMessageText` renders every `tool_use` block as the literal `[tool_use:${name}]` string with no input arguments serialized; `resolvePattern` searches only that text via `text.includes(trimmed)`, so a `from_pattern`/`to_pattern` matching any tool argument value (e.g. a file path passed to `read_file`) will fail `pattern_no_match`. No sibling extractor or pre-applier transform restores the input — `addToApiConversationHistory` pushes the assistant content unchanged, and the applier's only path into `resolvePattern` uses this same `extractMessageText`.

**Evidence:**
- `cline/src/core/task/ContextBonsaiApplier.ts:131-153` — current renderer drops `input`:
  ```ts
  for (const block of content) {
    if ((block as Anthropic.TextBlockParam).type === "text") {
      parts.push((block as Anthropic.TextBlockParam).text)
    } else if ((block as Anthropic.ToolUseBlockParam).type === "tool_use") {
      parts.push(`[tool_use:${(block as Anthropic.ToolUseBlockParam).name}]`)
    } else if ((block as Anthropic.ToolResultBlockParam).type === "tool_result") {
      ...
    }
  }
  return parts.join("\n")
  ```
- `cline/src/core/task/ContextBonsaiApplier.ts:203-206` — both pattern resolutions are fed the same `extractMessageText`, so the gap is total.
- `cline_context_bonsai/src/guards.ts:82-88` — resolution is a plain `text.includes(trimmed)` over whatever the extractor returned; nothing else inspects the message structure.
- Anthropic SDK shape is `ToolUseBlockParam = { type: "tool_use"; id: string; name: string; input: unknown }` (cast at `ContextBonsaiApplier.ts:139-140,170-176` and `index.ts:3233`); `input` is exactly what's being thrown away.
- `cline/src/core/task/message-state.ts:178-184` and `cline/src/core/task/index.ts:3171-3198` — the assistant message is stored unchanged: `addToApiConversationHistory` does `apiConversationHistory.push(message)` and the upstream caller appends `toolUseHandler.getAllFinalizedToolUses(...)` straight onto `assistantContent`. No mutation of the content array between API response and `apiConversationHistory`. The summarize/precompact path likewise never rewrites `input`.

**Implementer notes:**
- Minimal fix: change the `tool_use` branch in `extractMessageText` (`ContextBonsaiApplier.ts:139-140`) to include a deterministic JSON of the input. Recommended format (kept on a single physical line so existing `parts.join("\n")` boundaries don't shift): `[tool_use:${block.name} ${stableSerialize(block.input)}]`. Keep the leading `[tool_use:${name}` token so existing callers that only checked the name still match.
- Add a new helper `stableSerialize(value: unknown): string` in a sibling module — recommend `cline_context_bonsai/src/stable-json.ts` (so all four ports can converge on one impl) and re-export it from the package index. Port the OpenCode reference at `opencode_context_bonsai_plugin/src/prune-pattern.ts:6-51`: `normalizeForStableJson` recurses, sorts object keys lexicographically, drops `undefined`/function/symbol values, coerces `bigint` to string, honors `toJSON`, and replaces `undefined` array slots with `null`; `stableSerialize` wraps `JSON.stringify(normalized) ?? 'null'`. Stable means: same `input` object → same string regardless of property insertion order.
- Side-repo tests to add (`cline_context_bonsai/test/`): a new `stable-json.test.ts` covering key sorting, nested objects, arrays with `undefined`, bigint, `toJSON`, null/empty inputs. The existing `guards.test.ts` already passes a custom `extract` adapter, so the resolver itself needs no new tests — but extending `guards.test.ts` with a "matches text inside a tool_use input via the host extractor" case (using a fake extractor that returns `stableSerialize(input)`) documents the contract.
- Agent-repo tests to add (`cline/src/core/task/__tests__/ContextBonsaiApplier.test.ts`): (1) `extractMessageText` returns name + stable-JSON input for a `tool_use` block; (2) end-to-end prune where `from_pattern` matches a string nested inside `input` (e.g. a `path` arg) succeeds; (3) deterministic-output check — same `input` object built with reversed key order yields the same extracted string.
- Existing tests to update: `ContextBonsaiApplier.test.ts:116, 199-200, 260` use only text blocks, so they're unaffected. No applier test currently builds a `tool_use` block, and `guards.test.ts` uses a synthetic `Msg` shape — neither needs changes. Search the wider repo for `[tool_use:` literals to make sure no other consumer parses the old format; nothing else in `cline/src` does today.
- **C1↔C3 coupling:** once `input` is searchable, the placeholder text written by `renderPlaceholderText` (containing `from_pattern`, `to_pattern`, `summary`, `index_terms`) plus any failed-prune tool-call args in retry attempts will all become substring-match targets. A retry that re-issues `from_pattern: "foo"` will now ambiguously match both the original message AND its own prior failed `tool_use` block. C3 (prune-wrapper filter that excludes the wrapper's own tool-call args from the resolver's search corpus) MUST land at the same time as or before C1, otherwise C1 introduces a self-poisoning retry loop.

## Issue C2: non-text content blocks silently dropped (spec violation, MUST)

**Currently understood:** `extractMessageText` (`cline/src/core/task/ContextBonsaiApplier.ts:131-153`) drops every content block except `text`, `tool_use`, and `tool_result` (with text inner only). Two distinct gaps: (a) inside `tool_result.content`, only `text` inner blocks extract — `image` blocks (browser screenshots, MCP results, user followup attachments) are silently dropped; (b) at the top level, `image`, `document`, `thinking`, and `redacted_thinking` blocks are silently dropped. Violates Pattern Matching Contract bullet 1 (MUST: tool-call output must be searchable via stable representation; AND model-visible content must be reachable by pattern).

**Verification:** Yes (with correction — scope is broader than the original framing). Image blocks inside `tool_result.content` ARE produced by Cline (browser screenshots, MCP tool results, user followup attachments) and ARE silently dropped by `extractMessageText` at `ContextBonsaiApplier.ts:144-149`. `document` and `thinking` are NOT valid inside `tool_result.content` per the Anthropic SDK type, so they cannot be dropped there. However, top-level `image`, `document`, `thinking`, and `redacted_thinking` blocks at `ContextBonsaiApplier.ts:136-152` ARE produced by Cline (thinking/redacted-thinking on every reasoning turn; image/document via `ClineUserContent`/`ClineAssistantContent`) and ARE silently dropped by the same function's outer loop — same root-cause spec violation, broader scope than initially captured.

**Evidence:**
- `cline/src/core/task/ContextBonsaiApplier.ts:144-149` — inner `tool_result.content` loop only handles `type === "text"`; any other block (image) falls through silently.
- `cline/src/core/task/ContextBonsaiApplier.ts:136-152` — outer `for (const block of content)` only handles `text`, `tool_use`, `tool_result`. Top-level `image`, `document`, `thinking`, `redacted_thinking` are dropped before they ever reach `resolvePattern`.
- Anthropic SDK `cline/node_modules/@anthropic-ai/sdk/resources/messages/messages.d.ts:506-512` — `ToolResultBlockParam.content?: string | Array<TextBlockParam | ImageBlockParam>`. Only `image` is a valid non-text inner variant; `document`/`thinking` are NOT permitted there.
- Cline image producers inside `tool_result.content` (via `formatResponse.toolResult(text, images)` at `cline/src/core/prompts/responses.ts:129-154` → `formatImagesIntoBlocks` at `:351-367`, then wrapped by `ToolResultUtils.createToolResultBlock` at `cline/src/core/task/tools/utils/ToolResultUtils.ts:66-85`):
  - `cline/src/core/task/tools/handlers/BrowserToolHandler.ts:190-197` — browser screenshots.
  - `cline/src/core/task/tools/handlers/UseMcpToolHandler.ts:212` — MCP tool image responses.
  - `cline/src/core/task/tools/handlers/AskFollowupQuestionToolHandler.ts:104` and `cline/src/core/task/tools/utils/ToolResultUtils.ts:111` — user feedback attachments.
- Top-level thinking is real and persisted: `cline/src/core/task/index.ts:3153-3156` pushes `thinkingBlock` directly onto `assistantContent`, then `:3184-3186` writes that array into `apiConversationHistory`. `cline/src/shared/messages/content.ts:67-73` lists `ClineAssistantThinkingBlock` and `ClineAssistantRedactedThinkingBlock` as valid `ClineAssistantContent` variants. `:122-123` confirms thinking blocks survive into Anthropic-bound payloads when they have signatures.
- Top-level image/document are part of the storage type: `cline/src/shared/messages/content.ts:61-73` — `ClineUserContent` and `ClineAssistantContent` both include `ClineImageContentBlock` and `ClineDocumentContentBlock`.
- `extractMessageText` is the sole adapter feeding `resolvePattern` (`ContextBonsaiApplier.ts:203-205`) and `textHint` (`:247,252`), so any block it drops is unsearchable end-to-end.

**Implementer notes:**
- Fix the inner `tool_result.content` loop to render `image` blocks as a stable text token. Recommended: `[image:${source.type === "base64" ? source.media_type : (source.type === "url" ? "url " + source.url : "image")}${source.type === "base64" ? " base64" : ""}]`. Per the SDK, `ImageBlockParam.source` is currently `{ type: "base64"; media_type; data }`; do NOT include the base64 `data` (huge, non-stable). Include `media_type` so MIME-specific patterns can match; emit a `[base64]` placeholder so the token is non-empty/searchable.
- Extend the outer loop to also handle: (a) top-level `image` (same renderer as above); (b) `thinking` → push `block.thinking` (it's plain text); (c) `redacted_thinking` → push `[redacted_thinking]` (the `data` is opaque, an opaque token preserves the structural anchor); (d) `document` → push `[document:${title ?? "untitled"}${source.type === "url" ? " " + source.url : ""}]` using `DocumentBlockParam` shape at `messages.d.ts:112-119`.
- Use a fall-through default that emits `[block:${(block as any).type ?? "unknown"}]` rather than silently skipping, so future SDK additions remain searchable (matches the same defensive principle as C1's stable-JSON fallback).
- Tests to add in `cline/src/core/task/__tests__/ContextBonsaiApplier.test.ts`: (1) `extractMessageText` returns the image token for a `tool_result` whose content is `[text, image]` (browser-style); (2) prune `from_pattern` matching the image `media_type` token resolves; (3) top-level `thinking` block contributes its `thinking` text to the search corpus; (4) top-level `image`/`document` produce stable searchable tokens; (5) round-trip: an unknown future block type emits `[block:<type>]` rather than empty string.
- Side-repo (`cline_context_bonsai`): no changes required — the resolver is already polymorphic via the host extractor. If C1 lands the shared `stable-json.ts`, no overlap with this issue.
- **C2↔C1 coupling:** independent fix sites in the same function — land C1 and C2 in one PR to avoid two passes over `extractMessageText`. The defensive-default catch-all in C2 also makes C1's `tool_use` rendering immune to future Anthropic block additions inside assistant content.
- **C2↔C3 coupling:** once images become searchable, a `from_pattern` like `image/png` could match every screenshot in history, producing the exact ambiguity case C3's prune-wrapper filter is meant to disambiguate. C3 must be in place when C2 lands or screenshot-heavy tasks will hit `pattern_ambiguous` instead of the intended message.
- Spec confirmation: per `docs/context-bonsai-agent-spec.md` Pattern Matching Contract bullet 1, tool-call OUTPUT must be searchable via stable representation; an image's `media_type`/URL/base64 marker is the stable representation, and a thinking block's text content already is.

## Issue C3: prune-wrapper filter not implemented (spec violation, MUST)

**Currently understood:** The shared spec's Pattern Matching Contract requires that on ambiguous matches, the resolver MUST exclude messages whose canonical content is a prior `context-bonsai-prune` tool-use wrapper before returning the deterministic ambiguity error. `cline_context_bonsai/src/guards.ts` `resolvePattern` (around lines 68-106, ambiguity branch at 96-104) does not implement this. Today the bug is partially masked by C1 (failed-prune `input` args don't reach search text), but once C1 is remediated, the wrapper filter becomes load-bearing.

**Verification:** Yes — the bug is real. `resolvePattern` in `cline_context_bonsai/src/guards.ts` (lines 68-106) has no wrapper-filter logic in the ambiguity branch (lines 96-104); it returns `pattern_ambiguous` immediately on `hits.length > 1`. `ContextBonsaiApplier.ts` (lines 197-206) calls `resolvePattern` twice (`from_pattern`, `to_pattern`) with no caller-side filtering, and a global grep for `isPruneWrapper|prune-wrapper|pruneWrapper` across `cline_context_bonsai/` and `cline/` returns zero hits. No filtering exists anywhere.

**Evidence:**
- `cline_context_bonsai/src/guards.ts:96-104` ambiguity branch verbatim:
  ```ts
  if (hits.length > 1) {
      return {
          ok: false,
          error: {
              code: "pattern_ambiguous",
              message: `${patternLabel} matched ${hits.length} messages; must match exactly one`,
          },
      }
  }
  ```
- `resolvePattern` signature is generic-with-callback: `<Message>(messages, pattern, extractText: ExtractTextFn<Message>, patternLabel)` — no struct field for adapters; the natural extension is a sibling callback.
- Callsites at `cline/src/core/task/ContextBonsaiApplier.ts:203` and `:205` pass `extractMessageText` as the only adapter; both pass nothing for wrapper detection.
- Native tool name confirmed: `cline/src/shared/tools.ts:36` — `CONTEXT_BONSAI_PRUNE = "context-bonsai-prune"`. `ContextBonsaiPruneHandler.ts:19` uses `ClineDefaultTool.CONTEXT_BONSAI_PRUNE`. No MCP prefix in Cline's native path; predicate compares against the literal string `"context-bonsai-prune"`.
- Anthropic content blocks already enumerated in `ContextBonsaiApplier.ts:139-140` show the host uses `Anthropic.ToolUseBlockParam` with `.type === "tool_use"` and `.name` — no `status` field is present, confirming the OpenCode `state?.status === 'completed'` check does not translate.
- Global filter search across both repos: zero hits for `isPruneWrapper|prune-wrapper|pruneWrapper`.

**Implementer notes:**
- Minimal change in `cline_context_bonsai/src/guards.ts`: add 5th parameter `isPruneWrapper?: (m: Message) => boolean` to `resolvePattern`. In the `hits.length > 1` branch, if the callback is provided, compute `survivors = hits.filter(h => !isPruneWrapper(messages[h.index]))`. If `survivors.length === 1`, return `{ ok: true, value: survivors[0].index }`. Otherwise fall through to the existing `pattern_ambiguous` error (use `survivors.length || hits.length` for the message count). When the callback is omitted, behavior is byte-identical to v1 (regression safe).
- Add a content-block predicate helper in a new file `cline_context_bonsai/src/content.ts` (or appended to `guards.ts`), e.g. `export function isPruneToolUseInContent(content: unknown): boolean`. It must accept arbitrary `unknown`, return `false` for non-arrays/strings, and otherwise iterate the array looking for any block where `block?.type === "tool_use"` and `block?.name === "context-bonsai-prune"`. Re-export it from `cline_context_bonsai/src/index.ts`.
- Wiring at `cline/src/core/task/ContextBonsaiApplier.ts:203` and `:205`: pass a 5th arg `(m: Anthropic.MessageParam) => isPruneToolUseInContent(m.content)` to both `resolvePattern` calls. The predicate must read `msg.content` directly (the unstripped canonical content), not `extractMessageText(msg)` — wrappers are detected by structural shape, not search text.
- Required tests: (1) outcome — single match returns the hit index unchanged when callback provided; (2) outcome — two raw hits, one is a prune wrapper → returns the surviving non-wrapper index with `ok: true`; (3) outcome — two raw hits, both wrappers → still `pattern_ambiguous`; (4) outcome — two raw hits, neither a wrapper → still `pattern_ambiguous`. Predicate tests: `isPruneToolUseInContent` returns true on `[{ type: "tool_use", name: "context-bonsai-prune", id, input }]`, false on plain string content, false on a tool_use block with a different `name`, false on `tool_result` blocks, false on `undefined`/`null`/non-array.
- Coupling: C1 (failed-prune `input` reaches search corpus) and C2 (any sibling content-text expansion) both widen what `extractText` returns; once they land, prior prune wrappers' `input.summary`/`from_pattern`/etc. text starts colliding with future patterns, manufacturing exactly the ambiguity that C3 must filter. C3 is load-bearing only after C1/C2; ship them together or land C3 first.
- OpenCode reference at `opencode_context_bonsai_plugin/src/prune-pattern.ts:85-107` is the architectural model (filter-then-resolve-if-unique-survivor). Drop the `state?.status === 'completed'` clause — Anthropic `tool_use` blocks have no status field. A `tool_use` block by name alone is sufficient evidence of a prior bonsai prune wrapper in Cline's transcript.
