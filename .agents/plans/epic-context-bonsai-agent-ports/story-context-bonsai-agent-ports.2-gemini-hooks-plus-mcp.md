# Story: Gemini CLI hooks-plus-MCP implementation plan

**Epic:** Context Bonsai Agent Ports
**Size:** Large
**Dependencies:** None

## Story Description

Implement Context Bonsai for Gemini CLI using runtime hooks for guidance and gauge, plus an MCP-backed local bonsai tool transport for prune/retrieve. The current hook translator is text-oriented, so v1 includes a small core seam in hook translation to preserve structured bonsai placeholders in the real request history.

The implementation uses existing runtime hook infrastructure rather than user-authored command hooks alone. Archive state for v1 lives in `${storage.getProjectTempDir()}/context-bonsai/session-${sanitizeFilenamePart(sessionId)}.json`, keyed by the full `sessionId` so it aligns with Gemini CLI's own persisted session identity.

The MCP bootstrap path for v1 is to inject a transient built-in `mcpServers.context-bonsai` entry into the resolved CLI config inside `packages/cli/src/config/config.ts` before `new Config(...)`, with stdio transport configured as `command: process.execPath` and `args: [resolvedContextBonsaiMcpJsPath]`. `resolvedContextBonsaiMcpJsPath` resolves by rule: prefer `packages/cli/dist/utils/contextBonsaiMcp.js` in package and dev runs; otherwise use `bundle/contextBonsaiMcp.js` in bundled top-level runs. Discovery then flows through the existing `McpClientManager` path.

Allowlist behavior is fixed for v1: inject `context-bonsai` after admin allowlist filtering and also append `context-bonsai` to the effective allowed-server set when `allowedMcpServers` is present, so the built-in bonsai server remains available under MCP allowlists. `blockedMcpServers` still wins if `context-bonsai` is explicitly blocked.

## User Model

### User Gamut
- terminal-first Gemini CLI users in long coding sessions
- operators using runtime hooks, extensions, and MCP
- maintainers who want bonsai without deep core intrusion
- reviewers concerned about preserving the existing compression/checkpoint model

### User-Needs Gamut
- bonsai guidance and gauge before context overflow
- prune/retrieve exposed through a stable tool contract
- minimal core footprint if hooks are sufficient
- clear fallback behavior if hook-translated transcript fidelity is too lossy

### Design Implications
- Use CLI startup/runtime registration to install bonsai hooks.
- Keep prune/retrieve transport outside core in the local MCP server.
- Limit core changes to hook/request translation fidelity.

## Acceptance Criteria

- [ ] Plan chooses a hooks-first architecture with explicit runtime registration.
- [ ] Plan separates guidance/gauge delivery from prune/retrieve tool transport.
- [ ] Plan identifies the smallest required core seam for full-fidelity placeholder behavior.
- [ ] Plan identifies where prune/retrieve guard semantics live: pattern resolution, malformed or incomplete boundary rejection, and same-step retrieve rejection.
- [ ] Plan includes settings/schema/doc updates if new toggles are introduced.
- [ ] Validation commands cover both CLI and core test surfaces that are touched.

## Context References

### Relevant Codebase Files (must read)
- `/home/basil/projects/context-bonsai-agents/gemini-cli/packages/cli/src/config/config.ts` - resolved CLI config construction and MCP bootstrap seam
- `/home/basil/projects/context-bonsai-agents/gemini-cli/packages/cli/src/gemini.tsx` - CLI startup path
- `/home/basil/projects/context-bonsai-agents/gemini-cli/packages/cli/src/ui/AppContainer.tsx` - runtime lifecycle and UI integration
- `/home/basil/projects/context-bonsai-agents/gemini-cli/packages/core/src/config/storage.ts` - temp-dir ownership for sidecar archive path
- `/home/basil/projects/context-bonsai-agents/gemini-cli/packages/core/src/hooks/types.ts` - hook mutation contract
- `/home/basil/projects/context-bonsai-agents/gemini-cli/packages/core/src/hooks/hookEventHandler.ts` - hook request mutation entrypoint
- `/home/basil/projects/context-bonsai-agents/gemini-cli/packages/core/src/hooks/hookSystem.ts` - hook execution flow
- `/home/basil/projects/context-bonsai-agents/gemini-cli/packages/core/src/tools/tool-registry.ts` - tool declarations and execution
- `/home/basil/projects/context-bonsai-agents/gemini-cli/packages/core/src/tools/mcp-client-manager.ts` - MCP server startup and discovery path
- `/home/basil/projects/context-bonsai-agents/gemini-cli/packages/core/src/tools/mcp-client.ts` - MCP-backed tool path
- `/home/basil/projects/context-bonsai-agents/gemini-cli/packages/core/src/services/chatRecordingService.ts` - session recording location
- `/home/basil/projects/context-bonsai-agents/gemini-cli/packages/core/src/utils/sessionOperations.ts` - session file naming conventions
- `/home/basil/projects/context-bonsai-agents/gemini-cli/packages/core/src/core/geminiChat.ts` - chat history and token tracking

