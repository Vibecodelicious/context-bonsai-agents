# Story: MCP server and ccsnap refresh, with patch-aware fail-closed

**Epic:** Re-implement Context Bonsai for Claude Code on tweakcc 4.0
**Size:** Medium
**Dependencies:** Stories 4, 5, 6 (IPC alignment is verified against the final patches; the `archived-filter` sentinel value comes from Story 4)

## Story Description

Refresh the MCP server and the `ccsnap` CLI against current Claude Code (2.1.x), and add the patch-presence guard that is the root-cause fix for the bug behind this epic.

Two parts:

**(a) Refresh.** Verify — and fix only where drifted — that the MCP server and `ccsnap` still align with current Claude Code: session discovery (`discoverSessionPath`, the parent-process walk), the JSONL session-file format, and the three IPC files (`~/.claude/archived-<session>.json`, `~/.claude/compaction-mode-<session>`, the session JSONL). Confirm the authoritative MCP **registration file**: current Claude Code 2.1.x registers MCP servers in `~/.claude.json` (both a top-level `mcpServers` map and per-project maps), not `settings.json` — verify against the live file and record the finding for Stories 8 and 9. Bump versions consistently (`package.json` is at `0.1.0`).

**(b) Patch-aware fail-closed (epic Contract C — the root-cause fix).** Today the MCP `context-bonsai-prune` handler writes an archive marker unconditionally; if the `archived-filter` patch is not present in the running Claude Code, nothing consumes that marker and context never shrinks — prune silently no-ops while the model believes it succeeded. Fix: before `handlePruneContext` writes any archive, it MUST resolve the running Claude Code executable (via the parent-process chain it already walks for session discovery) and scan that file for the `archived-filter` patch sentinel `/*cb:archived-filter:v1*/` (the exact string Story 4 injects). If the sentinel is absent — unpatched install, or a binary replaced by a Claude Code auto-update — the handler returns a deterministic plain-text error and writes nothing. The error names the cause and points to the re-apply command. This works for both install kinds: scan the ELF bytes for a native install, scan `cli.js` text for an npm install. There is **no separate sentinel state file**; the binary is the source of truth.

## User Model

### User Gamut

Examples only:

- A developer whose Claude Code auto-updated yesterday, silently reverting the patch — prune must now refuse loudly instead of pretending.
- A developer who registered the MCP server but never applied the patches.
- The model calling `context-bonsai-prune`, which must receive a truthful success/failure signal.
- The maintainer verifying session discovery still works after a Claude Code release.
- An operator on npm `cli.js` vs. native — the guard must work for both.

### User-Needs Gamut

Examples only:

- Prune that tells the truth: it either really shrinks context or returns a clear, actionable error.
- A guard that stays correct across Claude Code auto-updates (no stale state file).
- Retrieve, session discovery, and the JSONL contract that keep working on current Claude Code.
- A registration story (`~/.claude.json`) that matches reality so Stories 8/9 document the right thing.

### Design Implications

- The guard reuses the existing parent-process walk in `discoverSessionPath`; resolving the executable is `/proc/<pid>/exe` on Linux with a documented fallback elsewhere.
- The sentinel scan is a plain substring search over the executable file — cheap, install-kind-agnostic.
- The error must be deterministic plain text per the shared spec and Story 1's per-agent-spec correction; it must not mutate the transcript.
- "Refresh" means minimal, evidence-driven fixes — not a rewrite. Anything not drifted is left alone.

## Acceptance Criteria

