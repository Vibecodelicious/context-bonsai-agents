# Story: Remove Archived Marker Cache

## Goal

Remove the Claude Code `archived-filter` runtime marker cache so retrieval immediately affects the transcript sent to the LLM, even when `~/.claude/archived-<session-id>.json` is rewritten within the same filesystem timestamp window.

## User Model

### User Gamut

- Examples only: Claude Code users relying on `context-bonsai-retrieve` to recover pruned content, maintainers forward-porting tweakcc patches across Claude Code releases, reviewers validating live prune/retrieve semantics, operators testing sensitive-content pruning with Protocol A, contributors reading the minified-runtime patch code, users running repeated prune/retrieve cycles in one long session.

### User-Needs Gamut

- Examples only: retrieval must restore original content predictably, prune must still hide archived content from the next model request, runtime patch behavior must be simple enough to audit, stale filesystem-cache behavior must not create false data-loss symptoms, tests must prove marker rewrites are read immediately, live validation must cover both prune and retrieve visibility, implementation must not weaken semantic patch-anchor checks.

### Ambiguities From User Model

- Performance versus correctness is resolved in favor of correctness. The marker file is tiny, and stale cache behavior breaks retrieve. The patch should read the marker on each provider-bound transcript rewrite instead of using an mtime cache.
- Active specs do not require or describe a marker cache. The shared spec has no cache requirement, and `docs/agent-specs/claude-code-context-bonsai-spec.md` only requires that `~/.claude/archived-<session-id>.json` be persisted and read by the transcript-rewrite seam.
- The implementation must not lower anchor thresholds, relax semantic-anchor requirements, or rely on synthetic fixtures as evidence that the Claude Code host seam is correct.

## Context References

- `tweakcc_context_bonsai/patches/archived-filter.patch.ts` - Committed `HEAD` injects `globalThis.__cbArchivedFilterCache` and refreshes only when `__cbEntry.mtimeMs !== __cbMtimeMs`; this is the defect to remove.
- `tweakcc_context_bonsai/patches/archived-filter.patch.test.ts` - Committed tests only prove refresh after forced `utimes`; they do not cover same-observed-mtime rewrites from a non-empty marker to `[]`.
- `tweakcc_context_bonsai/patches/anchors.ts` - Must remain semantically unchanged unless implementation proves an anchor-selection bug unrelated to cache removal. Do not lower `minScore`, `minMargin`, or other fail-closed thresholds to make an apply pass.
- `docs/agent-specs/claude-code-context-bonsai-spec.md:46` - Defines the marker file as the archive persistence IPC path read by the transcript-rewrite seam, without requiring caching.
- `docs/agent-specs/claude-code-context-bonsai-spec.md:67` - Requires archive metadata to persist to `~/.claude/archived-<session-id>.json` so the seam can hide archived ranges across session reloads.
- `/tmp/cc-bonsai-e2e/post-ccsnap-reapply-retrieve-20260521T204245Z/oracle-before-retrieve.json` - Current post-removal prune oracle passed before retrieve: `valid: true`, `occurrenceCount: 1`, `invalidOccurrenceCount: 0`.
- `/tmp/cc-bonsai-e2e/post-ccsnap-reapply-retrieve-20260521T204245Z/secret-presence.txt` - Current post-removal retrieve regression evidence: retrieve-and-answer and the following no-tool answer both reported no secret.
- `/tmp/cc-bonsai-e2e/pre-ccsnap-retrieve-20260521T202609Z` - Pre-removal comparison run where prune passed and retrieve made the secret visible again.

## Acceptance Criteria

