#!/usr/bin/env bash
# Steady-state weekly wake for the routine forward-port path
# (docs/agent-specs/forward-port-spec.md §1.21). Runs the invoker chain's
# survey and reports the result to the owner's Slack channel; falls back to
# stdout when the Slack helper is absent. This script only observes and
# notifies — cycle starts and executor launches are the wake session's acts.
set -u
cd "$(dirname "$0")/.."
out=$(node scripts/invoke-routine-cycle.mjs 2>&1)
code=$?
msg="context-bonsai weekly wake — invoke-routine-cycle.mjs exit ${code} (0=quiet, 3=launch-ready, 2=fail-closed):
\`\`\`
${out}
\`\`\`"
slack=/home/basil/llm_prompts/scripts/slack.sh
if [ -x "$slack" ]; then
  "$slack" "$msg"
else
  printf '%s\n' "$msg"
fi
