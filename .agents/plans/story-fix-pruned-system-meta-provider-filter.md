# Story: Fix Pruned System Meta Provider Filter

## Goal

Fix the Claude Code/tweakcc prune path so pruning a contiguous JSONL range cannot leave provider-visible host system/meta entries behind in positions that violate Anthropic message ordering rules, and update the shared and Claude-specific specs so future ports account for provider API semantics when hiding archived ranges.

## User Model

### User Gamut

- Claude Code users running long interactive sessions where `/context`, local commands, away summaries, and timing rows may appear between normal user/assistant turns.
- Context Bonsai maintainers forward-porting closed-source or minified hosts where provider-bound transcript maps differ from storage records.
- Port authors for other harnesses whose storage model includes non-conversational rows, system reminders, tool bookkeeping, or host metadata that may still map to provider messages.
- Reviewers and operators who need e2e evidence that a prune succeeded semantically, not only that the prune tool returned success text.

### User-Needs Gamut

- A successful prune must not cause the next provider request to fail with Anthropic role-ordering errors.
- Archived ranges must be hidden from the provider as a coherent provider-visible interval, even when the host stores extra rows inside that interval.
- Retrieve must restore visibility for the same provider-visible units hidden by prune.
- Specs must describe the invariant without assuming every port uses Claude Code marker files.
- Validation must include a real or fixture-backed transcript with system/meta entries inside the pruned span, because ordinary user/assistant-only transcripts do not expose this bug.

### Ambiguities From User Model

- The shared spec should not mandate Claude Code marker-file mechanics. It should state the provider-visible invariant: pruning must not leave archived-range remnants that create invalid provider message ordering or expose archived content.
- The Claude Code implementation should prefer expanding marker coverage for UUID-bearing provider-bound rows inside the archived span over rejecting such ranges. Rejection would avoid the API error but would make pruning brittle because Claude Code commonly inserts JSONL `type: "system"` subtype rows such as `local_command`, `turn_duration`, and `away_summary`; the patched provider seam documents the mapped provider-side system branch as `api_system`, so implementation notes must distinguish storage-row names from provider-map names.

## Context References

- `docs/context-bonsai-agent-spec.md:144` - shared prune execution rules; add provider-ordering/coherent-interval invariant here.
- `docs/context-bonsai-agent-spec.md:217` - shared context transform requirement; clarify archived follower omission includes provider-visible host/system/meta units inside the range.
- `docs/agent-specs/claude-code-context-bonsai-spec.md:46` - Claude Code marker file primitive; currently describes marker storage without the full provider-visible interval requirement.
- `docs/agent-specs/claude-code-context-bonsai-spec.md:64` - Claude-specific prune/retrieve contract; add marker coverage/retrieve cleanup expectations for UUID-bearing system/meta rows.
- `docs/agent-specs/claude-code-context-bonsai-spec.md:71` - transcript mutation path; document that the tweakcc provider filter must hide all provider-bound rows inside the archived interval, not only user/assistant rows.
- `tweakcc_context_bonsai/mcp-server/index.ts:700` - `handlePruneContext` writes the summary row and marker entries after `markMessagesArchived`.
- `tweakcc_context_bonsai/mcp-server/index.ts:817` - current marker entry selection filters to `user`/`assistant`; this is the immediate bug surface.
- `tweakcc_context_bonsai/src/lib/compact.ts:226` - `markMessagesArchived` collects and marks archived messages; currently only user/assistant UUIDs enter archive marker paths.
- `tweakcc_context_bonsai/src/lib/compact.ts:414` - older `compactSession` marker sync path also filters marker entries to user/assistant and must use the same marker UUID derivation as prune if still reachable.
- `tweakcc_context_bonsai/src/lib/compact.ts:436` - existing `getMessageUuidFromAny` handles user/assistant/summary/file-history-snapshot for unarchive lookup; marker coverage must use a separate predicate aligned to the runtime filter, which currently checks only a string `uuid` property.
- `tweakcc_context_bonsai/src/lib/compact.ts:582` - `unarchiveMessages` expands summary metadata to range endpoints before removing the summary; retrieve marker cleanup must derive the full interval marker UUID set at this point or before this mutation is called.
- `tweakcc_context_bonsai/src/lib/compact.ts:675` - `retrieveSession` removes marker entries on retrieval; cleanup must match prune marker coverage.
- `tweakcc_context_bonsai/patches/archived-filter.patch.ts:30` - injected provider-bound filter removes UUIDs listed in `archived-<session>.json`; implementation must feed it every relevant UUID.
- `tweakcc_context_bonsai/patches/anchors.ts:168` - provider-bound seam identifies the mapped system branch as `api_system`, while Claude Code JSONL evidence stores local meta rows as `type: "system"`.
- `tweakcc_context_bonsai/patches/archived-filter.patch.test.ts:75` - existing executable provider-map filter test; extend or mirror it with an archived `api_system`/system-adjacency regression if unit-level provider proof is used.
- `tweakcc_context_bonsai/docs/e2e-protocol.md:145` - E2E-01 contiguous prune success; add evidence for system/meta rows inside a pruned range and no post-prune role-ordering failure.
- `tweakcc_context_bonsai/e2e/native-e2e.ts:259` - current e2e transcript oracle treats only `user`, `assistant`, and `summary` as model transcript rows; update if the e2e oracle is used to prove system/meta row coverage.
- `tweakcc_context_bonsai/e2e/native-e2e.test.ts` - native e2e tests for the harness; update if the e2e oracle behavior changes.

