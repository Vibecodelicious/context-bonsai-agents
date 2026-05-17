# Story: archived-filter patch — the context-shrink patch

**Epic:** Re-implement Context Bonsai for Claude Code on tweakcc 4.0
**Size:** Medium
**Dependencies:** Story 2 (`patches/types.ts`, registry, harness), Story 3 (`patches/discovery.ts`)

## Story Description

Implement `patches/archived-filter.patch.ts` — the patch that makes context actually shrink, and the direct fix for the bug that motivated this epic.

The patch targets Claude Code's transcript visibility predicate: the function `function X(Y){switch(Y.type){...}}` that decides which messages are included when the request is assembled. The patch injects, ahead of that switch, code that on first use reads `~/.claude/archived-<session>.json` (the marker file the MCP server writes), caches it with mtime tracking, and returns "not visible" (false) for any message whose `uuid` is in the archived list. Archived messages therefore never reach the provider — context shrinks.

The reference implementation is `the_observer/tweakcc/src/patches/archivedFilter.ts`: the matcher regex at L9, candidate scoring at L28–39, the `minScore` floor at L47, the injection at L82–92. This story re-expresses it as a `BonsaiPatch` transform module per epic Contract A, using Story 3's `discovery.ts` for both patch-point location and runtime-helper resolution (`fsFunc` to read the marker file) instead of the fork's own helpers.

Per epic Contract A the module exports one `BonsaiPatch` with `name: "archived-filter"` and `sentinel: "/*cb:archived-filter:v1*/"`. Per epic Contract C that sentinel is the single artifact the MCP server (Story 7) scans the running binary for to confirm the patch is live — this story injects it; Story 7 reads it; there is no separate state file.

The `apply` transform runs in the harness process (trusted, not the `adhoc-patch` sandbox). The *injected* code runs later inside Claude Code with full host access — it uses a `globalThis` cache and Bun host APIs; that distinction matters for the native-binary acceptance check below.

## User Model

### User Gamut

Examples only:

- A developer deep in a long Claude Code session who prunes a range and needs the token count to actually drop.
- A developer on a native install — the case where the old port silently did nothing.
- A developer on an npm `cli.js` install.
- The maintainer verifying, after a Claude Code release, that the visibility-predicate anchor still resolves.

### User-Needs Gamut

Examples only:

- Prune that measurably reduces tokens sent to the provider — not just a success message.
- Correct behavior on the native binary, not only on `cli.js`.
- The injected filter must not break unrelated transcript rendering or non-archived messages.
- A cache that picks up marker-file changes (a later retrieve) without restarting Claude Code.

### Design Implications

- Patch-point location goes through `discovery.selectUnique` — no bespoke regex; the visibility predicate is one of 133 `switch(X.type)` sites.
- The injected reader must fail safe: a missing/empty/corrupt marker file means "filter nothing," never a crash.
- The injected code uses host globals (`globalThis` cache, `Buffer`); these are verified in `cli.js` but MUST be re-verified inside the repacked native binary.
- Full functional proof (prune → measured token drop, secret oracle) is owned by Story 8's Protocol A; this story's own bar is that the patch applies, self-verifies, and the injected code executes correctly in a repacked native binary.

## Acceptance Criteria

- [ ] `patches/archived-filter.patch.ts` exports a `BonsaiPatch` with `name: "archived-filter"` and `sentinel: "/*cb:archived-filter:v1*/"`.
- [ ] The patch locates the visibility predicate via `discovery.selectUnique` and resolves `fsFunc` via `discovery.findRuntimeHelpers` — no bespoke matchers.
- [ ] `apply` throws `BonsaiPatchError` (fail closed) if the anchor is not uniquely resolved.
- [ ] After `apply`, `verifySentinel` confirms the sentinel is present exactly once.
- [ ] The injected runtime code reads `~/.claude/archived-<session>.json`, caches with mtime tracking, and filters archived UUIDs; a missing/empty/corrupt marker file filters nothing and does not throw.
- [ ] The module is registered in `patches/registry.ts` as the first patch.
- [ ] **Native-binary check:** after the harness applies this patch to a copy of a native install and repacks, the rebuilt binary runs and the injected code's host-global usage (`globalThis` cache, `Buffer`/fs access) executes without `ReferenceError` — verified by a runtime smoke check.
- [ ] `bun run typecheck` and `bun test` pass.

