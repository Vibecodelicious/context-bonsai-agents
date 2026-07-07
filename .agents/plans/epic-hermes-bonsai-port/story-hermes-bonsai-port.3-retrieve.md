# Story: Retrieve tool and same-step guard

**Epic:** epic-hermes-bonsai-port (read `epic-hermes-bonsai-port.md` first)
**Size:** Small
**Dependencies:** Stories 1–2

## Story Description

`context-bonsai-retrieve` restores an archived range: the archived content comes back as the tool result immediately, and the placeholder effect is cleared at the same `compress()` realization boundary the prune path uses. A retrieve naming an anchor whose prune realization is still pending in the same model step is rejected with the deterministic same-step guard error (the contract half adopts the shared spec's SHOULD, diverging deliberately from Pi's no-op branch).

## User Model

Inherited from the epic. The retrieve result must let the model keep working immediately (content in the tool result) even though the transcript restoration lands one realization boundary later.

## Design bindings

- Input: `anchor_id` (string), matching a `cb-<n>` id. Missing/unknown anchor, or an anchor whose record is not in `realized` state (other than the same-step case below), returns a deterministic plain-text error via the engine tool-call error path; no mutation.
- Same-step guard: if the named anchor's record is `pending` (prune persisted but not yet realized — i.e. same model step), return the guard error verbatim-deterministic (fixed text naming the anchor and the reason); the pending prune is left untouched.
- Success: tool result contains the archived original content (rendered from the record's content snapshots, clearly delimited per range message with roles); record transitions `realized → pending-restore`; `should_compress()` goes true; at `compress()`, the placeholder message is replaced by the original message sequence (from the record's snapshots) and the record transitions to `retrieved`. Restoration must reproduce a valid provider sequence (the same adjacency rules as prune, in reverse).
- A `retrieved` record's anchor id is no longer retrievable (deterministic "already retrieved" error); the record is kept for audit.

## Acceptance Criteria

- [ ] Retrieve input validation + unknown-anchor / already-retrieved / same-step errors, all deterministic, zero mutation — unit-tested.
- [ ] Success path: content in tool result; placeholder cleared and originals restored in the `compress()` output; store state transitions persisted atomically — unit-tested over prune-then-retrieve fixtures.
- [ ] Real-CLI drive (`scripts/drive-retrieve.sh`): scenario — prune (turn A), plain turn, retrieve by the reported anchor id (turn B), plain turn. Asserts from stub-recorded requests: post-retrieve request contains the restored original text and no longer contains the placeholder; retrieve tool result carried the archived content.
- [ ] Same-step drive: scenario where one assistant message calls prune and retrieve for the same anchor in the same step (two tool calls in one assistant message, prune first); asserts the retrieve tool result is the guard error and the prune still realizes correctly on the next request.
- [ ] pytest + ruff green; baseline compared.

## Context References

- Spec pair: Prune and retrieve contract (retrieve + same-step rules); Ambiguities From User Model (guard adoption rationale). Shared spec: Retrieve Tool; Invariants.
- Harness: same dispatch/realization sites as Story 2.
- Reference: `pi_context_bonsai/src/retrieve.ts`, `opencode_context_bonsai_plugin/src/retrieve.ts` (semantics only; the guard decision here differs from Pi).

### New Files to Create

`context-bonsai/retrieve.py` (or listed equivalent), `scripts/drive-retrieve.sh`, scenario files, tests. Modified: `context-bonsai/engine.py`, `context-bonsai/archive_store.py`.

## Testing Strategy

Unit tests for every state transition and error; the two drives are the closure evidence for restoration visibility and the guard.

## Validation Commands

From the side repo root:

- `HERMES_AGENT_ROOT=/tmp/hermes-bonsai-stage4/hermes-agent uv run --project /tmp/hermes-bonsai-stage4/hermes-agent pytest tests -q`
- `uvx ruff@0.15.10 check .`
- `bash scripts/smoke.sh`
- `bash scripts/drive-prune.sh`
- `bash scripts/drive-retrieve.sh`

## Worktree Artifact Check

Same rule as Story 2: clean `git status` at story start or STOP.

## Plan Approval and Commit Status

- Approval Status: approved (same citations as Story 1)
- Ready-for-Orchestration: yes (after plan commit)

## Completion Checklist

- [ ] Acceptance criteria met with drive evidence
- [ ] Validation commands pass vs baseline; scope diff clean
- [ ] Completion report: any Binding Sites updates; SPEC-GAP/EXECUTOR-FAIL candidates
- [ ] Intent log updated at phase boundaries
