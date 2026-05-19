# Story: Relocate the extension source and tests to the side repo

**Epic:** Relocate Pi Context Bonsai Out Of The pi-mono Fork
**Size:** Medium
**Dependencies:** Story 1 (the SDK-based integration harness must be proven green in the fork before anything is relocated).

## Story Description

Copy the Context Bonsai extension into the standalone `pi_context_bonsai` side repository and make it build, typecheck, and run unit + integration tests green on its own. The side repo is currently scaffold-only (`.gitkeep` placeholders, a stub `package.json`, `README.md`, `STANDARDS.md`, `tsconfig.json`).

What is copied:
- `pi/packages/context-bonsai/src/` — the 11 extension source files.
- `pi/packages/context-bonsai/test/` — the full tree (unit tests including `e2e-asserts.test.ts` / `e2e-credentials.test.ts`, the `test/e2e/` support files, and `test/e2e/run-e2e.sh`). The entire tree moves together: `e2e-asserts.test.ts` imports `./e2e/assert.mjs` and reads `./e2e/fixtures/`, and `e2e-credentials.test.ts` imports `./e2e/check-credentials.js`, so the directory cannot be split.
- `pi/packages/context-bonsai/docs/` — the docs.
- The seven integration tests and the SDK-based harness produced by Story 1, from `pi/packages/coding-agent/test/suite/context-bonsai/`, into the side repo's `test/` tree.

This story copies rather than moves: the fork copies remain until Story 4 strips them, so both copies coexist while the side repo is verified.

Dependency rework for standalone resolution:
- `@mariozechner/pi-coding-agent` moves from the workspace wildcard `"*"` to an explicit `"0.69.0"`.
- `@mariozechner/pi-agent-core` is *added* as an explicit dependency at `"0.69.0"` (the in-tree `package.json` does not list it; `src/gauge.ts` and `src/context-transform.ts` import it, resolved transitively in-tree).
- `@mariozechner/pi-ai` is added as an explicit **devDependency** at `"0.69.0"` — it is imported by the integration-test harness and the seven integration tests (faux-provider helpers), which arrive in this story. It is not used by the extension `src/` or the unit tests.

Validation confirmed all three packages publish `0.69.0`.

## User Model

### User Gamut
Examples only; broad dimensions.
- A contributor developing the extension in the side repo with a normal `npm install` workflow.
- The maintainer who needs the side repo to be the single source of truth.
- CI/test automation running unit and integration tests on the side repo.

### User-Needs Gamut
Examples only; broad dimensions.
- A standalone repo that installs and tests without a surrounding monorepo.
- Dependencies pinned to a known-good version, not a floating wildcard.
- No loss of unit or integration coverage in the move.

### Design Implications
- Pin all three Pi packages at **`0.69.0`** — the version the code was written and tested against. A version bump is deliberate future maintenance, not part of this move.
- **package.json scripts:** the in-tree `pi/packages/context-bonsai/package.json` has no `typecheck` script; the side-repo scaffold's `package.json` does (`"typecheck": "tsc --noEmit"`). The merge MUST keep the scaffold's `typecheck` (and `test:watch`) scripts — taking the in-tree manifest as the base for `name`/`type`/`pi.extensions` must not drop them. Add a `test:integration` (or fold integration tests into `test`) so the integration suite is runnable.
- **tsconfig:** keep the side repo's existing self-contained `tsconfig.json` as the base. Do NOT carry the in-tree `tsconfig.json` — it `extends "../../tsconfig.base.json"`, a monorepo file absent in the side repo.
- **vitest:** the side-repo `vitest.config.ts` carries NO aliases to in-tree Pi source; resolution uses the published packages.
- devDependency versions: use the in-tree package's versions (`vitest ^3.2.4`, `typescript ^5.7.3`, `@types/node ^24.3.0`).
- The package keeps `private: true` and its `pi.extensions` manifest field.

## Acceptance Criteria

- [ ] `pi/packages/context-bonsai/src/` exists at `pi_context_bonsai/src/` with identical content.
- [ ] The entire `pi/packages/context-bonsai/test/` tree exists at `pi_context_bonsai/test/` with identical content.
- [ ] `pi/packages/context-bonsai/docs/` content exists at `pi_context_bonsai/docs/`.
- [ ] The seven integration tests and the Story 1 SDK harness exist under `pi_context_bonsai/test/`.
- [ ] `pi_context_bonsai/package.json` declares `@mariozechner/pi-coding-agent` and `@mariozechner/pi-agent-core` as dependencies at `0.69.0`, declares `@mariozechner/pi-ai` as a devDependency at `0.69.0`, retains `typebox`, retains a `typecheck` script and the `pi.extensions` field, and keeps `private: true`.
- [ ] `pi_context_bonsai/tsconfig.json` is self-contained; `vitest.config.ts` carries no in-tree aliases.
- [ ] The scaffold `.gitkeep` files are removed.
- [ ] `npm install`, `npm run typecheck`, and `npm test` (unit + integration) all pass in `pi_context_bonsai/`.
- [ ] The pi-mono fork is NOT modified in this story (copies, not moves).

