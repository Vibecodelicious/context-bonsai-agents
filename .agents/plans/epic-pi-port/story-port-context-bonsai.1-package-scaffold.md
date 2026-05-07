# Story: Package scaffold + extension entry point + system-prompt guidance

**Epic:** Port context-bonsai to Pi as a first-party extension
**Size:** Small
**Dependencies:** None

## Story Description

Create a new workspace package `packages/context-bonsai/` that exports a Pi `ExtensionFactory`. The factory registers nothing interactive yet — it only subscribes to `before_agent_start` and appends the bonsai system-prompt guidance string. This story proves the loading path, workspace wiring, build, and test harness end-to-end before any business logic lands.

Do **not** port tools, transforms, or the gauge in this story. Later stories add those into the same factory.

## User Model

### User Gamut
- Pi maintainer reviewing a fresh workspace package for consistency with existing ones (`packages/mom`, `packages/pods`).
- Operator who installs the extension via `pi` extension discovery and expects nothing to change in behaviour beyond a slightly longer system prompt.

### User-Needs Gamut
- Package builds cleanly under Pi's existing `tsgo -p tsconfig.build.json` tooling.
- Extension is loadable via the `pi.extensions` manifest form documented at `packages/coding-agent/src/core/extensions/loader.ts:481 resolveExtensionEntries` and via `~/.pi/extensions/` discovery.
- No impact on Pi when extension is absent.

### Design Implications
- Mirror the scripts/layout conventions of an existing small Pi package (use `packages/pods/package.json` and `packages/mom/package.json` as structural references).
- The factory must be a default export of type `ExtensionFactory` importable as `@mariozechner/pi-context-bonsai`.

## Acceptance Criteria

- [ ] `packages/context-bonsai/package.json` exists with:
  - `"name": "@mariozechner/pi-context-bonsai"`
  - `"type": "module"`
  - `"pi": { "extensions": ["./src/index.ts"] }` manifest — Pi loads `.ts` extension entry points directly via jiti, so no build step is required for discovery/testing. Matches the working pattern in `packages/coding-agent/examples/extensions/with-deps/package.json`.
  - Runtime dep on `@mariozechner/pi-coding-agent` (workspace version) for the extension types; dev dep on `vitest` for unit tests.
  - Scripts (copy test/check shape from `packages/coding-agent/package.json:30-38`, not mom which lacks them): `"clean": "echo 'nothing to clean'"`, `"test": "vitest --run"`, `"check": "echo 'nothing to check'"`. No `build` script is required for this story — extensions load from source. (`prepublishOnly` can be added later if we choose to publish.)
- [ ] `packages/context-bonsai/tsconfig.json` extends `../../tsconfig.base.json`. No `outDir` required for this story; add `"noEmit": true` and `"include": ["src/**/*", "test/**/*"]` so `tsgo --noEmit` at the repo root still type-checks it.
- [ ] `packages/context-bonsai/src/index.ts` exports a default `ExtensionFactory` that:
  - Registers a `before_agent_start` handler returning `{ systemPrompt: <original> + "\n\n" + BONSAI_GUIDANCE }` for the first iteration. (Chain semantics documented in `extensions/types.ts:993`.)
  - Registers no tools, no other handlers.
- [ ] `packages/context-bonsai/src/prompt.ts` exports `BONSAI_GUIDANCE` — port verbatim from `/home/basil/projects/opencode_context_bonsai_plugin/src/prompt.ts` `getSystemPromptGuidance()`.
- [ ] One unit test in `packages/context-bonsai/test/` that imports the factory and asserts handler registration for `before_agent_start` (no runtime invocation needed).
- [ ] One integration test in `packages/coding-agent/test/suite/context-bonsai/01-scaffold.test.ts` that:
  - Uses the faux provider (`test/suite/harness.ts`) and `createTestExtensionsResult` to load the factory.
  - Sends one user message, records the `BeforeAgentStartEvent` the extension saw, and asserts the resulting system prompt contains `BONSAI_GUIDANCE`.
- [ ] `npm run check` passes from repo root (biome + tsgo + browser smoke).
- [ ] `npm --prefix packages/context-bonsai test` passes.

## Context References

### Relevant Codebase Files (must read)
- `packages/coding-agent/src/core/extensions/types.ts:1061` — `ExtensionFactory` signature.
- `packages/coding-agent/src/core/extensions/types.ts:619-629` — `BeforeAgentStartEvent` shape.
- `packages/coding-agent/src/core/extensions/types.ts:991-995` — `BeforeAgentStartEventResult.systemPrompt` chain semantics.
- `packages/coding-agent/src/core/extensions/loader.ts:448-510` — `pi` manifest format and `resolveExtensionEntries`.
- `packages/coding-agent/src/core/extensions/runner.ts` (scan `emitBeforeAgentStart` / equivalent) — how the result is threaded.
- `packages/coding-agent/test/utilities.ts:180-205` — `createTestExtensionsResult` inline-factory helper.
- `packages/coding-agent/test/suite/harness.ts:1-60` — faux-provider harness to copy from.
- `packages/pods/package.json` and `packages/mom/package.json` — script/field conventions.
- `/home/basil/projects/opencode_context_bonsai_plugin/src/prompt.ts` — guidance string to port verbatim.
- `packages/coding-agent/examples/extensions/with-deps/package.json` — working example of the `pi.extensions` manifest field.

