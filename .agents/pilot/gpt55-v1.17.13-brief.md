# Task Brief: Routine Forward-Port Cycle — OpenCode onto v1.17.13

You are the process orchestrator for one routine forward-port cycle. Your working directory is this repository root (`context-bonsai-agents/`); every relative path below starts there.

## Reading order (before any other action)

1. `.llm-conductor/ORCHESTRATOR_AGENT.md` — your operating pattern. You coordinate; subagents implement. You never edit implementation files yourself.
2. `docs/agent-specs/forward-port-spec.md` — the cycle specification. Read the front matter ("Relationship to the other documents", "How a routine cycle uses this spec"), Part 1, Part 2 (git-fork shape), and §4.2 (the OpenCode slot). Part 3 and §4.3 are the closed-artifact shape and do not apply to this cycle.
3. `.agents/plans/story-rebase-cycle-0dfbeeda7d8a273c52a564333c8179c68d6ab04d.md` — the approved cycle plan you will execute. Its frozen-inputs header, phase commands, and approval record are authoritative for execution detail.

The spec is authoritative for every cycle step. This brief supplies only what the spec says the invoker supplies, plus orchestration wiring. If this brief and the spec ever disagree, the spec wins — and record the disagreement in the friction log (below).

## Cycle inputs (frozen; supplied by the invoker)

- `SOURCE_REF`: `refs/heads/replay/context-bonsai-on-opencode-1.15.7` (the port branch in the `opencode/` fork repository; the release tag `bonsai/v1-on-opencode-1.15.7` points at the same commit)
- `SOURCE_HEAD_SHA`: `0dfbeeda7d8a273c52a564333c8179c68d6ab04d`
- `UPSTREAM_REF`: `refs/tags/v1.17.13`
- Harness slot: OpenCode (§4.2); shape: git-fork (Part 2)
- §1.10 pre-existing dirty status paths, parent repo: the `tweakcc_context_bonsai` submodule pin (` M tweakcc_context_bonsai` in `git status --short`). Its dirty state predates the cycle; the §1.10 clean-state check passes with it present, and it must never be staged, committed, or reverted.
- The opt-in validation mode of §1.11 is not requested for this cycle.

## Cycle stage (invoker-supplied fact): generation is complete — this run executes only

The cycle plan for this `SOURCE_HEAD_SHA` has already been generated, validated per §1.15, approved, and committed to parent `main`, together with its validation artifacts:

- `.agents/plans/story-rebase-cycle-0dfbeeda7d8a273c52a564333c8179c68d6ab04d.md`
- `.agents/plans/validation/replay-set-0dfbeeda7d8a273c52a564333c8179c68d6ab04d.json`
- `.agents/plans/validation/manual-review-approvals-0dfbeeda7d8a273c52a564333c8179c68d6ab04d.json`
- `.agents/plans/validation/exceptions-0dfbeeda7d8a273c52a564333c8179c68d6ab04d.json`