## Context References

### Relevant Codebase Files (must read)

- `/home/basil/projects/the_observer/tweakcc/src/patches/archivedFilter.ts` - reference implementation (matcher L9, scoring L28–39, minScore L47, injection L82–92).
- `tweakcc_context_bonsai/src/lib/compact.ts:74` - `getArchivedMarkerPath()`; the marker-file path/format the injected code reads.
- `tweakcc_context_bonsai/src/lib/compact.ts:103` - `addArchivedMarkerEntries()`; the writer side of the IPC contract.
- `tweakcc_context_bonsai/patches/discovery.ts` - Story 3 API (`selectUnique`, `findRuntimeHelpers`, `verifySentinel`).
- `tweakcc_context_bonsai/patches/types.ts` - `BonsaiPatch` interface.

### New Files to Create

- `tweakcc_context_bonsai/patches/archived-filter.patch.ts`
- `tweakcc_context_bonsai/patches/archived-filter.patch.test.ts`

### Relevant Documentation

- The epic, Contracts A and C.
- `docs/context-bonsai-agent-spec.md:172` - the prune MUST this patch makes real.

## Implementation Plan

### Phase 1: Foundation

- Read `archivedFilter.ts` and the marker-file helpers in `compact.ts`.

### Phase 2: Core Implementation

- Implement the `BonsaiPatch`: locate the visibility predicate via `discovery`, build the injected reader/cache/filter snippet, splice it in, append the sentinel.

### Phase 3: Integration

- Register the module in `patches/registry.ts` (position 1).

### Phase 4: Testing and Validation

- Unit tests against fixtures; the native repack + runtime smoke check.

## Step-by-Step Tasks

1. Read the reference patch and the `compact.ts` marker helpers.
2. Implement `archived-filter.patch.ts` as a `BonsaiPatch` using `discovery`.
3. Define the injected snippet: marker read, mtime cache, archived-UUID filter, fail-safe on missing/corrupt file.
4. Append the `/*cb:archived-filter:v1*/` sentinel; self-verify with `verifySentinel`.
5. Register the module in `patches/registry.ts` as patch 1.
6. Write `archived-filter.patch.test.ts` (fixture-based unit tests).
7. Run the harness against a copied native install; smoke-test the repacked binary's injected host-global usage.
8. Run `bun run typecheck` and `bun test`.

## Testing Strategy

- Unit: anchor resolution on fixtures, fail-closed on a no-match fixture, sentinel self-verification, the injected filter's behavior incl. missing/corrupt marker file.
- Native integration: apply via the Story 2 harness to a copied native binary, repack, run, and confirm the injected code executes without a host-global `ReferenceError`. Skip-with-reason if no native install is present.
- Full functional proof (token reduction, secret oracle) is exercised in Story 8.

## Validation Commands

- `cd tweakcc_context_bonsai && bun run typecheck`
- `cd tweakcc_context_bonsai && bun test patches/archived-filter.patch.test.ts`

## Worktree Artifact Check

- Checked At: `2026-05-17T22:18:10Z`
- Planned Target Files: `tweakcc_context_bonsai/patches/archived-filter.patch.ts`, `patches/archived-filter.patch.test.ts`, `patches/registry.ts` (modified — created by Story 2)
- Overlaps Found (path + class): `none` (side repo clean at `a3c5c81`; new files absent; `registry.ts` is a Story 2 artifact not yet on disk at check time)
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
