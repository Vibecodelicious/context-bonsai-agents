## Judge's Assessment

**Story**: CB-kilo.1 — Kilo/OpenCode plugin-first implementation
**Iteration**: 1 of 5 maximum
**Date**: 2026-04-23

---

### Summary

| Verdict | Count |
|---------|-------|
| APPROVED (must fix) | 3 |
| APPROVED (should fix) | 2 |
| REJECTED (over-engineering) | 0 |
| REJECTED (out of scope) | 0 |
| REJECTED (not valid) | 1 |

### Verified Validation Results

- **Starting commit:** side `6b0bf44`, agent `7c12284e9` (reviewer-identified)
- **Pre-existing failures (reviewer-reproduced):** none reported
- **HEAD results:** reviewer noted 39/39 side-repo bun:test + typecheck clean per commit message; judge did not rerun.
- **Regressions:** none
- **Regression gate:** clear

---

### Overall Verdict

**NEEDS REVISION**

Two CRITICAL defects are verified and they make the core deliverable functionally broken at runtime:

1. The plugin path in `opencode.jsonc` resolves to a nonexistent file, so Kilo never loads the plugin. No prune, no retrieve, no placeholder rendering, no in-band gauge. The only thing that "works" is the seam telemetry code in shared-core, which has no consumer.
2. The plugin module leaks `createPlugin`, `createSessions`, `resolveSessionID` as named function exports. Kilo's legacy-plugin loader walks every function value in the module, calls each with `(PluginInput, options)`, and `resolveSessionID` throws `TypeError: input is not iterable`. Empirically the default plugin still registers because it sorts alphabetically before the throwing export, but the load emits an error and is one loader refactor away from breaking entirely.

C1 alone blocks AC #1 ("plugin activation in `.opencode/opencode.jsonc` pointing at the side-project artifact") and AC #7 ("targeted tests under Kilo-owned test paths"), because the seam test exercises nothing that would actually catch this. Once C1 is fixed C2 becomes immediately observable (the loader actually gets to run the module), so both must land together.

M1 and M2 are real correctness issues but proportionate in scope and straightforward to fix. H1 is approved as the regression guard that would have caught C1/C2 in the first place.

---

### Finding-by-Finding Evaluation

#### [C1] Plugin path in `.opencode/opencode.jsonc` resolves to a nonexistent file
- **Reviewer's Issue**: `plugin` entry uses `../../kilo_context_bonsai/src/plugin.ts`; resolves to `context-bonsai-kilo/kilo_context_bonsai/src/plugin.ts` which doesn't exist.
- **Verdict**: APPROVED (must fix)
- **Reasoning**: Verified against `packages/opencode/src/config/plugin.ts:50-65`: `resolvePluginSpec` uses `path.resolve(path.dirname(configFilepath), spec)`. The config at `context-bonsai-kilo/kilocode/.opencode/opencode.jsonc` resolves `../../kilo_context_bonsai/src/plugin.ts` to `/home/basil/projects/context-bonsai-agents/context-bonsai-kilo/kilo_context_bonsai/src/plugin.ts`. `ls` confirms: "No such file or directory". The real side-repo is one directory higher, at `/home/basil/projects/context-bonsai-agents/kilo_context_bonsai/`. The correct spec is `../../../kilo_context_bonsai/src/plugin.ts` (3 levels up, not 2). The plan itself carries the same typo, so it propagated in unchecked.
- **If Approved**: Change `.opencode/opencode.jsonc` plugin entry to `../../../kilo_context_bonsai/src/plugin.ts`. Also correct the plan's description in the story file to match. Add a regression guard (see H1) that asserts the configured plugin spec resolves to an existing, loadable file.