- [ ] Session discovery, the JSONL session-file format, and the three IPC files are confirmed against current Claude Code 2.1.x; any drift is fixed with evidence cited.
- [ ] The authoritative MCP registration file is confirmed (`~/.claude.json`) and recorded for Stories 8 and 9.
- [ ] `handlePruneContext` resolves the running Claude Code executable and scans it for `/*cb:archived-filter:v1*/` before writing any archive.
- [ ] If the sentinel is absent, `handlePruneContext` returns a deterministic plain-text error (naming the cause and the re-apply command) and writes nothing — no marker file, no JSONL mutation.
- [ ] The guard works for both a native ELF install and an npm `cli.js` install.
- [ ] Versions are bumped consistently across `package.json` and any in-code version string.
- [ ] `bun run typecheck` and `bun test` pass; existing MCP/ccsnap tests still pass.

## Context References

### Relevant Codebase Files (must read)

- `tweakcc_context_bonsai/mcp-server/index.ts:390` - `handlePruneContext`; the guard is added at its head.
- `tweakcc_context_bonsai/mcp-server/index.ts:249` - `discoverSessionPath`; the parent-process walk reused to resolve the executable.
- `tweakcc_context_bonsai/mcp-server/index.ts:521` - `handleRetrieveContext`; verify against current Claude Code.
- `tweakcc_context_bonsai/src/lib/compact.ts:74` - marker-file path helpers; the IPC contract.
- `tweakcc_context_bonsai/src/lib/session.ts` - JSONL read/format; verify against current Claude Code.
- `tweakcc_context_bonsai/package.json:3` - version to bump.
- `~/.claude.json` - confirm the live `mcpServers` registration shape.

### New Files to Create

- None expected; this story modifies existing MCP/ccsnap files. A small helper for the executable-resolution + sentinel-scan may be added under `mcp-server/`.

### Relevant Documentation

- The epic, Contract C (patch-presence detection — authoritative).
- `docs/agent-specs/claude-code-context-bonsai-spec.md` as corrected by Story 1 (the required fail-closed behavior).

## Implementation Plan

### Phase 1: Foundation

- Read the MCP server and ccsnap session/IPC code; diff behavior against current Claude Code 2.1.x; inspect `~/.claude.json`.

### Phase 2: Core Implementation

- Implement executable resolution + sentinel scan; add the guard at the head of `handlePruneContext`.
- Fix any confirmed session-discovery / JSONL drift.

### Phase 3: Integration

- Bump versions; record the registration-file finding for Stories 8/9.

### Phase 4: Testing and Validation

- Tests for the guard (sentinel present → proceed; absent → deterministic error, no writes) for both install kinds; regression-run existing tests.

## Step-by-Step Tasks

1. Read `mcp-server/index.ts`, `src/lib/compact.ts`, `src/lib/session.ts`; inspect `~/.claude.json`.
2. Verify session discovery, JSONL format, IPC files against current Claude Code; fix confirmed drift only.
3. Implement executable resolution (parent-process walk → `/proc/<pid>/exe`, with fallback) and the sentinel substring scan.
4. Add the guard to the head of `handlePruneContext`: absent sentinel → deterministic error, no writes.
5. Bump versions in `package.json` and any in-code version string.
6. Add tests for the guard (both install kinds) and re-run existing MCP/ccsnap tests.
7. Run `bun run typecheck` and `bun test`.

## Testing Strategy

- Unit: the guard against a fixture "binary" containing vs. not containing the sentinel, for both an ELF-shaped and a `cli.js`-shaped input; assert no marker/JSONL write on the absent path.
- Regression: the existing MCP server and ccsnap test suites still pass.
- Behavioral: confirm the error text is deterministic and the transcript is unmutated on the fail-closed path.

## Validation Commands

- `cd tweakcc_context_bonsai && bun run typecheck`
- `cd tweakcc_context_bonsai && bun test`

## Worktree Artifact Check

- Checked At: `2026-05-17T22:18:10Z`
- Planned Target Files: `tweakcc_context_bonsai/mcp-server/index.ts`, `src/lib/compact.ts` (if drifted), `src/lib/session.ts` (if drifted), `package.json`, plus an optional new `mcp-server/` helper
- Overlaps Found (path + class): `none` (side repo clean at `a3c5c81`; all targets tracked and clean)
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