Generation and validation ran on the owner tier under the decision record in `docs/meta-loop-direction.md` (cited in the plan's "Plan Approval and Commit Status" section). The spec's steps 2–3 are discharged for this cycle, not skipped. Binding consequences for this run:

- Your job is the spec's steps 4 and 5 only: execute the committed plan phase by phase, then perform §1.16 routine maintenance. Step 1's reading still applies.
- Do not generate, regenerate, or re-validate a plan, and do not run the §1.15 loop. This has no exceptions: where the spec or the plan says a fresh plan "is required" — §1.9 pre-execution source drift, whose STOP lives in the plan's Phase 1 freeze verification, is the known case — the fresh plan belongs to the owner tier, exactly like §1.17 escalation. Your action on that STOP is the standard one: stop the path, append the STOP report to the friction log, attempt §1.16 maintenance, write the final report, end the run.
- The committed artifacts above are not a §1.14 collision: that STOP guards plan generation, and this run performs none — their presence is a cycle input. Nor is this run a resume of a partially executed cycle: execution has not started, and the plan's own preflight collision checks (worktree, branch, tag) verify that before any change is made.
- Before executing Phase 1, confirm the plan's "Plan Approval and Commit Status" section records approval and `Ready-for-Orchestration: yes`. If any artifact listed above is missing, or that section is not affirmative, STOP and report to the invoker.

## Orchestration wiring (ORCHESTRATOR_AGENT.md placeholder values)

- `[ORCHESTRATOR_INSTRUCTIONS_PATH]`: `.llm-conductor/ORCHESTRATOR_AGENT.md`
- `[DEVELOPER_SUBAGENTS_INSTRUCTIONS_PATH]`: `.llm-conductor/DEVELOPER_SUBAGENTS.md`
- `[REVIEWER_SUBAGENTS_INSTRUCTIONS_PATH]`: `.llm-conductor/REVIEWER_SUBAGENTS.md`
- `[REVIEW_JUDGE_SUBAGENTS_INSTRUCTIONS_PATH]`: `.llm-conductor/REVIEW_JUDGE_SUBAGENTS.md`
- Project specification files (judge required reading): `docs/agent-specs/forward-port-spec.md`, `docs/agent-specs/context-bonsai-e2e-spec.md`
- `[STORY_CONTEXT_PATH]`: this brief, plus the approved cycle plan at `.agents/plans/story-rebase-cycle-0dfbeeda7d8a273c52a564333c8179c68d6ab04d.md`.
- All other placeholders in `ORCHESTRATOR_AGENT.md` have no corresponding file in this project. Do not ask for them. Where a subagent instruction document calls for a project specification path, use the two specification files above.

Launch subagents with the task tool, using the agents defined in `opencode.json`: `bonsai-developer`, `bonsai-reviewer`, `bonsai-judge`. The §1.15 validation loop already ran at generation and is not re-run (see Cycle stage above). Your reviewer+judge gates satisfy the spec's §1.8 two-approver contract for any approval the plan's execution requires; no human approval is required on the routine path.

## Run continuity: intent log and reconciliation (owner-directed scaffolding, 2026-07-04)

Your session may be continued, pruned, or compacted mid-run; your memory of what this run has already done is not reliable evidence and must never be the basis for a decision. Two mechanisms replace it:

**Intent log** — `.agents/pilot/gpt55-v1.17.13-intent-log.md`, append-only, seeded by the launcher with a `RUN-START` UTC timestamp. Before every action with side effects — any mutating command, any commit, any subagent launch, any phase transition, any STOP conclusion — first append one line: UTC timestamp, phase/step, what you are about to do, and why. After the action, append its result (commit SHA, exit code, or outcome). **Timestamps must be command-sourced, never typed**: append every line via a command that embeds `$(date -u +%FT%TZ)` (e.g. `echo "$(date -u +%FT%TZ) PHASE-2-START ..." >> <intent log>`); a model-generated timestamp is a rule violation — prior runs wrote timestamps hours off wall clock, which corrupts the evidence ordering reconciliation depends on. Never rewrite or delete entries. Subagents you launch must follow the same rule; tell them so in their task prompts.

**Reconciliation** — at the start of every phase, whenever you cannot fully account for prior actions in this run, and always before concluding any STOP (collision STOPs especially): establish what this run has already done from evidence, not memory. The bound investigation: (1) read the intent log in full and the final report; (2) in the parent repo, `opencode/`, the plugin repo, and the rebase worktree if present: `git log` since the frozen SHAs with commit timestamps, `git reflog -10`, `git worktree list`, and — explicitly in scope — uncommitted working-tree state (`git status --short` and `git diff --stat`), which may hold in-progress step output; (3) compare observed state against the intent log's stated intents. The launcher guarantees a cycle-clean environment at `RUN-START` (invoker-verified; see the run-record clearing precedent): therefore any v1.17.13 cycle artifact — worktree, branch, commit, baseline file, dirty cycle-file edit — whose evidence postdates `RUN-START` is **this run's own work**, not a pre-existing collision. The plan's preflight collision checks apply on first execution only; after they pass, re-observed cycle artifacts mean you resume at the plan's next unexecuted step — never STOP on your own work, never redo a committed step, never discard uncommitted work without reconciling it against the intent log first. Close every reconciliation by appending its conclusion to the intent log: state established, and the next unexecuted step.

**Quota wakes re-enter work.** If your session sleeps out a provider usage-limit backoff mid-run, the wake turn is not a summary turn: run reconciliation and continue at the next unexecuted step. Ending the wake turn with only a status recap and a continue-offer is a rule violation (observed pattern: every quota wake so far stopped without re-entering the work loop). If the process nevertheless exits, the invoker relaunches it as a resume — expect that path and reconcile accordingly.

**Closing duties are evidence-verified like everything else.** A seal or STOP ending is complete only after you (1) write/update the maintenance report and the final report, then (2) re-read both files from disk and confirm they exist and reflect actual repository state (`git log`-verified commits, phases actually executed, gates actually evaluated). Only then may you append the closing intent-log entry and end the run. Claiming a file was written without re-reading it is a rule violation — one prior run ended on closure claims for files that did not exist.

## Non-negotiable orchestration rules

- Execute the spec's steps 4–5 ("How a routine cycle uses this spec") in order, per the Cycle stage section above. Step 5 (§1.16 routine maintenance) is mandatory, not optional — on a STOP as well as on a seal.
- If a spec STOP or hard-fail fires: stop that path. Append a STOP report to the friction log — which STOP, its spec section, the exact evidence, and which assumption of the OpenCode slot (§4.2) or the git-fork shape (Part 2) it calls into question. Never weaken a threshold, ambiguity rule, or gate to keep moving. Do not attempt the spec's §1.17 escalation derivation yourself; it belongs to a different tier. Then attempt §1.16 maintenance — mandatory on a STOP as well as on a seal — write the final report (below), and end the run.
- Friction log: `.agents/pilot/gpt55-v1.17.13-friction-log.md`. Append an entry whenever any of these happens: a subagent fails or is relaunched, a spec instruction is ambiguous or missing for the situation at hand, a command fails unexpectedly, a gate fails, or you or a subagent act beyond the spec's text. Record facts only — UTC timestamp, cycle phase and spec section, what happened, what was done next. Do not classify or excuse entries; classification happens outside this run.
- Do not modify `docs/agent-specs/forward-port-spec.md` while the cycle is running (seal gate 12). §1.16 maintenance runs after the cycle ends — seal or STOP alike — and its edits touch Part 4 only.
- Do not touch: pre-existing directories under `opencode/.agent_tmp/` from prior cycles; the `tweakcc_context_bonsai` submodule pin (enumerated as pre-existing dirty under Cycle inputs above); this brief; `opencode.json`.
- Commit messages must have a body, never a subject line alone.
- **Report-before-stop (owner rule, 2026-07-04): you may not stop without a current report.** Ending the run — on a seal, on a STOP, or on any turn after which you might not continue — is permitted only after `.agents/pilot/gpt55-v1.17.13-final-report.md` has been updated to match actual repository state at that moment: which phases actually executed, every commit actually made in each repository (verify with `git log` in each; never recite from memory), which gates actually passed or failed, and whether the run is ending or still in progress. Update the report immediately after every phase transition, and re-verify it against the repositories before any stop. If you continue working after writing a STOP report, your first action is correcting that report. A final report that contradicts repository state is a hard failure of the run.

## Final report

Maintain `.agents/pilot/gpt55-v1.17.13-final-report.md` throughout the run per the report-before-stop rule above. When the cycle seals — or halts at a STOP — it must contain: the outcome (sealed, or stopped at which spec section), commits made in each repository, which seal gates passed, the §1.16 maintenance outcome and where its report lives, and a pointer to the friction log. Keep it under a page.
