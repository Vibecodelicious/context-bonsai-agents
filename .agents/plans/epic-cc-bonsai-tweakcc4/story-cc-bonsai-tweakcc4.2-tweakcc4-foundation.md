# Story: tweakcc 4.0 foundation and apply harness

**Epic:** Re-implement Context Bonsai for Claude Code on tweakcc 4.0
**Size:** Large
**Dependencies:** None (foundation story for the rest of the epic)

## Story Description

Establish the tweakcc 4.0 foundation in the side repo `tweakcc_context_bonsai/` and build the **apply harness** that installs Context Bonsai into a Claude Code installation — native or npm — without forking tweakcc.

Scope, per epic Contract A:

- Add `tweakcc` (4.0.x, currently 4.0.13) as a dependency of `tweakcc_context_bonsai/package.json`. The published tarball omits the declared `dist/lib/index.d.ts`, so the API is consumed via a thin locally-typed wrapper.
- Create `patches/types.ts` — the `BonsaiPatch` interface, `PatchContext`, and `BonsaiPatchError`, exactly as pinned in epic Contract A.
- Create `patches/registry.ts` — the ordered list of patches (`archived-filter`, `message-content-ids`, `context-bonsai-gauge`). It is the single place that fixes apply order. Stories 4–6 add their module to it; until then it is empty and the harness composes a no-op.
- Create `apply/tweakcc-api.ts` — the typed wrapper over tweakcc's `.mjs` API surface: `findAllInstallations`, `tryDetectInstallation`, `readContent`, `writeContent`, `backupFile`, `restoreBackup`.
- Create `apply/apply-bonsai.ts` — the harness. Default action: detect installation → `backupFile` → `readContent` once → compose every registered patch transform over the one accumulating content string → `verifySentinel` for each → `writeContent` once → print a report. `--restore` action: `restoreBackup`. It also detects an already-patched install (sentinels already present) and a reverted install (backup exists but binary unpatched, e.g. after a Claude Code auto-update) and reports each distinctly.
- Add `package.json` scripts: `apply` and `apply:restore`.
- Rewrite the stale parts of `tweakcc_context_bonsai/STANDARDS.md` and `CC_BONSAI.md`, which still describe the dead model of forking tweakcc and shipping a PR to Piebald-AI.

The apply harness must NOT shell out to `tweakcc adhoc-patch` (it takes no backup and re-reads pristine JS per call — incompatible with composing three patches and with safe `--restore`). It uses the programmatic API only.

## User Model

### User Gamut

Examples only, spanning install kind and role:

- An operator installing Context Bonsai onto a native Claude Code binary (the modern default).
- An operator on an npm `@anthropic-ai/claude-code` `cli.js` install (CI images, pinned versions).
- The maintainer who must keep the port working across Claude Code releases without a tweakcc fork or an upstream PR.
- A developer debugging a failed apply who needs the harness report to say exactly which patch and anchor failed.
- A future story implementer (Stories 4–6) plugging a patch module into the registry.

### User-Needs Gamut

Examples only:

- One command that works regardless of whether Claude Code is a native binary or `cli.js`.
- A safe, reversible install — a backup is always taken; `--restore` always works.
- Honest, specific failure reporting — never a silent partial patch.
- A clean extension point so adding the real patches is low-friction.
- No dependency on an external maintainer merging anything.

### Design Implications

- `readContent`/`writeContent` abstract native vs npm — the harness has no install-kind branching in its main path.
- Backup must happen before `writeContent`; on any patch or verify failure the harness restores and exits non-zero.
- The registry being initially empty must be a valid state (harness composes identity), so Story 2 is independently testable and demoable before Stories 4–6 exist.
- The no-op round-trip (unpack → identity → repack, binary still runs) is the acceptance gate and proves the native pipeline before any real patch exists.

## Acceptance Criteria

- [ ] `tweakcc` 4.0.x is a declared dependency of `tweakcc_context_bonsai/package.json`; `bun install` resolves it.
- [ ] `patches/types.ts` exports `BonsaiPatch`, `PatchContext`, `BonsaiPatchError` matching epic Contract A verbatim.
- [ ] `patches/registry.ts` exports the ordered patch list; an empty registry is valid and yields an identity compose.
- [ ] `apply/tweakcc-api.ts` wraps the tweakcc API with local types and is the only file that imports `tweakcc` directly.
- [ ] `apply/apply-bonsai.ts` performs detect → backup → readContent → compose → verify → writeContent → report, and supports `--restore`.
- [ ] The harness distinguishes and reports three install states: unpatched, already-patched, reverted-after-update.
- [ ] On any patch/verify failure the harness restores the backup and exits non-zero.
- [ ] Acceptance gate: running the harness with an empty/no-op registry against a **copy** of a native Claude Code install round-trips (unpack → identity → repack) and the rebuilt binary reports its version successfully.
- [ ] `STANDARDS.md` and `CC_BONSAI.md` no longer describe forking tweakcc or shipping a PR to Piebald-AI; they describe the tweakcc-4.0-API apply model.
- [ ] `bun run typecheck` and `bun test` pass.

