#!/usr/bin/env bash
# Launch one pilot run of the bonsai-orchestrator, teeing ALL output —
# including the PILOT-PROCESS-EXITED marker — into the run log the
# observer watches. Run 2's marker printed only to the tmux pane, so the
# observer's log watcher could never fire; the braces below route the
# marker through the same tee as the run output.
#
# PILOT_DRYRUN=1 substitutes a no-op for the orchestrator so the
# marker-reaches-log plumbing can be verified before a real launch.
#
# Expected mid-run behavior (run-3 precedent, watchdog-ratified for
# run 4): a provider 429 quota error stalls the run silently — the
# provider SDK sleeps out the retry-after in-process and the session
# self-resumes at quota reset. On any silent stall, the observer checks
# the newest ~/.local/share/opencode/log/*.log for session.processor
# errors and verifies self-resume at the retry-after horizon BEFORE
# considering any injection; injection requires watchdog sanction.
set -u
cd "$(dirname "$0")/../.."
LOG=.agents/pilot/gpt55-v1.17.13-run.log
# Seed the append-only intent log (brief §"Run continuity"): RUN-START marks
# the authorship boundary — cycle artifacts postdating it are this run's work.
INTENT=.agents/pilot/gpt55-v1.17.13-intent-log.md
{
  echo "# Intent Log — gpt55-v1.17.13 pilot run (append-only; see brief §Run continuity)"
  echo "RUN-START $(date -u +%Y-%m-%dT%H:%M:%SZ)"
} > "$INTENT"
{
  if [ "${PILOT_DRYRUN:-0}" = "1" ]; then
    echo "dry-run: orchestrator not launched"
    true
  else
    opencode run --agent bonsai-orchestrator "Read .agents/pilot/gpt55-v1.17.13-brief.md and execute it."
  fi
  echo "PILOT-PROCESS-EXITED code=$?"
} 2>&1 | tee "$LOG"