### New Files to Create
- `/home/basil/projects/context-bonsai-agents/gemini-cli/packages/cli/src/utils/contextBonsai.ts` - bonsai runtime registration and orchestration
- `/home/basil/projects/context-bonsai-agents/gemini-cli/packages/cli/src/utils/contextBonsaiMcp.ts` - local MCP-backed prune/retrieve transport
- `/home/basil/projects/context-bonsai-agents/gemini-cli/packages/cli/src/utils/contextBonsai.test.ts` - focused CLI-level tests

### Runtime-Created Files
- `${storage.getProjectTempDir()}/context-bonsai/session-<session-id>.json` - sidecar archive metadata store owned by the CLI bonsai runtime, correlated by session id and stored alongside the existing `chats/` recording area

### Files Modified
- `/home/basil/projects/context-bonsai-agents/gemini-cli/packages/cli/src/config/config.ts`
- `/home/basil/projects/context-bonsai-agents/gemini-cli/packages/cli/src/gemini.tsx`
- `/home/basil/projects/context-bonsai-agents/gemini-cli/packages/cli/src/ui/AppContainer.tsx`
- `/home/basil/projects/context-bonsai-agents/gemini-cli/packages/cli/src/acp/acpClient.ts`
- `/home/basil/projects/context-bonsai-agents/gemini-cli/packages/cli/package.json`
- `/home/basil/projects/context-bonsai-agents/gemini-cli/scripts/build_package.js`
- `/home/basil/projects/context-bonsai-agents/gemini-cli/esbuild.config.js`
- `/home/basil/projects/context-bonsai-agents/gemini-cli/packages/core/src/hooks/hookEventHandler.ts`
- `/home/basil/projects/context-bonsai-agents/gemini-cli/packages/core/src/hooks/hookTranslator.ts`
- `/home/basil/projects/context-bonsai-agents/gemini-cli/packages/core/src/hooks/types.ts`
- `/home/basil/projects/context-bonsai-agents/gemini-cli/packages/core/src/tools/mcp-client-manager.ts`

### Relevant Documentation
- [gemini-cli-context-bonsai-spec.md](/home/basil/projects/context-bonsai-agents/docs/agent-specs/gemini-cli-context-bonsai-spec.md)
- [context-bonsai-agent-spec.md](/home/basil/projects/context-bonsai-agents/docs/context-bonsai-agent-spec.md)

## Implementation Plan

### Phase 1: Runtime registration and state model
- Add CLI-side bonsai bootstrap code.
- Define per-session bonsai sidecar state at `${storage.getProjectTempDir()}/context-bonsai/session-<session-id>.json`, keyed by session id and storing anchor/range/summary/index metadata plus correlation fields needed for reload.
- Inject the built-in `context-bonsai` MCP server into resolved CLI config during startup.
- Emit two executable JS artifacts for `contextBonsaiMcp.ts`: `packages/cli/dist/utils/contextBonsaiMcp.js` via the package build and `bundle/contextBonsaiMcp.js` via a second esbuild entrypoint. Configure the built-in server with `process.execPath` plus whichever artifact matches the current runtime shape.
- Make `context-bonsai` survive `allowedMcpServers` filtering by appending it to the effective allowlist after config injection, while still honoring explicit blocklists.

### Phase 2: Guidance, gauge, and tool transport
- Register hooks for guidance and gauge delivery.
- Expose prune/retrieve through a local MCP-backed transport.
- Keep MCP responsible for tool transport, not transcript mutation.
- Bootstrap the local bonsai MCP server by injecting a transient built-in `mcpServers.context-bonsai` config entry during CLI startup.
- Implement prune/retrieve validation guards inside the local MCP bonsai server, not in hooks.

