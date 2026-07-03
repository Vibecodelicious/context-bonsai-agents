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

## Non-negotiable orchestration rules

- Execute the spec's steps 4–5 ("How a routine cycle uses this spec") in order, per the Cycle stage section above. Step 5 (§1.16 routine maintenance) is mandatory, not optional — on a STOP as well as on a seal.
- If a spec STOP or hard-fail fires: stop that path. Append a STOP report to the friction log — which STOP, its spec section, the exact evidence, and which assumption of the OpenCode slot (§4.2) or the git-fork shape (Part 2) it calls into question. Never weaken a threshold, ambiguity rule, or gate to keep moving. Do not attempt the spec's §1.17 escalation derivation yourself; it belongs to a different tier. Then attempt §1.16 maintenance — mandatory on a STOP as well as on a seal — write the final report (below), and end the run.
- Friction log: `.agents/pilot/gpt55-v1.17.13-friction-log.md`. Append an entry whenever any of these happens: a subagent fails or is relaunched, a spec instruction is ambiguous or missing for the situation at hand, a command fails unexpectedly, a gate fails, or you or a subagent act beyond the spec's text. Record facts only — UTC timestamp, cycle phase and spec section, what happened, what was done next. Do not classify or excuse entries; classification happens outside this run.
- Do not modify `docs/agent-specs/forward-port-spec.md` while the cycle is running (seal gate 12). §1.16 maintenance runs after the cycle ends — seal or STOP alike — and its edits touch Part 4 only.
- Do not touch: pre-existing directories under `opencode/.agent_tmp/` from prior cycles; the `tweakcc_context_bonsai` submodule pin (enumerated as pre-existing dirty under Cycle inputs above); this brief; `opencode.json`.
- Commit messages must have a body, never a subject line alone.

## Final report

When the cycle seals — or halts at a STOP — write `.agents/pilot/gpt55-v1.17.13-final-report.md` containing: the outcome (sealed, or stopped at which spec section), commits made in each repository, which seal gates passed, the §1.16 maintenance outcome and where its report lives, and a pointer to the friction log. Keep it under a page.