- [ ] `archived-filter` injected runtime code no longer uses `globalThis.__cbArchivedFilterCache`, mtime-only cache entries, or any other marker-content cache that can outlive the marker file contents.
- [ ] The injected runtime code reads and parses `~/.claude/archived-<session-id>.json` on each provider-bound transcript rewrite and filters only UUIDs present in the current marker contents.
- [ ] Missing, empty, corrupt, or non-array marker files fail safe by filtering nothing and not throwing inside Claude Code.
- [ ] Unit tests cover non-empty marker filtering, marker rewrite from one UUID set to another without forced `mtime` changes, and marker rewrite to `[]` without forced `mtime` changes.
- [ ] Tests assert the injected code does not contain the stale cache identifiers or mtime-comparison refresh branch.
- [ ] Patch-anchor behavior remains semantically unchanged: no lowering of `selectVisibilitySwitchAnchor` or `selectMessageContentConverterAnchor` fail-closed thresholds unless a separate reviewed plan explicitly authorizes anchor work.
- [ ] Live Claude Code `2.1.143` validation passes after `bun run apply:restore && bun run apply`: Protocol A prune oracle passes before retrieve, retrieve makes the secret visible, and a following no-tool turn still sees the restored content.
- [ ] The side repo change is committed before the parent submodule pin is advanced; the parent commit records the new side-repo pin and any plan/judgement artifacts.

## Implementation Tasks

1. Start by resolving the current dirty experimental edits in `tweakcc_context_bonsai` per the Worktree Artifact Check below. Use committed side-repo `HEAD` as the conceptual baseline, not the current dirty experimental diff.
2. Update `patches/archived-filter.patch.ts` so `buildInjectedFilter` reads the marker file every time the provider-bound transcript rewrite seam runs. Keep the snippet fail-safe: any missing file, read error, parse error, or non-array parsed value produces an empty `Set` and filters nothing.
3. Keep marker path construction, runtime helper use, session-id lookup, sentinel, patch name, and selected provider-bound visibility seam unchanged.
4. Update `patches/archived-filter.patch.test.ts` so tests explicitly reject stale cache code and verify immediate behavior after marker rewrites without `utimes`.
5. Add or adjust a test that rewrites a marker from `['first-message']` to `[]` while using the same patched predicate instance, then asserts both messages are visible.
6. Ensure tests do not delete or reference `globalThis.__cbArchivedFilterCache` except as a negative assertion against generated code.
7. Confirm the final implementation has no `patches/anchors.ts` diff. If implementation discovers an anchor-selection problem, stop and write a separate plan; do not mix anchor threshold changes into this story.
8. Run local side-repo validation commands.
9. Reinstall or verify Claude Code `2.1.143`, run `bun run apply:restore && bun run apply`, and confirm the patch applies with `archived-filter`, `message-content-ids`, and `context-bonsai-gauge`.
10. Run live Protocol A plus retrieve on the patched current checkout using the exact validation command block below. Record a redacted evidence directory under `/tmp/cc-bonsai-e2e/...`; do not print or commit secrets, credentials, auth files, or full session transcripts.
11. Commit the side-repo fix, advance the parent `tweakcc_context_bonsai` submodule pin, update plan status/judgement artifacts through the orchestration process, and commit parent changes.

## Testing Strategy

- Unit tests prove the injected snippet has no stale cache and observes marker rewrites immediately using the same predicate instance.
- Typecheck catches syntax and TypeScript integration errors in patch code and tests.
- `apply:restore` plus `apply` proves the generated patch still applies to the pinned Claude Code `2.1.143` native runtime.
- Live Protocol A before retrieve proves prune still hides archived content from the model-visible transcript.
- Live retrieve plus a following no-tool turn proves restored content becomes model-visible again after marker and JSONL restoration.
- Evidence must be redacted: record session ids, anchor ids, oracle counts, and secret-presence booleans only; do not commit the secret literal or full Claude session transcript.

## Validation Commands

Every story plan MUST list the validation commands explicitly. These are the source of truth for the developer's Pre-Implementation Starting-State Check and Completion Rerun; no runtime substitution is permitted.

