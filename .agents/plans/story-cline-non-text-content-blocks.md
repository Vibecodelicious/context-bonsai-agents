# Story: Cline extractMessageText handles non-text content blocks

## Goal

Bring Cline's text extractor into compliance with the cross-agent spec's Pattern Matching Contract bullet 1 (MUST, since commit `9f1ca61`) for content blocks beyond `text`/`tool_use`/`tool_result.text`. Today `extractMessageText` at `cline/src/core/task/ContextBonsaiApplier.ts:131-153` silently drops:

1. **`image` blocks inside `tool_result.content`** — produced by browser screenshots (`BrowserToolHandler.ts:190-197`), MCP tool results (`UseMcpToolHandler.ts:212`), and user followup attachments (`AskFollowupQuestionToolHandler.ts:104`). These tool outputs are entirely unsearchable.
2. **Top-level `image` blocks** in user/assistant content.
3. **Top-level `thinking` and `redacted_thinking` blocks** — produced on every reasoning turn (`cline/src/core/task/index.ts:3153-3186`).
4. **Top-level `document` blocks** — defined in `ClineUserContent`/`ClineAssistantContent`.

Source issue: `.agents/issues/cline-issues.md` Issue C2 (verified, evidence-backed).

## Dependencies

- **Must land with C1 (`story-cline-tool-use-input-args.md`) and C3 (`story-cline-prune-wrapper-filter.md`).** All three modify `extractMessageText` (C1, C2) or its consumers (C3); landing them together avoids multiple passes over the same function. C3 is drafted as a separate plan in this same epic; the dependency is enforced by the orchestrator's per-agent sequential ordering, not by file-level coupling.

## User Model

### User Gamut
- VS Code Cline users running browser-tool tasks who want to prune around screenshots
- Users running MCP tools whose results include images
- Users with reasoning turns ("thinking" blocks) they want to identify by reasoning content
- Users with document attachments

### User-Needs Gamut
- Tool-result images reachable by pattern via media type / URL
- Top-level images, documents, thinking blocks reachable
- Redacted thinking blocks have a stable token so structural anchors remain
- Forward compatibility: future SDK additions don't silently drop

### Ambiguities From User Model
- **Image rendering:** include the base64 `data` (huge, useless for matching) or just `media_type`? Resolved: `media_type` only with a `[base64]` marker, OR URL/source for url-typed. Per C2 issues research recommendation.
- **Thinking blocks:** include the actual `thinking` text? Resolved: yes — it's plain text and the user may want to pattern-match reasoning content.
- **Redacted thinking:** the `data` is opaque base64 — emit a `[redacted_thinking]` token only.
- **Forward compat:** unknown future block types should emit `[block:${type ?? "unknown"}]` rather than silently skip.

## Context References

- `cline/src/core/task/ContextBonsaiApplier.ts:131-153` — `extractMessageText`. Inner `tool_result.content` loop at `:144-149` (image gap). Outer block loop at `:136-152` (thinking/document/top-level-image gap).
- `cline/src/core/prompts/responses.ts:129-154,351-367` — `formatResponse.toolResult` and `formatImagesIntoBlocks` showing how tool images get embedded in `tool_result.content`.
- `cline/src/core/task/tools/handlers/BrowserToolHandler.ts:190-197` — browser screenshot producer.
- `cline/src/core/task/tools/handlers/UseMcpToolHandler.ts:212` — MCP image result producer.
- `cline/src/core/task/tools/handlers/AskFollowupQuestionToolHandler.ts:104` — user attachment producer.
- `cline/src/core/task/tools/utils/ToolResultUtils.ts:66-85,111` — `createToolResultBlock` shape.
- `cline/src/core/task/index.ts:3153-3186` — thinking-block construction and persistence.
- `cline/src/shared/messages/content.ts:61-73,67-73,122-123` — `ClineUserContent`, `ClineAssistantContent`, `ClineAssistantThinkingBlock` shapes.
- Anthropic SDK `cline/node_modules/@anthropic-ai/sdk/resources/messages/messages.d.ts:506-512` — `ToolResultBlockParam.content?: string | Array<TextBlockParam | ImageBlockParam>`.
- Anthropic SDK `:112-119` — `DocumentBlockParam` shape.
- `docs/context-bonsai-agent-spec.md` Pattern Matching Contract — spec authority.
- `docs/agent-specs/cline-context-bonsai-spec.md` — Cline's mirror.

## Acceptance Criteria