## Acceptance Criteria

- [ ] Shared spec states that archive transforms must preserve provider API message-ordering validity and must hide the entire provider-visible archived interval, including host/system/meta entries that would otherwise remain inside the span.
- [ ] Claude Code spec states that `archived-<session>.json` must include every UUID-bearing provider-bound JSONL row inside the pruned interval, and retrieve must remove the same coverage from the marker.
- [ ] tweakcc prune writes marker entries for all original archived-range entries with a string `uuid` property that the current runtime filter can match, not only `user`/`assistant` rows. This is the conservative approximation of provider-bound coverage for the current seam; over-including non-provider UUID rows is acceptable because the runtime filter only acts on rows present in its provider-bound array. The new helper must not include the appended summary placeholder because it is outside the original archived interval.
- [ ] tweakcc retrieve marker cleanup removes marker entries for the whole restored archived interval, including UUID-bearing system/meta rows that were hidden by prune, by deriving the interval from summary `compactMetadata` before or during summary expansion.
- [ ] Existing `archived: true`/`archivedBy` mutation semantics for user/assistant rows remain compatible with placeholder rendering and retrieve.
- [ ] Unit tests cover a pruned range containing Claude Code `type: "system"` rows such as `local_command`, `turn_duration`, or `away_summary`; after prune those UUIDs are present in the marker, and after retrieve they are removed.
- [ ] Validation includes either a focused provider-filter fixture or e2e protocol update proving that marker-filtered output does not leave a `role: "system"` row in an invalid Anthropic adjacency.
- [ ] Focused and full validation commands pass, or any live Claude Code e2e is recorded as BLOCKED with reason.

## Implementation Tasks

1. Update `docs/context-bonsai-agent-spec.md` with a provider-visible interval validity rule under prune execution/context transform requirements.
2. Update `docs/agent-specs/claude-code-context-bonsai-spec.md` with Claude-specific marker coverage and retrieve cleanup requirements for UUID-bearing system/meta rows inside an archived span.
3. In `tweakcc_context_bonsai/src/lib/compact.ts`, add one authoritative marker UUID derivation helper, exported if needed by `mcp-server/index.ts`. The helper should return each message's string `uuid` from the original archived interval because `archived-filter.patch.ts` filters on `__cbMessage.uuid`; it should not use `messageId` unless the runtime filter is intentionally broadened in the same story.
4. Update every marker writer to use that helper: the explicit prune path in `mcp-server/index.ts:817`, the `compactSession` marker sync path in `src/lib/compact.ts:414`, and the `markMessagesArchived` non-`skipWrite` marker write in `src/lib/compact.ts:321`.
5. Update retrieve cleanup in `src/lib/compact.ts` so it computes marker UUIDs for each restored summary's inclusive `fromMessageId`..`toMessageId` interval before the summary row is removed. Then remove those UUIDs from `~/.claude/archived-<session>.json` after successful unarchive, preserving unrelated marker entries.
6. Add or update tests in `tweakcc_context_bonsai/src/lib/compact.test.ts` and/or `tweakcc_context_bonsai/mcp-server/index.test.ts` for prune and retrieve with interleaved system/meta rows.
7. Add provider-visible regression evidence by either extending `tweakcc_context_bonsai/patches/archived-filter.patch.test.ts` with an archived `api_system`/system-adjacency fixture or recording why the live/native e2e path is sufficient and how it proves provider role ordering.
8. Update `tweakcc_context_bonsai/docs/e2e-protocol.md` so E2E-01 or a new bug-shape scenario requires a pruned range containing `system` subtype rows and verifies no immediate post-prune provider role-ordering error.
9. If the native e2e oracle is used for that evidence, update `tweakcc_context_bonsai/e2e/native-e2e.ts` and related tests so system/meta rows in the pruned interval are not ignored in a way that can false-pass.
10. Run validation commands and record any live-e2e BLOCKED/PASS evidence in the implementation summary or existing e2e results pattern if a live run is performed.

