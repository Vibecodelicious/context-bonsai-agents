# Story: Operator documentation

**Epic:** Re-implement Context Bonsai for Claude Code on tweakcc 4.0
**Size:** Medium
**Dependencies:** Story 8 (the docs describe the verified, final apply + verification flow)

## Story Description

Ship operator-facing documentation for the Claude Code port that satisfies the shared spec's **Operator Documentation Contract** (`docs/context-bonsai-agent-spec.md`, ~L312–322): it must let a user install, verify, audit, and uninstall the port on a clean machine.

Required content (the spec mandates the categories, not the section names):

- **Prerequisites** — Claude Code 2.1.x (native or npm `cli.js`), Node ≥ 20 (tweakcc's `adhoc-patch` sandbox spawns a child node with `--permission`), `tweakcc` 4.0.x, OS support matrix, and the LLM provider account the user must already have.
- **Install commands** — concrete copy-paste commands for the Story 2 apply harness, covering both the native and npm install kinds, step-by-step enough for a user who does not already know `git clone` / `bun install`. MCP server registration must use the authoritative file confirmed by Story 7: `~/.claude.json`.
- **Post-install verification** — a positive check the user runs that confirms bonsai is wired in *and functional*: the tool-listing should show `context-bonsai-prune` / `context-bonsai-retrieve`, and a smoke prune should be shown to actually reduce context (per epic feedback that docs must walk install → wiring → working tools).
- **Security disclosure** — what the patches/MCP read from the host transcript and session store, where archive state persists on disk (`~/.claude/archived-<session>.json`, `compaction-mode-<session>`), what is sent to the provider (placeholder summary + index terms YES; archived original content NO), and any network egress.
- **Uninstall** — return Claude Code to its pre-install state via `tweakcc --restore` (and the harness `--restore`), including removal of any persisted archive state.
- **Auto-update lifecycle** — a Claude Code auto-update silently reverts the patches; document that the Story 7 MCP guard will then refuse prune with a clear error, give the re-apply procedure, and recommend disabling auto-update (`DISABLE_AUTOUPDATER=1`) for a stable bonsai install.

The doc must be safe for public consumption: no SSH-only paths, no unverified install steps, no references to unclaimed package namespaces. Use an existing port's operator README for structure (e.g. `opencode_context_bonsai_plugin/README.md`).

## User Model

### User Gamut

Examples only:

- A first-time user who has Claude Code and wants context pruning, capable of running shown commands but not of reverse-engineering wiring.
- A native-install user and an npm-`cli.js`-install user — both must find their exact path.
- A security-conscious operator auditing what a binary-patching tool does before trusting it.
- A user whose Claude Code just auto-updated and whose prune started erroring — they need the re-apply path.
- A future contributor following Uninstall to get a clean baseline.

### User-Needs Gamut

Examples only:

- A path from "I have Claude Code" to "bonsai is actually working" — install, wiring, and a functional check, not just install.
- Commands that match the user's actual install kind.
- Honest disclosure of what is read, persisted, and transmitted.
- A reliable, complete uninstall.
- A clear answer for the auto-update case, including how to make the install stable.

### Design Implications

- The doc walks install → wiring → working tools end-to-end; the post-install check must elicit *functionality*, not just registration.
- Two install kinds means two clearly separated command blocks, not a single ambiguous one.
- Keep it lean — over-complication is a known failure mode for these READMEs; cover the six required categories without padding.
- Every command must be one that Story 8 actually verified; no aspirational steps.

## Acceptance Criteria

- [ ] An operator doc exists in `tweakcc_context_bonsai/` covering all six content categories above.
- [ ] Prerequisites list Claude Code 2.1.x, Node ≥ 20, tweakcc 4.0.x, an OS support matrix, and the required provider account.
- [ ] Install commands are copy-paste, cover both native and npm install kinds, and register the MCP server in `~/.claude.json`.
- [ ] Post-install verification confirms the tools are listed *and* a smoke prune actually reduces context.
- [ ] Security disclosure states what is read, where archive state persists, and what is/is not sent to the provider.
- [ ] Uninstall returns Claude Code to its pre-install state and removes persisted archive state.
- [ ] The auto-update section explains the silent revert, the Story 7 error behavior, the re-apply procedure, and the `DISABLE_AUTOUPDATER=1` recommendation.
- [ ] Every documented command corresponds to one verified in Story 8; no unverified steps.

## Context References

### Relevant Codebase Files (must read)

- `tweakcc_context_bonsai/README.md` - existing side-repo README; the operator doc lives here or alongside it.
- `tweakcc_context_bonsai/apply/apply-bonsai.ts` - the apply + `--restore` commands to document (Story 2).
- `tweakcc_context_bonsai/mcp-server/index.ts` - MCP server entry; registration shape for `~/.claude.json`.
- `opencode_context_bonsai_plugin/README.md` - a sibling port's operator README for structure.

### New Files to Create

- An operator doc under `tweakcc_context_bonsai/` (a new file, or a substantial rewrite of `README.md`'s install section — implementer picks per the existing README's shape).

### Relevant Documentation

- `docs/context-bonsai-agent-spec.md:312` - the Operator Documentation Contract (authoritative content requirements).
- The epic, Contract C (the auto-update / fail-closed behavior the doc explains).
- Story 8's verified protocol — the source of truth for which commands are documented.

## Implementation Plan

### Phase 1: Foundation

- Read the Operator Documentation Contract, the existing README, and a sibling port's README.

### Phase 2: Core Implementation

- Draft the six content categories, with separate native and npm command blocks.

### Phase 3: Integration

- Cross-check every command against Story 8's verified protocol; align registration with `~/.claude.json`.

### Phase 4: Testing and Validation

- Verify the doc covers all six categories and contains no unverified command.

## Step-by-Step Tasks

1. Read the Operator Documentation Contract, `tweakcc_context_bonsai/README.md`, and `opencode_context_bonsai_plugin/README.md`.
2. Draft Prerequisites, Install (native + npm), Post-install verification, Security disclosure, Uninstall, Auto-update lifecycle.
3. Ensure MCP registration instructions use `~/.claude.json`.
4. Cross-check every command against Story 8's verified protocol; remove anything unverified.
5. Run the validation commands.

## Testing Strategy

- Documentation story: no unit tests. Verification is a category-coverage check and a command-cross-reference against Story 8's protocol. Ideally a fresh reader (or a clean sprite) follows the doc verbatim — that is Story 8's install-procedure test, which doubles as the doc's proof.

## Validation Commands

- `grep -niE 'prerequisite|verif|uninstall|disclos|DISABLE_AUTOUPDATER' tweakcc_context_bonsai/README.md`
- `! grep -niE 'npm install opencode|git@github' tweakcc_context_bonsai/README.md`

## Worktree Artifact Check

- Checked At: `2026-05-17T22:18:10Z`
- Planned Target Files: `tweakcc_context_bonsai/README.md` (and/or a new operator doc under `tweakcc_context_bonsai/`)
- Overlaps Found (path + class): `none` (side repo clean at `a3c5c81`; `README.md` tracked and clean)
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
