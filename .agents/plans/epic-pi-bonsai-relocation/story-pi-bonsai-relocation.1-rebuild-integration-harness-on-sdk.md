# Story: Rebuild the integration-test harness on Pi's SDK

**Epic:** Relocate Pi Context Bonsai Out Of The pi-mono Fork
**Size:** Large
**Dependencies:** None

## Story Description

The seven Context Bonsai integration tests at `pi/packages/coding-agent/test/suite/context-bonsai/` run through `pi/packages/coding-agent/test/suite/harness.ts`, which imports `createTestExtensionsResult`, `createTestResourceLoader`, and `CreateTestExtensionsResultInput` from `pi/packages/coding-agent/test/utilities.ts` — a test-only file that is not in the `coding-agent` package's published `exports`/`files`. That `utilities.ts` dependency is the single thing preventing the integration tests from running outside the pi-mono monorepo. (The eight `coding-agent/src/` deep-path imports in `harness.ts` are cosmetic — every symbol is re-exported from `coding-agent`'s published `.` entry point.)

This story resolves the epic's biggest risk first and in place: rebuild a Context Bonsai integration harness on Pi's public SDK (`createAgentSession`, documented in `pi/packages/coding-agent/docs/sdk.md`) so it no longer depends on `test/utilities.ts`, repoint the seven integration tests at it, and confirm they stay green against the still-in-tree extension. Nothing is relocated in this story. If the public SDK cannot host the bonsai extension and construct a session sufficient to run the integration scenarios, that is discovered here — with everything in its original place — and escalated, not worked around.

The SDK harness is created as a **new file dedicated to the bonsai integration tests**; the shared `harness.ts` is not modified. Whether `harness.ts` is bonsai-specific or shared by the wider `coding-agent` suite is confirmed by inspection, but the new-file approach is correct either way and keeps Story 4's later cleanup unambiguous.

## User Model

### User Gamut
Examples only; broad dimensions.
- The maintainer who needs the SDK approach proven before committing to the relocation.
- A contributor who will run the integration tests during development.
- A reviewer confirming the relocation will not drop integration coverage.

### User-Needs Gamut
Examples only; broad dimensions.
- Early, low-cost discovery of whether the public SDK can host an extension for in-process testing.
- Integration tests that run on Pi's public surface, not on pi-mono internals.
- No structural change until the risky unknown is resolved.

### Design Implications
- Build on `createAgentSession` from the Pi SDK. Prefer driving extension discovery/loading through the SDK's real extension mechanism; reproducing minimal helpers in place of `createTestExtensionsResult`/`createTestResourceLoader` is the fallback, used only if the SDK genuinely cannot load an extension for an in-process test.
- The new harness is a new file owned by the bonsai integration tests; do not modify the shared `harness.ts` or `utilities.ts`.
- This story runs entirely in the pi fork; the SDK, the extension, and `@mariozechner/pi-ai` are all already present in the monorepo, so no dependency changes are needed here.

## Acceptance Criteria

- [ ] A recorded feasibility finding: whether Pi's public SDK (`createAgentSession`) can load the bonsai extension and construct a session sufficient to run the seven integration scenarios. If negative, an escalation record naming the missing primitive.
- [ ] A new SDK-based integration harness file exists in the pi fork (under `pi/packages/coding-agent/test/suite/context-bonsai/` or a sibling path owned by the bonsai tests), built only on Pi public entry points.
- [ ] The harness does not import `pi/packages/coding-agent/test/utilities.ts` or any non-public deep path.
- [ ] The shared `pi/packages/coding-agent/test/suite/harness.ts` and `pi/packages/coding-agent/test/utilities.ts` are unmodified.
- [ ] The seven integration tests at `pi/packages/coding-agent/test/suite/context-bonsai/` are repointed at the new harness and all pass against the in-tree extension.

## Context References

### Relevant Codebase Files (must read)
- `pi/packages/coding-agent/test/suite/context-bonsai/` — the seven integration scenarios.
- `pi/packages/coding-agent/test/suite/harness.ts` — the current harness; note its `import ... from "../utilities.js"`.
- `pi/packages/coding-agent/test/utilities.ts` — `createTestExtensionsResult`, `createTestResourceLoader`, `CreateTestExtensionsResultInput` (test-only, non-public).
- `pi/packages/coding-agent/docs/sdk.md` — Pi's SDK documentation (`createAgentSession`).
- `pi/packages/coding-agent/examples/sdk/` — SDK usage examples.
- `pi/packages/context-bonsai/src/` — the in-tree extension the tests exercise.

### New Files to Create
- A new SDK-based integration harness file owned by the bonsai integration tests, in the pi fork.

### Relevant Documentation
- `pi/packages/coding-agent/docs/sdk.md`.
- `docs/context-bonsai-e2e-template.md` — scenario reference.

## Implementation Plan

### Phase 1: Foundation
- Read `docs/sdk.md` and `examples/sdk/`.
- Inspect `harness.ts`/`utilities.ts` to confirm exactly which helpers the bonsai tests need.
- Feasibility check: confirm the SDK can instantiate a session, load an extension, drive turns, and inspect the transcript. Record the finding; escalate if insufficient.

### Phase 2: Core Implementation
- Build the new SDK-based harness as a dedicated file; do not modify shared `harness.ts`.
- Repoint the seven integration tests at the new harness.

### Phase 3: Integration
- Run the integration tests in the fork against the in-tree extension.

### Phase 4: Testing and Validation
- Confirm all seven pass; confirm no `utilities.ts`/deep-path imports remain in the new harness.

## Step-by-Step Tasks

1. Read `docs/sdk.md` and `examples/sdk/`; record the SDK feasibility finding.
2. If the SDK cannot host an extension for in-process testing, stop and escalate with the missing primitive.
3. Write the new SDK-based harness file.
4. Repoint the seven integration tests at the new harness.
5. Run the integration tests against the in-tree extension; fix until green.
6. Confirm the new harness imports only public entry points.

## Testing Strategy

- The seven existing integration tests are the regression oracle — unchanged in intent, re-run against the new harness.
- A grep check confirms the new harness has no `utilities.ts` or deep-path imports.

## Validation Commands

- `cd /home/basil/projects/context-bonsai-agents/pi && npm install`
- `cd /home/basil/projects/context-bonsai-agents/pi/packages/coding-agent && npx vitest run test/suite/context-bonsai`
- `! grep -rIn 'test/utilities\|coding-agent/src/' /home/basil/projects/context-bonsai-agents/pi/packages/coding-agent/test/suite/context-bonsai`

## Worktree Artifact Check

- Checked At: `2026-05-18`
- Planned Target Files: new SDK harness file under `pi/packages/coding-agent/test/suite/context-bonsai/`; the seven integration test files in that directory (repointed imports)
- Overlaps Found (path + class): `none` — `pi` working tree is clean.
- Escalation Status: `none`
- Decision Citation: `none`

## Plan Approval and Commit Status

- Approval Status: `approved`
- Approval Citation: `User approval — message "approved", 2026-05-18`
- Plan Commit Hash: `15a260d705bf5cbc54f5a7647ad190cef3457cef`
- Ready-for-Orchestration: `yes`

## Completion Checklist

- [ ] All acceptance criteria met
- [ ] Validation commands pass
- [ ] Plan approved and committed before orchestration begins
- [ ] User-model ambiguities resolved or escalated
- [ ] Worktree artifact overlaps resolved (approved direction or explicit deferral)
- [ ] SDK feasibility finding recorded; escalated if negative