## Testing Strategy

- Unit-test marker writing with a JSONL range containing `user`, `assistant`, and JSONL `system` subtype rows; assert the marker includes all string-`uuid` rows that the provider filter can see.
- Unit-test retrieve after that prune; assert all marker entries for the restored interval are removed while unrelated marker entries remain.
- Keep existing tests proving user/assistant archive metadata and summary placeholder behavior unchanged.
- Add a provider-filter-oriented regression fixture if available in current test helpers: marker-filter the mixed transcript and assert no orphan JSONL `system` / provider `api_system`-equivalent row remains in an invalid position. Do not rely on an e2e oracle that drops system/meta rows before checking the provider-visible sequence.
- Live e2e, if credentials/runtime are available: reproduce the previous post-prune failure shape, then verify a follow-up turn after prune succeeds.

## Validation Commands

Every story plan MUST list the validation commands explicitly. These are the source of truth for the developer's Pre-Implementation Starting-State Check and Completion Rerun; no runtime substitution is permitted.

- `cd tweakcc_context_bonsai && bun test mcp-server/index.test.ts src/lib/compact.test.ts patches/archived-filter.patch.test.ts`
- `cd tweakcc_context_bonsai && bun run typecheck`
- `cd tweakcc_context_bonsai && bun test`
- `git status --short`

## Worktree Artifact Check

- Checked At: `2026-05-29T23:35:23Z`
- Planned Target Files: `docs/context-bonsai-agent-spec.md`, `docs/agent-specs/claude-code-context-bonsai-spec.md`, `tweakcc_context_bonsai/mcp-server/index.ts`, `tweakcc_context_bonsai/mcp-server/index.test.ts`, `tweakcc_context_bonsai/src/lib/compact.ts`, `tweakcc_context_bonsai/src/lib/compact.test.ts`, `tweakcc_context_bonsai/patches/archived-filter.patch.test.ts`, `tweakcc_context_bonsai/docs/e2e-protocol.md`, `tweakcc_context_bonsai/e2e/native-e2e.ts`, `tweakcc_context_bonsai/e2e/native-e2e.test.ts`, `.agents/plans/story-fix-pruned-system-meta-provider-filter.md`
- Overlaps Found (path + class): `.agents/plans/story-fix-pruned-system-meta-provider-filter.md -> existing-untracked` because this planning task created the plan file before approval/commit. No tracked-dirty or existing-untracked overlaps for implementation target files. Nested submodule check for `tweakcc_context_bonsai` target paths was clean. Unrelated untracked files exist under `opencode/packages/opencode/src/provider/` and are not planned targets.
- Escalation Status: approved for the plan artifact only; none for implementation target files
- Decision Citation: user requested creation of this story in the current turn: "use planning_guidance.md to create a story for this"

## Plan Approval and Commit Status

- Approval Status: approved
- Approval Citation: user replied "approved" after final validation result
- Plan Commit Hash: d68ab7c
- Ready-for-Orchestration: yes

## Validation Loop Results

- Missing details check: iteration 1 found marker derivation and retrieve cleanup gaps; plan revised to centralize marker UUID derivation and require pre-mutation interval cleanup derivation. Iteration 2 found no blocking gaps, but identified that native e2e/provider-filter regression targets were under-specified; plan revised to include `patches/archived-filter.patch.test.ts`, `e2e/native-e2e.ts`, and `e2e/native-e2e.test.ts` as conditional targets when provider-visible evidence uses those paths.
- Ambiguity check: iteration 1 found multiple marker-writer paths and storage/provider system naming ambiguity; plan revised to name all marker writers and distinguish JSONL `system` rows from provider `api_system` mapping. Iteration 2 found no unresolved high-impact ambiguity; plan clarified that all string-UUID rows in the original interval are the conservative approximation for current marker coverage.
- Worktree artifact risk check: iteration 1 found the plan file itself as existing-untracked; plan revised to record that planning-artifact overlap and confirm no implementation-target overlap. Iteration 2 confirmed no implementation-target overlap and noted unrelated `opencode` generated provider snapshot files outside planned scope.
- Plan-commit status check: pending approval and commit
- Iterations run: 2