- [ ] Inside the `tool_result.content` array loop (`ContextBonsaiApplier.ts:144-149`), `image` blocks render as a stable token. The pinned Anthropic SDK version only supports `source.type === "base64"` for images (verified at `cline/node_modules/@anthropic-ai/sdk/resources/messages/messages.d.ts:120-131`); future SDK versions may add `url` sources. Format:
  - `source.type === "base64"` → `[image:${source.media_type} base64]`
  - default (forward-compat) → `[image:image]`
  Do NOT include the base64 `data` (huge, non-stable). A `url`-source branch is unnecessary in the current SDK; if added later, render as `[image:url ${source.url}]`.
- [ ] At the outer level (after the `tool_result` else-if), the loop also handles:
  - `image` blocks: same renderer as above.
  - `thinking` blocks: push `block.thinking` (it's plain text the model produced).
  - `redacted_thinking` blocks: push `[redacted_thinking]` (data is opaque).
  - `document` blocks: push `[document:${block.title ?? "untitled"}]` per `DocumentBlockParam` shape (`messages.d.ts:112-119`). The current SDK's `DocumentBlockParam.source` union (`Base64PDFSource | PlainTextSource | ContentBlockSource`) does not include a URL variant, so do not branch on `source.type === "url"`. If a URL variant is added later, append ` ${source.url}`.
- [ ] A fall-through default emits `[block:${(block as any).type ?? "unknown"}]` so future SDK additions never silently drop. Place this as the final `else` after all known cases.
- [ ] Tests in `cline/src/core/task/__tests__/ContextBonsaiApplier.test.ts`:
  - `extractMessageText` returns the image token for a `tool_result` with content `[text, image]` (browser-style fixture).
  - End-to-end: prune `from_pattern: "image/png"` resolves to a message containing a base64 PNG screenshot.
  - Top-level `thinking` block contributes its `thinking` text to the search corpus and is matchable.
  - Top-level `image`, `document` blocks produce stable tokens.
  - Top-level `redacted_thinking` produces `[redacted_thinking]`.
  - Round-trip: an unknown future block type (e.g. `{ type: "future_block_type", x: 1 }`) emits `[block:future_block_type]` rather than empty string.
- [ ] Side-repo (`cline_context_bonsai`) has no changes (resolver is shape-agnostic via callback).
- [ ] `cd cline && npm run check-types` passes.
- [ ] `cd cline && npm run test:unit` passes.

## Implementation Tasks

1. Modify `extractMessageText` (`ContextBonsaiApplier.ts:131-153`):
   - Inner `tool_result.content` loop (`:144-149`): after the `text` branch, add an `image` branch that pushes the rendered token.
   - Outer block loop (`:136-152`): after the `tool_result` branch, add branches for `image`, `thinking`, `redacted_thinking`, `document`. End with a fall-through `else` that pushes `[block:${type}]`.
2. Add the test cases listed in ACs to `cline/src/core/task/__tests__/ContextBonsaiApplier.test.ts`.
3. Run `cd cline && npm run check-types`.
4. Run `cd cline && npm run test:unit`.

## Testing Strategy

Agent-repo mocha + should.js (matches existing `ContextBonsaiApplier.test.ts` convention). Test fixtures use real Anthropic SDK shapes (`ImageBlockParam`, `DocumentBlockParam`, etc.); for forward-compat test, use a typed-cast object literal.

## Validation Commands

- `cd /home/basil/projects/context-bonsai-agents/cline && npm run check-types`
- `cd /home/basil/projects/context-bonsai-agents/cline && npm run test:unit`

## Worktree Artifact Check

- Checked At: 2026-04-25
- Planned Target Files:
  - `cline/src/core/task/ContextBonsaiApplier.ts`
  - `cline/src/core/task/__tests__/ContextBonsaiApplier.test.ts`
- Overlaps Found (path + class): none. `git status --short` in `cline/` empty; both targets are also targets of C1 — landing C1 + C2 (+ C3) in one PR per the dependency note avoids overlap conflict.
- Escalation Status: none
- Decision Citation: n/a

## Plan Approval and Commit Status

- Approval Status: llm-agent-approved
- Approval Citation: validation loop iteration 2 cleared all findings (SDK field-name verification: image source has no `url` variant in pinned SDK; document source has no `url` variant; both URL branches dropped from ACs with forward-compat notes; C3 dependency clarified as orchestrator-enforced).
- Plan Commit Hash: b243a03
- Ready-for-Orchestration: yes

## Validation Loop Results

- Missing details check: pass (iteration 2). Iter-1 findings: (1) `ImageBlockParam.source` URL variant doesn't exist in pinned SDK — branch dropped; (2) `DocumentBlockParam.source` URL variant doesn't exist — branch dropped; (3) C3 dependency wording softened to orchestrator-enforced.
- Ambiguity check: pass (iteration 2). Iter-1 confirmed: image-only `tool_result.content` placement, top-level union membership of all four added block types.
- Worktree artifact risk check: pass. `cline/` clean.
- Plan-commit status check: pending until commit.
- Iterations run: 2
