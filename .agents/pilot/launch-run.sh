#!/usr/bin/env bash
# Launch one pilot run of the bonsai-orchestrator, teeing ALL output —
# including the PILOT-PROCESS-EXITED marker — into the run log the
# observer watches. Run 2's marker printed only to the tmux pane, so the
# observer's log watcher could never fire; the braces below route the
# marker through the same tee as the run output.
#
# PILOT_DRYRUN=1 substitutes a no-op for the orchestrator so the
# marker-reaches-log plumbing can be verified before a real launch.
set -u
cd "$(dirname "$0")/../.."
LOG=.agents/pilot/gpt55-v1.17.13-run.log
{
  if [ "${PILOT_DRYRUN:-0}" = "1" ]; then
    echo "dry-run: orchestrator not launched"
    true
  else
    opencode run --agent bonsai-orchestrator "Read .agents/pilot/gpt55-v1.17.13-brief.md and execute it."
  fi
  echo "PILOT-PROCESS-EXITED code=$?"
} 2>&1 | tee "$LOG"