## Context References

### Relevant Codebase Files (must read)

- `tweakcc_context_bonsai/package.json` - add the dependency and scripts here.
- `tweakcc_context_bonsai/STANDARDS.md` - stale fork model; rewrite the affected sections.
- `tweakcc_context_bonsai/CC_BONSAI.md` - stale "push the tweakcc PR" shipping sequence; rewrite.
- `/tmp/cc-bonsai-spike/node_modules/tweakcc/` (or a fresh `bun add tweakcc`) - inspect `package.json` exports, `dist/lib/index.mjs`, and the bundled `README.md` for the real API surface.
- `~/.local/share/claude/versions/<latest>` - a native install used (by copy) for the round-trip acceptance gate.

### New Files to Create

- `tweakcc_context_bonsai/patches/types.ts` - `BonsaiPatch`/`PatchContext`/`BonsaiPatchError`.
- `tweakcc_context_bonsai/patches/registry.ts` - ordered patch registry.
- `tweakcc_context_bonsai/apply/tweakcc-api.ts` - typed wrapper over tweakcc's API.
- `tweakcc_context_bonsai/apply/apply-bonsai.ts` - the apply harness.
- `tweakcc_context_bonsai/apply/apply-bonsai.test.ts` - harness tests incl. the no-op round-trip.

### Relevant Documentation

- The epic, "Shared Implementation Contracts → Contract A" (authoritative for layout, naming, mechanism).
- tweakcc 4.0 bundled `README.md` API section (the `.d.ts` is missing from the tarball).

## Implementation Plan

### Phase 1: Foundation

- Add `tweakcc` dependency; inspect its real API surface; write `apply/tweakcc-api.ts` with local types.
- Create `patches/types.ts` and `patches/registry.ts`.

### Phase 2: Core Implementation

- Implement `apply/apply-bonsai.ts`: detection, backup, read, compose, verify, write, report; `--restore`.
- Implement install-state classification (unpatched / already-patched / reverted).

### Phase 3: Integration

- Wire `apply` / `apply:restore` scripts into `package.json`.
- Rewrite the stale sections of `STANDARDS.md` and `CC_BONSAI.md`.

### Phase 4: Testing and Validation

- Harness unit tests; the native no-op round-trip integration test against a copied binary.
- `bun run typecheck`, `bun test`.

## Step-by-Step Tasks

1. `bun add tweakcc` in `tweakcc_context_bonsai/`; inspect its exports and README.
2. Write `apply/tweakcc-api.ts` — typed wrapper; the only direct `tweakcc` importer.
3. Write `patches/types.ts` per Contract A.
4. Write `patches/registry.ts` — empty ordered list initially.
5. Write `apply/apply-bonsai.ts` — full apply flow + `--restore` + install-state classification.
6. Add `apply` and `apply:restore` scripts to `package.json`.
7. Write `apply/apply-bonsai.test.ts` including the no-op native round-trip against a copied install.
8. Rewrite stale sections of `STANDARDS.md` and `CC_BONSAI.md`.
9. Run `bun run typecheck` and `bun test`.

## Testing Strategy

- Unit: detection, backup/restore, compose ordering, install-state classification, failure → restore path.
- Integration: copy a native Claude Code binary to a temp path, run the harness with a no-op registry, confirm the repacked binary executes and reports its version. Skip-with-clear-reason if no native install is present.

## Validation Commands

- `cd tweakcc_context_bonsai && bun install`
- `cd tweakcc_context_bonsai && bun run typecheck`
- `cd tweakcc_context_bonsai && bun test`
- `cd tweakcc_context_bonsai && bun test apply/apply-bonsai.test.ts` (the native no-op round-trip acceptance gate; the test asserts the repacked binary runs and reports its version)
- `! grep -niE 'fork tweakcc|piebald.*PR|push the tweakcc' tweakcc_context_bonsai/STANDARDS.md tweakcc_context_bonsai/CC_BONSAI.md`

## Worktree Artifact Check

- Checked At: `2026-05-17T22:18:10Z`
- Planned Target Files: `tweakcc_context_bonsai/package.json`, `STANDARDS.md`, `CC_BONSAI.md`, `patches/types.ts`, `patches/registry.ts`, `apply/tweakcc-api.ts`, `apply/apply-bonsai.ts`, `apply/apply-bonsai.test.ts`
- Overlaps Found (path + class): `none` (side repo clean at `a3c5c81`; the four new `patches/`+`apply/` files do not yet exist; the three modified files are tracked and clean)
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
