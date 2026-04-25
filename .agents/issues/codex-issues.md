# Codex Context Bonsai — Known Issues

Source spec: `/home/basil/projects/context-bonsai-agents/docs/context-bonsai-agent-spec.md` (Pattern Matching Contract, current as of commit `9f1ca61`).
Per-agent spec: `/home/basil/projects/context-bonsai-agents/docs/agent-specs/codex-context-bonsai-spec.md` (commit `4d87eb9`).
v1 implementation pinned at parent commit `4b7d0c8` (codex_context_bonsai @ `ebf73cfb5`, codex @ `8e62af863`).

## Issue CO1: extract_text emits empty for 11 of 13 ResponseItem variants and never extracts FunctionCall.name (spec violation, MUST)

**Currently understood:** `extract_text` at `codex/codex-rs/core/src/context_bonsai.rs:100` (called by `project_message_for_matching` at `:88-153`) emits empty string for `FunctionCallOutput`, `CustomToolCallOutput`, `ToolSearchCall`, `ToolSearchOutput`, `LocalShellCall`, `WebSearchCall`, `ImageGenerationCall`, `GhostSnapshot`, `Compaction`, and `Other` (`:142-151`). For `FunctionCall { arguments }` it emits only the `arguments` JSON — `name` is never extracted. For `CustomToolCall { input }` likewise — name dropped. As a result a `from_pattern` cannot match by tool name, and cannot match any tool output at all. Violates Pattern Matching Contract bullet 1 (MUST: tool-call name AND output must be searchable via stable representation).

**Verification:** Yes. `extract_text` (`codex/codex-rs/core/src/context_bonsai.rs:110-153`) emits `""` for 10 of 13 `ResponseItem` variants, and for the two tool-call variants it does cover (`FunctionCall`, `CustomToolCall`) it returns only the `arguments`/`input` JSON string — the `name` field is dropped on the floor. `FunctionCallOutput`, `CustomToolCallOutput`, `ToolSearchOutput` (which carry the model-visible tool result body) all fall into the empty-string arm at `:142-151`, so a `from_pattern`/`to_pattern` cannot reach any tool output text whatsoever.

**Evidence:**
- `ResponseItem` enum is defined at `codex/codex-rs/protocol/src/models.rs:447-600`. The 13 variants and what `extract_text` returns today:
  - `Message { content }` → first `InputText`/`OutputText` (good).
  - `Reasoning { summary, content }` → first reasoning text or summary (good).
  - `FunctionCall { name, namespace, arguments, call_id, .. }` → ONLY `arguments` (`:121`). `name` dropped.
  - `CustomToolCall { name, input, call_id, .. }` → ONLY `input` (`:122`). `name` dropped.
  - `FunctionCallOutput { call_id, output: FunctionCallOutputPayload }` → `""` (`:143`). Body is reachable via `output.body.to_text()` (`models.rs:1103`) but never used.
  - `CustomToolCallOutput { call_id, name, output }` → `""` (`:142`). Same `FunctionCallOutputPayload` shape.
  - `ToolSearchCall { execution, arguments: serde_json::Value, .. }` → `""` (`:144`).
  - `ToolSearchOutput { execution, status, tools: Vec<Value>, .. }` → `""` (`:145`).
  - `LocalShellCall { action: LocalShellAction::Exec(LocalShellExecAction{ command: Vec<String>, .. }), .. }` → `""` (`:146`).
  - `WebSearchCall { action: Option<WebSearchAction> }` → `""` (`:148`). `WebSearchAction::Search { query, queries }` etc. carries the user-visible search query.
  - `ImageGenerationCall { revised_prompt, result, .. }` → `""` (`:149`).
  - `GhostSnapshot { ghost_commit }` → `""` (`:147`). Internal undo state, not model-visible (`tasks/undo.rs:82`).
  - `Compaction { encrypted_content }` → `""` (`:150`). Opaque encrypted blob; not human-visible content.
  - `Other` → `""` (`:151`). Unknown forward-compatibility variant; safe to leave empty.