### New Files to Create
- `packages/context-bonsai/package.json`
- `packages/context-bonsai/tsconfig.json`
- `packages/context-bonsai/src/index.ts`
- `packages/context-bonsai/src/prompt.ts`
- `packages/context-bonsai/test/prompt.test.ts`
- `packages/coding-agent/test/suite/context-bonsai/01-scaffold.test.ts`

### Relevant Documentation
- `AGENTS.md` — repo-wide code-quality gates (no `any`, always use top-level imports, `npm run check` after code changes).

## Implementation Plan

### Phase 1: Workspace wiring
- Scaffold `packages/context-bonsai/` with just `package.json` and `tsconfig.json` (no build config). Use the script shape from `packages/coding-agent/package.json` for `"test": "vitest --run"`, and the `"clean"/"check"` stubs from `packages/coding-agent/examples/extensions/with-deps/package.json` for consistency with the in-repo extension example.
- Add `@mariozechner/pi-coding-agent` as a workspace dep (use `"*"` — npm workspaces will resolve to the local package; matches how `packages/coding-agent/examples/extensions/with-deps` does not depend on pi-coding-agent but is loaded by it at runtime).

### Phase 2: Extension factory and guidance
- Port `BONSAI_GUIDANCE` from OpenCode's `prompt.ts` verbatim into `src/prompt.ts`. Include a short `// Source: opencode-context-bonsai prompt.ts` comment (it's an exception to the no-comment rule because it documents a verbatim port).
- Write `src/index.ts`:
  ```ts
  import type { ExtensionFactory } from "@mariozechner/pi-coding-agent";
  import { BONSAI_GUIDANCE } from "./prompt.js";

  const factory: ExtensionFactory = (pi) => {
    pi.on("before_agent_start", (event) => {
      const base = event.systemPrompt;
      return { systemPrompt: `${base}\n\n${BONSAI_GUIDANCE}` };
    });
  };

  export default factory;
  ```

### Phase 3: Tests
- Unit test that imports `factory`, constructs a fake `ExtensionAPI` stub, and asserts `on` was called once with `"before_agent_start"`.
- Integration test under `packages/coding-agent/test/suite/context-bonsai/01-scaffold.test.ts`:
  - Import factory via relative workspace path (mirror how `agent-session-model-extension.test.ts` pulls an inline factory).
  - Run one prompt through the faux provider, assert the `BuildSystemPromptOptions`'s effective prompt contains `BONSAI_GUIDANCE`.

### Phase 4: Gates
- Run `npm run check` from repo root. Fix all errors/warnings/infos per `AGENTS.md`.
- Run the integration test file explicitly.

## Step-by-Step Tasks

1. Read `packages/mom/package.json`, `packages/mom/tsconfig.json`, `packages/pods/package.json` for structural reference.
2. Read `packages/coding-agent/test/suite/agent-session-model-extension.test.ts` as a pattern for extension integration tests.
3. Create `packages/context-bonsai/package.json`, `tsconfig.json`, (and `tsconfig.build.json` if the mom package uses that pattern).
4. Run `npm install` from repo root to materialise the new workspace.
5. Create `packages/context-bonsai/src/prompt.ts` with the verbatim-port guidance.
6. Create `packages/context-bonsai/src/index.ts` with the factory described above.
7. Create `packages/context-bonsai/test/prompt.test.ts` (unit).
8. Create `packages/coding-agent/test/suite/context-bonsai/01-scaffold.test.ts` (integration).
9. Run validation commands (see below). Fix anything that fails.
10. Commit as `[Story 1.1] context-bonsai package scaffold + prompt guidance`.

## Testing Strategy

- Unit test: pure module import + handler registration on a stub API. No agent runtime.
- Integration test: faux-provider harness with the extension loaded inline via `createTestExtensionsResult`. Assert the guidance string landed in the effective system prompt for one turn.

## Validation Commands

Per `AGENTS.md`: never run `npm test`, `npm run build`, or `npm run dev`. Use the vitest CLI form for named tests, and `npm run check` for the repo-wide gate.

- `cd /home/basil/projects/context-bonsai-pi && npm install`
- `cd /home/basil/projects/context-bonsai-pi && npm run check`
- `cd /home/basil/projects/context-bonsai-pi/packages/context-bonsai && npx tsx ../../node_modules/vitest/dist/cli.js --run test/prompt.test.ts`
- `cd /home/basil/projects/context-bonsai-pi/packages/coding-agent && npx tsx ../../node_modules/vitest/dist/cli.js --run test/suite/context-bonsai/01-scaffold.test.ts`

## Worktree Artifact Check

- Checked At: 2026-04-23
- Planned Target Files: `packages/context-bonsai/package.json`, `packages/context-bonsai/tsconfig.json`, `packages/context-bonsai/src/index.ts`, `packages/context-bonsai/src/prompt.ts`, `packages/context-bonsai/test/prompt.test.ts`, `packages/coding-agent/test/suite/context-bonsai/01-scaffold.test.ts`
- Overlaps Found: none (all paths absent; `git status` clean).
- Escalation Status: none
- Decision Citation: n/a

## Plan Approval and Commit Status

- Approval Status: approved
- Approval Citation: user message 2026-04-23 "Do commit the plan" (auto mode)
- Plan Commit Hash: 45df8a33 (`docs: approved plans for context-bonsai port epic`)
- Ready-for-Orchestration: yes (orchestration deferred per user instruction in same exchange)

## Completion Checklist

- [ ] All acceptance criteria met
- [ ] Validation commands pass
- [ ] Plan approved and committed before orchestration begins
- [ ] User-model ambiguities resolved or escalated
- [ ] Worktree artifact overlaps resolved (approved direction or explicit deferral)
