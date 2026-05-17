# Story: message-content-ids patch

**Epic:** Re-implement Context Bonsai for Claude Code on tweakcc 4.0
**Size:** Medium
**Dependencies:** Story 2 (`patches/types.ts`, registry, harness), Story 3 (`patches/discovery.ts`)

## Story Description

Implement `patches/message-content-ids.patch.ts` — the patch that lets the model address messages for pruning and retrieval.

The patch targets Claude Code's message-to-API converter (the function that turns stored user/assistant messages into API-ready objects). It injects a wrapper that, **only when the marker file `~/.claude/compaction-mode-<session>` exists**, appends a `[msg:<uuid>]` text tag to each message's model-visible content. With those tags present the model can name a precise range to `context-bonsai-prune` and an exact anchor to `context-bonsai-retrieve`.

The reference implementation is `the_observer/tweakcc/src/patches/messageContentIds.ts`: five converter-matching regexes at L14–44 (covering several minification shapes), the `_tag()` helper at L83–89, and the mode-gated wrapper at L111/L144. This story re-expresses it as a `BonsaiPatch` transform module per epic Contract A, using Story 3's `discovery.ts` for patch-point location and `findRuntimeHelpers` for the `sessionIdFunc` (needed to build the marker path).

Per epic Contract A the module exports one `BonsaiPatch` with `name: "message-content-ids"` and `sentinel: "/*cb:message-content-ids:v1*/"`. It is the second patch in the registry, so its `apply` transform receives the content already modified by `archived-filter` and MUST locate its anchor against that modified content.

This patch does not use a `globalThis` cache or `Buffer`; it only checks file existence and string-concatenates a tag. It therefore does not carry the native-host-global acceptance check that Stories 4 and 6 do — its native correctness is covered by the Story 8 e2e run.

## User Model

### User Gamut

Examples only:

- A developer asking the model to prune "from the message about X to the message about Y" — the tags make that resolvable.
- The model itself, choosing an anchor to retrieve.
- A developer who has never enabled compaction mode — for them the tags must be entirely absent (no visual noise, no token cost).
- The maintainer checking the converter anchor still resolves after a Claude Code release.

### User-Needs Gamut

Examples only:

- Stable, model-visible identifiers that make prune/retrieve ranges unambiguous.
- Zero footprint when compaction mode is off — gated strictly on the marker file.
- Tags that do not corrupt message content or break rendering.
- Resilient anchoring across minification changes in the converter.

### Design Implications

- Patch-point location goes through `discovery` with multiple candidate patterns (the converter has several minification shapes — the reference uses five regexes).
- The mode gate is a per-call `existsSync` check on `compaction-mode-<session>`, so toggling mode needs no Claude Code restart.
- As patch 2, it must anchor against `archived-filter`-modified content; its discovery patterns must not accidentally match `archived-filter`'s injected snippet.
- `sessionIdFunc` comes from `discovery.findRuntimeHelpers`, not a bespoke matcher.

## Acceptance Criteria

- [ ] `patches/message-content-ids.patch.ts` exports a `BonsaiPatch` with `name: "message-content-ids"` and `sentinel: "/*cb:message-content-ids:v1*/"`.
- [ ] The converter anchor is located via `discovery.selectUnique`; `sessionIdFunc` via `discovery.findRuntimeHelpers`.
- [ ] `apply` throws `BonsaiPatchError` (fail closed) if the anchor is not uniquely resolved.
- [ ] After `apply`, `verifySentinel` confirms the sentinel is present exactly once.
- [ ] The injected wrapper appends `[msg:<uuid>]` tags only when `~/.claude/compaction-mode-<session>` exists, and is a no-op otherwise.
- [ ] `apply` operates correctly on content already transformed by `archived-filter` (verified by composing both in the test).
- [ ] The module is registered in `patches/registry.ts` as the second patch.
- [ ] `bun run typecheck` and `bun test` pass.

## Context References

### Relevant Codebase Files (must read)

- `/home/basil/projects/the_observer/tweakcc/src/patches/messageContentIds.ts` - reference implementation (five regexes L14–44, `_tag()` L83–89, mode-gated wrapper L111/L144).
- `tweakcc_context_bonsai/mcp-server/index.ts` - confirm the `compaction-mode-<session>` marker path/semantics the MCP server creates.
- `tweakcc_context_bonsai/patches/discovery.ts` - Story 3 API.
- `tweakcc_context_bonsai/patches/types.ts` - `BonsaiPatch` interface.

### New Files to Create

- `tweakcc_context_bonsai/patches/message-content-ids.patch.ts`
- `tweakcc_context_bonsai/patches/message-content-ids.patch.test.ts`

### Relevant Documentation

- The epic, Contract A (apply order; compose-over-modified-content rule).

## Implementation Plan

### Phase 1: Foundation

- Read `messageContentIds.ts` and confirm the `compaction-mode-<session>` marker contract.

### Phase 2: Core Implementation

- Implement the `BonsaiPatch`: locate the converter via `discovery`, build the `_tag` helper and the mode-gated wrapper, splice it in, append the sentinel.

### Phase 3: Integration

- Register the module in `patches/registry.ts` (position 2).

### Phase 4: Testing and Validation

- Unit tests, including composition after `archived-filter`.

## Step-by-Step Tasks

1. Read the reference patch; confirm the marker contract in `mcp-server/index.ts`.
2. Implement `message-content-ids.patch.ts` as a `BonsaiPatch` using `discovery`.
3. Build the `_tag` helper and the `compaction-mode`-gated converter wrapper.
4. Append the `/*cb:message-content-ids:v1*/` sentinel; self-verify.
5. Register the module in `patches/registry.ts` as patch 2.
6. Write `message-content-ids.patch.test.ts`, including a compose-after-archived-filter case.
7. Run `bun run typecheck` and `bun test`.

## Testing Strategy

- Unit: anchor resolution across the converter fixture shapes, fail-closed on a no-match fixture, sentinel self-verification, tag injection present/absent by marker-file state.
- Composition: apply `archived-filter` then `message-content-ids` to the same fixture and confirm both anchors resolve and both sentinels are present.

## Validation Commands

- `cd tweakcc_context_bonsai && bun run typecheck`
- `cd tweakcc_context_bonsai && bun test patches/message-content-ids.patch.test.ts`

## Worktree Artifact Check

- Checked At: `2026-05-17T22:18:10Z`
- Planned Target Files: `tweakcc_context_bonsai/patches/message-content-ids.patch.ts`, `patches/message-content-ids.patch.test.ts`, `patches/registry.ts` (modified — created by Story 2)
- Overlaps Found (path + class): `none` (side repo clean at `a3c5c81`; new files absent)
- Escalation Status: `none`
- Decision Citation: `none`

## Plan Approval and Commit Status

- Approval Status: `approved`
- Approval Citation: `User approval: "Approved" (2026-05-17)`
- Plan Commit Hash: `none`
- Ready-for-Orchestration: `no`

## Completion Checklist

- [ ] All acceptance criteria met
- [ ] Validation commands pass
- [ ] Plan approved and committed before orchestration begins
- [ ] User-model ambiguities resolved or escalated
- [ ] Worktree artifact overlaps resolved (approved direction or explicit deferral)