## Context References

### Relevant Codebase Files (must read)
- `pi/packages/context-bonsai/package.json`, `tsconfig.json`, `vitest.config.ts` — source manifest and configs; note the monorepo `extends` and in-tree aliases.
- `pi/packages/context-bonsai/src/`, `test/`, `docs/` — content to copy.
- `pi/packages/coding-agent/test/suite/context-bonsai/` — the integration tests + the Story 1 SDK harness to copy.
- `pi_context_bonsai/package.json`, `tsconfig.json` — current scaffold; tsconfig is the base, package.json is merged.

### New Files to Create
- `pi_context_bonsai/src/*`, `pi_context_bonsai/test/**`, `pi_context_bonsai/docs/*`, `pi_context_bonsai/vitest.config.ts`.

### Relevant Documentation
- `docs/agent-specs/pi-context-bonsai-spec.md`, `docs/context-bonsai-agent-spec.md`.

## Implementation Plan

### Phase 1: Foundation
- Confirm Story 1 is green and the side repo working tree is clean.

### Phase 2: Core Implementation
- Copy `src/`, the whole `test/` tree, `docs/`, and the integration tests + SDK harness into the side repo.
- Merge `package.json` per the Design Implications (explicit `0.69.0` deps, retained `typecheck`/`test:watch` scripts, integration test runnable).
- Keep the self-contained `tsconfig.json`; create an alias-free `vitest.config.ts`.
- Remove `.gitkeep` placeholders.

### Phase 3: Integration
- `npm install`; confirm the pinned Pi packages resolve from npm.

### Phase 4: Testing and Validation
- Run typecheck, unit tests, and integration tests; fix path/config issues from the move.

## Step-by-Step Tasks

1. Confirm Story 1 green; confirm `pi_context_bonsai/` working tree clean.
2. Copy `src/`, the whole `test/` tree, `docs/` into the side repo.
3. Copy the integration tests + Story 1 SDK harness into `pi_context_bonsai/test/`.
4. Rewrite `pi_context_bonsai/package.json` per the Design Implications.
5. Confirm the side repo `tsconfig.json` is self-contained; create an alias-free `vitest.config.ts`.
6. Delete the `.gitkeep` scaffold files.
7. Run `npm install`, `npm run typecheck`, `npm test`; resolve failures.

## Testing Strategy

- Unit: every moved `*.test.ts` runs under vitest and passes.
- Integration: the seven scenarios run via the SDK harness in the side repo.
- Typecheck: `tsc --noEmit` against the moved source resolving the pinned published Pi packages.
- No e2e-harness work in this story (Story 3).

## Validation Commands

- `cd /home/basil/projects/context-bonsai-agents/pi_context_bonsai && npm install`
- `cd /home/basil/projects/context-bonsai-agents/pi_context_bonsai && npm run typecheck`
- `cd /home/basil/projects/context-bonsai-agents/pi_context_bonsai && npm test`

## Worktree Artifact Check

- Checked At: `2026-05-18`
- Planned Target Files: `pi_context_bonsai/package.json`, `pi_context_bonsai/tsconfig.json`, `pi_context_bonsai/vitest.config.ts`, `pi_context_bonsai/src/*`, `pi_context_bonsai/test/**`, `pi_context_bonsai/docs/*`, `pi_context_bonsai/{src,test,docs}/.gitkeep`
- Overlaps Found (path + class): `none` — `pi_context_bonsai` working tree is clean.
- Escalation Status: `none`
- Decision Citation: `none`

## Plan Approval and Commit Status

- Approval Status: `approved`
- Approval Citation: `User approval — message "approved", 2026-05-18`
- Plan Commit Hash: `pending`
- Ready-for-Orchestration: `no`

## Completion Checklist

- [ ] All acceptance criteria met
- [ ] Validation commands pass
- [ ] Plan approved and committed before orchestration begins
- [ ] User-model ambiguities resolved or escalated
- [ ] Worktree artifact overlaps resolved (approved direction or explicit deferral)