- `git status --short`
- `git -C tweakcc_context_bonsai status --short`
- `cd tweakcc_context_bonsai && bun test patches/archived-filter.patch.test.ts`
- `cd tweakcc_context_bonsai && bun test`
- `cd tweakcc_context_bonsai && bun run typecheck`
- `cd tweakcc_context_bonsai && claude install 2.1.143 && claude --version`
- `cd tweakcc_context_bonsai && bun run apply:restore && bun run apply`
- `cd tweakcc_context_bonsai && bash -lc 'set -euo pipefail; RUN_DIR="/tmp/cc-bonsai-e2e/remove-cache-$(date -u +%Y%m%dT%H%M%SZ)"; RAW_DIR="$RUN_DIR/raw-secret-bearing"; mkdir -p "$RAW_DIR"; trap '\''rm -rf "$RAW_DIR"'\'' EXIT; SECRET="CBSA-$(date -u +%Y%m%d%H%M%S)-$RANDOM-$RANDOM"; BOUNDARY="BOUNDARY-$(date -u +%H%M%S)-$RANDOM"; SESSION_ID="$(bun -e "console.log(crypto.randomUUID())")"; MCP_CONFIG="{\"mcpServers\":{\"context-bonsai\":{\"command\":\"bun\",\"args\":[\"run\",\"$PWD/mcp-server/index.ts\"]}}}"; COMMON=(--strict-mcp-config --mcp-config "$MCP_CONFIG" --output-format json --permission-mode bypassPermissions); claude -p --session-id "$SESSION_ID" "${COMMON[@]}" "Protocol A setup. Remember this temporary secret exactly: $SECRET. Do not repeat the secret in your response. This setup message also contains a non-secret boundary token for later pruning: $BOUNDARY. Reply only: acknowledged." > "$RAW_DIR/01-seed.json"; for i in 1 2 3 4 5; do claude -p --resume="$SESSION_ID" "${COMMON[@]}" "Padding turn $i for Protocol A. Discuss one brief non-secret fact about bonsai tree care. Do not mention any earlier secret or boundary token." > "$RAW_DIR/0$((i+1))-pad.json"; done; claude -p --resume="$SESSION_ID" "${COMMON[@]}" "Use the context-bonsai prune tool now. Prune exactly the single earlier setup user message by using the non-secret boundary token from that setup message as both from_pattern and to_pattern. Do not quote the token in your prose. The summary must be '\''Protocol A seed turn archived.'\'' The index terms must be ['\''protocol-a'\'', '\''seed-turn'\'']. Do not include any secret literal in the tool arguments, summary, index terms, reason, or response." > "$RAW_DIR/07-prune.json"; claude -p --resume="$SESSION_ID" --output-format json --tools "" "No tools. What was the temporary secret I told you earlier? If it is unavailable or no longer in active context, say exactly UNAVAILABLE." > "$RAW_DIR/08-recall-no-tools.json"; SESSION_FILE="$(SESSION_ID="$SESSION_ID" bun -e '\''const fs=require("fs"), path=require("path"); const root=path.join(process.env.HOME,".claude","projects"); const target=process.env.SESSION_ID+".jsonl"; const stack=[root]; while(stack.length){const dir=stack.pop(); for(const ent of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,ent.name); if(ent.isDirectory()) stack.push(p); else if(ent.name===target){console.log(p); process.exit(0)}}} process.exit(1)'\'')"; bun run e2e/native-e2e.ts protocol-a-oracle --session "$SESSION_FILE" --secret "$SECRET" --out "$RUN_DIR/oracle-before-retrieve.json"; claude -p --resume="$SESSION_ID" "${COMMON[@]}" "Use the context-bonsai retrieve tool for the archived Protocol A seed turn. After retrieval, answer this question: what was the temporary secret?" > "$RAW_DIR/09-retrieve-and-answer.json"; claude -p --resume="$SESSION_ID" --output-format json --tools "" "Without using tools, what was the temporary secret?" > "$RAW_DIR/10-post-retrieve-answer.json"; SECRET="$SECRET" bun -e '\''const fs=require("fs"); const secret=process.env.SECRET; const out=[]; for (const p of process.argv.slice(2)) { const text=fs.readFileSync(p,"utf8"); out.push(`${p.split("/").pop()}:${text.includes(secret)?"contains-secret":"no-secret"}`); } console.log(out.join("\n"));'\'' "$RAW_DIR/08-recall-no-tools.json" "$RAW_DIR/09-retrieve-and-answer.json" "$RAW_DIR/10-post-retrieve-answer.json" > "$RUN_DIR/secret-presence.txt"; grep -q "08-recall-no-tools.json:no-secret" "$RUN_DIR/secret-presence.txt"; grep -q "09-retrieve-and-answer.json:contains-secret" "$RUN_DIR/secret-presence.txt"; grep -q "10-post-retrieve-answer.json:contains-secret" "$RUN_DIR/secret-presence.txt"; printf "RUN_DIR=%s\nSESSION_ID=%s\nSESSION_FILE=%s\n" "$RUN_DIR" "$SESSION_ID" "$SESSION_FILE" > "$RUN_DIR/redacted-run-metadata.txt"; cat "$RUN_DIR/redacted-run-metadata.txt"'`
- `git diff --check`
- `git -C tweakcc_context_bonsai diff --check`