#### [C2] Plugin entry exports internal helpers that collide with Kilo's legacy-plugin loader
- **Reviewer's Issue**: Named exports `createPlugin`, `createSessions`, `resolveSessionID` are function-valued. `getLegacyPlugins` in `packages/opencode/src/plugin/index.ts:80-93` iterates `Object.values(mod)` and invokes every function as a plugin. `resolveSessionID(input, options)` throws.
- **Verdict**: APPROVED (must fix)
- **Reasoning**: Verified. Module exports (empirical, via `bun import`): `[createPlugin, createSessions, default, resolveSessionID]`, alphabetical. Running the loader simulation:
  - `createPlugin(input, options)` — returns a function (inert)
  - `createSessions(input, options)` — returns a Map (inert)
  - `default(input, options)` — returns real Hooks object (registers successfully)
  - `resolveSessionID(input, options)` — throws `TypeError: {} is not iterable`

  So the reviewer's operational claim ("default bonsai plugin still works") is accurate today, but the load emits `failed to load plugin` at the outer `Effect.tryPromise` and the plugin system is one iteration order / one stricter loader check away from total breakage. This also violates AGENTS.md style rules implicitly (exports that are not used by any other module) and is flagged by `knip` in other packages.
- **If Approved**: Move `createPlugin`, `createSessions`, `resolveSessionID` to `kilo_context_bonsai/src/factory.ts` (or mark non-default exports as test-only and not part of the public module surface). The default plugin.ts entry should export ONLY `default`. Alternatively, migrate to the v1 PluginModule shape: `export default { id: "context-bonsai", server: createPlugin() }`, which takes the `readV1Plugin` code path and ignores named exports entirely — this is cleaner and survives loader hardening.

#### [H1] Seam test does not exercise real plugin load; did not catch C1/C2
- **Reviewer's Issue**: `packages/opencode/test/kilocode/context-bonsai.test.ts` only does a type-structural probe plus two `overflow.telemetry` unit tests. Never imports the plugin, never invokes Kilo's plugin loader.
- **Verdict**: APPROVED (must fix)
- **Reasoning**: Verified. Reading the test file end-to-end confirms zero runtime invocation of the plugin module or the loader. AC #7 says targeted tests under Kilo-owned test paths; they exist but are too shallow. A test that dynamically imports the configured plugin spec and asserts `context-bonsai-prune` + `context-bonsai-retrieve` tools are registered on `hooks.tool` would have caught both C1 (missing file) and C2 (loader error log). This is also the regression guard for C1.
- **If Approved**: Add one test that:
  - parses `.opencode/opencode.jsonc` and reads the `plugin` array;
  - resolves the spec via `ConfigPlugin.resolvePluginSpec` against the config file path;
  - asserts the resolved file exists;
  - dynamically imports it with `(input, options)` and asserts the returned Hooks has `tool["context-bonsai-prune"]` and `tool["context-bonsai-retrieve"]`, plus `experimental.chat.messages.transform` and `experimental.chat.system.transform`.

#### [M1] `overflow.telemetry` ignores `cfg.compaction?.reserved`, diverging from `isOverflow`
- **Reviewer's Issue**: `isOverflow` reads `input.cfg.compaction?.reserved`; `telemetry()` only accepts a direct `reserved` param and the caller in `prompt.ts` doesn't pass one.
- **Verdict**: APPROVED (should fix)
- **Reasoning**: Verified. `overflow.ts:16-17` uses `input.cfg.compaction?.reserved`; `overflow.ts:47` uses `input.reserved`; `prompt.ts:1543` calls `overflowTelemetry({ tokens: lastFinished.tokens, model })` with no reserved. Users who configure `cfg.compaction.reserved` explicitly will see gauge percentages that disagree with the compaction threshold, undermining the gauge's role as an early warning for the same budget. Proportionate fix.
- **If Approved**: In `prompt.ts`, pass `reserved: cfg.compaction?.reserved` to `overflowTelemetry`. Access to `cfg` already exists in the function scope (used elsewhere in prompt.ts). No new seams needed.