- Production producers confirm what is actually model-visible: `LocalShellCall`/`WebSearchCall`/`ImageGenerationCall`/`ToolSearchCall`/`ToolSearchOutput` are all surfaced through `arc_monitor.rs:278-401`, `turn_timing.rs:177-183`, `event_mapping.rs:182-193` and `stream_events_utils.rs:149-155` (where they are flagged as `response_item_may_include_external_context`). They are real wire payloads, not dead code. `GhostSnapshot` and `Compaction` are filtered out of normal model-visible paths (`compact.rs:271`, `compact_remote.rs:153`, `context_manager/history.rs:106`) so leaving them empty is spec-compliant.
- `MessageForMatching::text` is `&'a str` (`codex_context_bonsai/src/guards.rs:29`), so `extract_text` cannot synthesize new owned strings without lifetime support. Every implementer fix has to materialize projected text into an owned buffer that the borrow lives in.
- `resolve_pattern` does substring search on `text` (`codex_context_bonsai/src/guards.rs:108-139`), so adding `name` and `output.body` to projected text immediately makes them matchable end-to-end with no resolver change.

**Implementer notes:**
- Switch `extract_text` from `fn(&ResponseItem) -> &str` to a projector that builds an owned `String` per row, materialized once in `build_prune_install` into a `Vec<String>` whose entries are borrowed by the `MessageForMatching` slice. Keeps `MessageForMatching::text: &'a str` unchanged across all four ports.
- Per-variant stable representations (newline-joined, fixed key order — Rust's `serde_json::to_string` over a `BTreeMap<&str, Value>` is stable by default; mirrors the OpenCode `stableSerialize` model at `opencode_context_bonsai_plugin/src/prune-pattern.ts:6-51`):
  - `Message`/`Reasoning`: unchanged (existing behavior is correct).
  - `FunctionCall`: `format!("tool:{name}\ninput:{arguments}")`. Include `namespace` when `Some` (`namespace:{ns}\n` between tool: and input:).
  - `FunctionCallOutput`: `format!("tool_output:{call_id}\noutput:{}", output.body.to_text().unwrap_or_default())`.
  - `CustomToolCall`: `format!("custom_tool:{name}\ninput:{input}")`.
  - `CustomToolCallOutput`: `format!("custom_tool_output:{}\noutput:{}", name.as_deref().unwrap_or(""), output.body.to_text().unwrap_or_default())`.
  - `ToolSearchCall`: `format!("tool_search:{execution}\narguments:{}", serde_json::to_string(arguments).unwrap_or_default())`.
  - `ToolSearchOutput`: `format!("tool_search_output:{execution}\nstatus:{status}\ntools:{}", serde_json::to_string(tools).unwrap_or_default())`.
  - `LocalShellCall`: project the `LocalShellAction::Exec` command as `format!("shell:{}\ncwd:{}", command.join(" "), working_directory.as_deref().unwrap_or(""))`.
  - `WebSearchCall`: project `action` — `Search { query, queries }` → `format!("web_search:{}", query.clone().unwrap_or_default())` plus joined `queries`; `OpenPage { url }` → `format!("web_open:{}", url)`; `FindInPage { url, pattern }` → include both; `Other`/`None` → `""`.
  - `ImageGenerationCall`: `format!("image_generation:{}\nresult_len:{}", revised_prompt.as_deref().unwrap_or(""), result.len())`. Do NOT include the raw base64 `result` body (very large, no value for matching).
  - `GhostSnapshot`, `Compaction`, `Other`: empty string is correct. Document in a comment that these are not model-visible (Compaction is encrypted; GhostSnapshot is undo-only and stripped from prompts by `compact.rs:271` / `context_manager/history.rs:106`; Other is the serde catch-all).
- New tests in `codex/codex-rs/core/src/context_bonsai_tests.rs` (projector, alongside existing `extract_text_returns_reasoning_content_for_matching` at `:317`):
  - `extract_text_includes_function_call_name_and_arguments`: assert projection of `FunctionCall { name: "context-bonsai-prune", arguments: "{\"from_pattern\":\"X\"}" }` contains BOTH `context-bonsai-prune` and `from_pattern`.
  - `extract_text_includes_function_call_output_body`: assert projection of `FunctionCallOutput` whose `body = Text("compilation succeeded")` contains `compilation succeeded`.
  - One test per non-empty variant (`CustomToolCall`, `CustomToolCallOutput`, `ToolSearchCall`, `ToolSearchOutput`, `LocalShellCall`, `WebSearchCall::Search`, `ImageGenerationCall`) asserting non-empty projected text and that the field that carries the model-visible payload is substring-matchable.
  - `build_prune_install_matches_by_tool_name`: end-to-end — history with `FunctionCall { name: "shell", arguments: "{}" }` paired with output, prune with `from_pattern: "tool:shell"`, assert success.
  - `build_prune_install_matches_by_tool_output_body`: end-to-end — `FunctionCallOutput` body contains `"entries"`, `to_pattern: "entries"`, assert success and that the matched index is the output row.
  - `extract_text_empty_for_internal_variants`: assert `GhostSnapshot`, `Compaction`, `Other` project to `""`.
- New tests in `codex_context_bonsai/tests/guards.rs` (resolver level — language-agnostic): a `MessageForMatching` whose `text` contains both `tool:context-bonsai-prune` and `from_pattern:"older"` resolves uniquely on either substring.
- Side effects on existing tests:
  - `function_call`/`function_call_output` helpers (`context_bonsai_tests.rs:373-391`) and the four `build_prune_install_*` tests around `:393-460` use raw substring patterns like `r#""cmd":"ls""#` against `arguments`. Those remain correct because `arguments` is still in the projected text — just now wrapped in `tool:shell\ninput:{...}`. Verify each passes after the change; no fixture rewrites expected.
  - `default_item_id` / `stable_hashed_id` (`context_bonsai.rs:217-240`) hash the `extract_text` window. The hash changes for every variant whose projection grew — this affects content-hashed anchor ids. Any compact/reconstruct fixture that hard-codes a specific `bonsai-anchor-XXXX` hex value will need its expected id updated. A grep for `bonsai-anchor-[0-9a-f]` across `core/src` and `codex_context_bonsai/tests` will surface them.
- **CO1↔CO2 coupling:** once `name` is in the projected text, the v1 self-poisoning bug expands. Today the wrapper-filter MUST in `cb61f00` is needed for the args text echoed in a failed `context-bonsai-prune` call; after CO1 lands the same retry will ALSO collide on the literal string `tool:context-bonsai-prune` in every prior wrapper row. The CO2 wrapper filter must therefore identify wrapper rows by `ResponseItem::FunctionCall { name == "context-bonsai-prune", .. }` (or projected `tool:context-bonsai-prune`) — covering BOTH name-text matches and args-text matches. Land CO1 and CO2 in the same change set so the projector never ships in a self-poisoning state.

## Issue CO2: prune-wrapper filter not implemented (spec violation, MUST; ACTIVE BUG)

**Currently understood:** Codex is the ONLY port where the prune-wrapper self-poisoning bug exists in production today. `FunctionCall.arguments` JSON IS in `MessageForMatching.text` (`context_bonsai.rs:121`), so a failed prune call's `from_pattern`/`to_pattern`/`summary` text collides with the retry pattern. `codex_context_bonsai/src/guards.rs` `resolve_pattern` (lines 108-139, ambiguity branch at `:137`) does not implement the wrapper filter required by the cross-agent spec (commit `cb61f00`).

**Verification:** Yes. The bug is real and active in production. `resolve_pattern` in `codex_context_bonsai/src/guards.rs` has zero wrapper-filter logic — its ambiguity branch is a single `count => Err(GuardError::Ambiguous { which, count })` arm at line 137. `MessageForMatching` (lines 21-41) carries only `id`/`text`/`in_archive`/`malformed` — no `is_prune_wrapper` field. The wrapper-side `project_message_for_matching` at `codex/codex-rs/core/src/context_bonsai.rs:88-100` does no prune-call filtering, and `extract_text` at `:121` returns `FunctionCall.arguments` verbatim (and `:122` returns `CustomToolCall.input` verbatim), so a failed prune call's `from_pattern`/`to_pattern`/`summary` JSON literally lands in `MessageForMatching.text` and self-collides on retry.

**Evidence:**
- `codex_context_bonsai/src/guards.rs:108-139` — `resolve_pattern` body. Ambiguity branch verbatim: `count => Err(GuardError::Ambiguous { which, count }),` (line 137). No filter precedes the `match matches.len()` block.
- `codex_context_bonsai/src/guards.rs:21-41` — `pub struct MessageForMatching<'a>` has only `id: &'a str`, `text: &'a str`, `in_archive: bool`, `malformed: bool`. Generic over `'a`.
- `codex/codex-rs/core/src/context_bonsai.rs:121-122` — `ResponseItem::FunctionCall { arguments, .. } => arguments.as_str()` and `ResponseItem::CustomToolCall { input, .. } => input.as_str()` — both call paths flow user-supplied pattern text into `MessageForMatching.text`.
- `codex/codex-rs/core/src/context_bonsai.rs:88-100` — `project_message_for_matching` constructs `MessageForMatching` with no caller-side wrapper filter; nothing else in the file filters by tool name either.
- `codex_context_bonsai/src/lib.rs:41` — `pub const PRUNE_TOOL_NAME: &str = "context-bonsai-prune";` already exported. The handler at `codex/codex-rs/core/src/tools/handlers/context_bonsai.rs:1,66,87` confirms this is the literal `name` string used for both `FunctionCall` and `CustomToolCall` dispatch.
- No occurrences of `is_prune_wrapper` anywhere in `codex_context_bonsai/` or `codex/codex-rs/core/src/`.

**Implementer notes:**
- Side crate (`codex_context_bonsai/src/guards.rs`): add `pub is_prune_wrapper: bool` to `MessageForMatching<'a>` (plain `bool`, not borrowed — lifetime stays as-is). Update all in-tree constructors and tests.
- Side crate (`codex_context_bonsai/src/lib.rs` or new helper module): add `pub fn is_prune_wrapper_response_item(item: &ResponseItem) -> bool` returning `true` for `ResponseItem::FunctionCall { name, .. }` or `ResponseItem::CustomToolCall { name, .. }` where `name == PRUNE_TOOL_NAME`. Re-export from `lib.rs`. Note: `ResponseItem` is a `codex_protocol` type, so the side crate must take a `codex_protocol` dep (already present transitively via the agent-repo wrapper) — if cross-crate dep is undesirable, place the predicate in the agent repo instead and only add the bool field to the side crate.
- Agent repo (`codex/codex-rs/core/src/context_bonsai.rs`): `project_message_for_matching` gains a 5th parameter `is_prune_wrapper: bool` OR computes it inline from `item` via the predicate. Both call sites in `build_prune_install` (the global-malformed projection at lines 552-560 and the range-malformed projection at lines 570-578) must pass the flag.
- Resolver (`resolve_pattern` in `guards.rs`): BEFORE the `match matches.len()` block (i.e. between line 130 and line 131), insert: if `matches.len() > 1`, retain only matches whose `messages[m.index].is_prune_wrapper == false`; if exactly one survivor remains, replace `matches` with that singleton. Otherwise leave `matches` unchanged so the existing 0/1/many arms fire identically. This preserves `NoMatch`/single-success/`Ambiguous` semantics for non-pathological cases.
- Required tests — side-crate (`guards_tests.rs`): (1) two matches, one wrapper + one real → returns the real match. (2) two matches, both wrappers → still `Ambiguous { count: 2 }` (filter must not over-collapse). (3) two matches, neither wrapper → `Ambiguous { count: 2 }` unchanged. (4) one match, wrapper → returns it (single-match path is not filtered). Plus predicate unit tests covering `FunctionCall` with name `"context-bonsai-prune"` (true), `CustomToolCall` with same name (true), `FunctionCall` with other name (false), non-call variants (false).
- Required tests — agent repo (`context_bonsai_tests.rs`): end-to-end `build_prune_install` with a transcript where a prior failed `FunctionCall` for `context-bonsai-prune` carries the same `from_pattern` text as a real user message, and assert the real message wins; same scenario with `CustomToolCall`.
- **CO1↔CO2 coupling:** CO2 is independently valuable today — the v1 `extract_text` already lumps `FunctionCall.arguments` into `MessageForMatching.text`, so failed-prune args already self-poison retries. CO2 alone closes the active bug. Once CO1 lands and adds tool-`name` plus output bodies to projected text, retries can additionally collide on the literal `tool:context-bonsai-prune` string — at that point the same wrapper filter (matching by `ResponseItem::FunctionCall::name == "context-bonsai-prune"`) covers both name-text and args-text matches with no further change. Land CO1 + CO2 in one PR if doing both; otherwise CO2 alone is a valid forward-only fix.