## Worktree Artifact Check

- Checked At: `2026-05-24T16:43:52-07:00`
- Planned Target Files: `tweakcc_context_bonsai/patches/archived-filter.patch.ts`, `tweakcc_context_bonsai/patches/archived-filter.patch.test.ts`, `tweakcc_context_bonsai/patches/anchors.ts`, `tweakcc_context_bonsai`, `.agents/plans/story-remove-archived-marker-cache.md`
- Overlaps Found (path + class): `tweakcc_context_bonsai/patches/archived-filter.patch.ts -> tracked-dirty`, `tweakcc_context_bonsai/patches/archived-filter.patch.test.ts -> tracked-dirty`, `tweakcc_context_bonsai/patches/anchors.ts -> tracked-dirty`
- Escalation Status: `approved; Basil approved dropping existing dirty diffs and the recommended defaults below`
- Decision Citation: `Basil: "Yes, existing dirty diffs can be dropped. Approve"`

### Required Escalation Payload

| target file | artifact class | risk summary | recommended default | user decision needed |
| --- | --- | --- | --- | --- |
| `tweakcc_context_bonsai/patches/archived-filter.patch.ts` | `tracked-dirty` | Contains an unreviewed experimental cache-removal attempt that failed live validation in at least one naive variant. Treating it as baseline could hide mistakes. | Replace with a clean, reviewed implementation against committed `HEAD`, preserving only evidence-backed parts. | Approve replacing the experimental diff during implementation. |
| `tweakcc_context_bonsai/patches/archived-filter.patch.test.ts` | `tracked-dirty` | Contains unreviewed test edits from the experimental attempt; useful intent but not accepted plan output. | Replace with tests specified by this plan, using committed `HEAD` as baseline. | Approve replacing the experimental diff during implementation. |
| `tweakcc_context_bonsai/patches/anchors.ts` | `tracked-dirty` | Lowers `minMargin` from `10` to `9`, which violates the no-threshold-relaxation constraint unless separately proven and planned. | Revert this threshold change or leave the file untouched in the final implementation. | Approve discarding this experimental threshold change. |

Implementation is blocked until Basil approves this plan or gives different instructions for the three tracked-dirty files. If approved as written, the implementer may overwrite or discard the experimental diffs in these three files as needed to produce the planned final state, and the final diff must leave `patches/anchors.ts` unchanged from committed `HEAD`.

## Plan Approval and Commit Status

- Approval Status: `approved`
- Approval Citation: `Basil: "Yes, existing dirty diffs can be dropped. Approve"`
- Plan Commit Hash: `5b2a6a3`
- Ready-for-Orchestration: `yes`

This plan artifact was committed before orchestration begins. Implementation may start only through the orchestration flow, using this committed plan as the source of truth.

## Validation Loop Results

- Missing details check: `iteration 1 found that live validation command was a placeholder and commit/dirty-artifact closure needed precision; plan updated with exact command block and explicit approval semantics`
- Ambiguity check: `iteration 1 found dirty-diff handling and anchors.ts target semantics ambiguous; plan updated to use committed HEAD as conceptual baseline and require no final anchors.ts diff`
- Worktree artifact risk check: `approved by Basil; existing dirty diffs may be dropped and anchors.ts must have no final diff`
- Final validation: `READY FOR BASIL APPROVAL; validator confirmed raw secret cleanup trap, no-tool enforcement, session discovery, UUID generation, dirty-file escalation, anchors.ts no-diff rule, and approval/commit closure`
- Plan-commit status check: `closed by commit 5b2a6a3; this follow-up status update records the hash and readiness`
- Iterations run: `3`