#### [M2] Gauge `turn` input is step-within-turn, not per-user-turn count
- **Reviewer's Issue**: `prompt.ts:1549` passes `turn: step`, where `step` is the inner tool-call loop counter. Spec §7 says cadence is per user-turn.
- **Verdict**: APPROVED (should fix)
- **Reasoning**: Verified. `step` is declared `let step = 0` inside the per-turn retry loop (`prompt.ts:1350`) and counts inner model invocations, not user turns. Plugin's `bump()` maintains its own counter but prefers `input.turn ?? session.turn`, so the injected `step` always wins. Spec §7: "Gauge cadence is every 5 turns by default" — turns, not steps. In tool-heavy turns the gauge could fire multiple times; in simple turns it may never fire. Fix is small.
- **If Approved**: Two clean options, either is fine:
  1. Drop `turn` from the transform input entirely; let the plugin's own `session.turn` counter (`bump()` in plugin.ts) drive cadence. This keeps the shared-core seam narrower.
  2. If a host-provided turn counter is wanted, thread a real per-user-turn counter (e.g. by counting user messages in the session, or incrementing on each outer prompt invocation rather than on each inner step).

  Prefer option 1 — it shrinks the shared-core seam surface, which aligns with the change-minimization rule.

#### [L1] Three `kilocode_change` markers in `opencode.jsonc` could have been consolidated
- **Reviewer's Issue**: Hygiene note.
- **Verdict**: REJECTED (not valid + out of scope)
- **Reasoning**: Inspection shows only 2 markers (a single `start`/`end` pair), not 3. The reviewer miscounted. Even if the count were correct, this is explicitly called out as a non-issue per AGENTS.md scope rules, and the reviewer graded it LOW. No action needed.

---

### Loop/Conflict Detection

**Previous Iterations**: 0 (this is iteration 1)
**Recurring Issues**: none
**Conflicts Detected**: none
**Assessment**: First pass on this story. No loop risk yet.

---

### Recommendations

**NEEDS REVISION.** The developer should address these approved items:

1. **C1** — fix the plugin path in `context-bonsai-kilo/kilocode/.opencode/opencode.jsonc` to `../../../kilo_context_bonsai/src/plugin.ts` (3 levels up). Also fix the identical typo in the plan file's AC reference ("`../../kilo_context_bonsai/...`"). Mark the fix with the existing `kilocode_change start/end` pair.
2. **C2** — remove `createPlugin`, `createSessions`, `resolveSessionID` from the public module surface of `kilo_context_bonsai/src/plugin.ts`. Preferred path: split factory/testing helpers into `kilo_context_bonsai/src/factory.ts` (or `internal.ts`) and have plugin.ts import from there and default-export only. Alternative: migrate plugin.ts to the v1 PluginModule shape (`export default { id: "context-bonsai", server: createPlugin() }`) which takes the strict loader path.
3. **H1** — replace or extend the seam integration test so it resolves the configured plugin spec against the real config file, imports it, and asserts the expected tools + hooks are registered. This becomes the standing regression guard for C1 and C2. Type-only structural probes do not satisfy AC #7.
4. **M1** — thread `reserved: cfg.compaction?.reserved` into the `overflowTelemetry(...)` callsite in `prompt.ts`.
5. **M2** — drop `turn` from the message-transform input (let the plugin's own `session.turn` drive gauge cadence). This narrows the shared-core seam and aligns with the spec's per-user-turn cadence. The transform-input seam in `packages/plugin/src/index.ts` can keep `turn?: number` optional if that avoids a breaking type change, but callsites should stop passing `step` in as `turn`.

Focus ONLY on these approved items. The rejected L1 should not be addressed.

---

### Complexity Guard Notes

- Rejected L1 (marker consolidation) — miscounted by reviewer and explicitly below AGENTS.md's threshold even if accurate.
- Not expanding H1 beyond what's necessary: one dynamic-import test that proves the plugin loads and registers the two tools is sufficient; a full end-to-end prune/retrieve integration test through the Kilo runtime is NOT required at this iteration — the side-repo already has roundtrip coverage.
- On C2 fix: prefer the simpler "move helpers to separate file" solution over the architectural "migrate to v1 PluginModule" path unless the dev team wants that anyway. Either works; both are proportionate.
- On M2 fix: rejected any suggestion to build a new per-user-turn counter seam in shared-core. The plugin already has one internally (`bump()`). Use it.