### Phase 3: Fidelity review
- Extend hook translation and request mutation so bonsai placeholders preserve structured history shape through the request path.
- Keep that seam narrower than the bonsai logic layered on top of it.

### Phase 4: Validation
- Add CLI tests and any touched core tests.
- Regenerate settings/docs artifacts if config changes were introduced.

## Step-by-Step Tasks

1. Add CLI-side bonsai bootstrap and runtime hook registration.
2. Implement session-state storage for archive and gauge data at `${storage.getProjectTempDir()}/context-bonsai/session-${sanitizeFilenamePart(sessionId)}.json`.
3. Wire prune/retrieve tools through the local MCP transport.
4. Implement guidance and gauge delivery through hooks.
5. Add the core hook/request translation seam in `hookEventHandler.ts`, `hookTranslator.ts`, and `types.ts` needed for structured placeholder fidelity.
6. Implement prune/retrieve guard semantics inside the MCP bonsai server.
7. Add tests and run validation commands.

## Testing Strategy

- CLI tests for registration, bootstrap, and failure handling.
- Core hook/translator tests must cover the structured-history seam.
- Validate that placeholders are model-visible in the actual request path.
- Include MCP transport tests for client and manager startup paths.
- Include guard-path tests for unresolved or ambiguous boundaries and same-step retrieve rejection in the MCP bonsai server tests.

## Validation Commands

- `cd /home/basil/projects/context-bonsai-agents/gemini-cli && npm run test --workspace @google/gemini-cli -- src/config/config.test.ts src/utils/contextBonsai.test.ts src/acp/acpClient.test.ts`
- `cd /home/basil/projects/context-bonsai-agents/gemini-cli && npm run test --workspace @google/gemini-cli-core -- src/hooks/hookEventHandler.test.ts src/hooks/hookTranslator.test.ts src/hooks/types.test.ts src/hooks/hookSystem.test.ts src/tools/mcp-client.test.ts src/tools/mcp-client-manager.test.ts`
- `cd /home/basil/projects/context-bonsai-agents/gemini-cli && npm run typecheck`

## Worktree Artifact Check

- Checked At: `2026-04-23`
- Planned Target Files: `/home/basil/projects/context-bonsai-agents/gemini-cli/packages/cli/src/utils/contextBonsai.ts`, `/home/basil/projects/context-bonsai-agents/gemini-cli/packages/cli/src/utils/contextBonsaiMcp.ts`, `/home/basil/projects/context-bonsai-agents/gemini-cli/packages/cli/src/utils/contextBonsai.test.ts`, `/home/basil/projects/context-bonsai-agents/gemini-cli/packages/cli/src/config/config.ts`, `/home/basil/projects/context-bonsai-agents/gemini-cli/packages/cli/src/gemini.tsx`, `/home/basil/projects/context-bonsai-agents/gemini-cli/packages/cli/src/ui/AppContainer.tsx`, `/home/basil/projects/context-bonsai-agents/gemini-cli/packages/cli/src/acp/acpClient.ts`, `/home/basil/projects/context-bonsai-agents/gemini-cli/packages/core/src/hooks/hookEventHandler.ts`, `/home/basil/projects/context-bonsai-agents/gemini-cli/packages/core/src/hooks/hookTranslator.ts`, `/home/basil/projects/context-bonsai-agents/gemini-cli/packages/core/src/hooks/types.ts`, `/home/basil/projects/context-bonsai-agents/gemini-cli/packages/core/src/tools/mcp-client-manager.ts`
- Overlaps Found: `none`
- Escalation Status: `none`
- Decision Citation: `none`

## Plan Approval and Commit Status

- Approval Status: `pending`
- Approval Citation: `none`
- Plan Commit Hash: `none`
- Ready-for-Orchestration: `no`

## Validation Loop Results

- Missing details check: pass
- Ambiguity check: pass
- Worktree artifact risk check: pass
- Plan-commit status check: pending
- Iterations run: 4

## Completion Checklist

- [ ] All acceptance criteria met
- [ ] Validation commands pass
- [ ] Plan approved and committed before orchestration begins
- [ ] User-model ambiguities resolved or escalated
- [ ] Worktree artifact overlaps resolved (approved direction or explicit deferral)
