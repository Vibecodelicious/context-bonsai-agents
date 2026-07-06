#!/usr/bin/env node
// Routine-path invoker chain: detection → cadence gate → cycle-start acts.
//
// Input contract: docs/agent-specs/forward-port-spec.md §1.21 — this script
// chains the two existing gate scripts (detect-pending-target.mjs,
// check-cycle-cadence.mjs) so a routine release needs no human judgment
// between the detector signal and the executor launch. It carries no policy
// values of its own: harness bindings, the cadence period, and the ledger
// all come from the spec and its committed artifacts via the child scripts.
//
// Two modes:
//
//   Survey (default): for every bound harness (or --harness <name>), run the
//   detector; when a pending target exists, run the cadence gate. Reports one
//   combined status per harness: `up-to-date`, `pending-rate-limited` (with
//   the next-eligible time), or `launch-ready` (pending target + eligible).
//
//   Start (--start --harness <name> --intent-log <path>): requires the
//   harness to be launch-ready, then performs the cycle-start acts the spec
//   assigns to the invoker: (1) §1.20 — update the harness's ledger entry
//   with a command-sourced UTC timestamp and commit the ledger update
//   immediately as its own commit; (2) §1.18 — seed the intent log with a
//   RUN-START line (fails closed if the log already exists: an existing log
//   marks a resume, which is a relaunch act, not a new start). It then prints
//   a launch packet (JSON) naming the harness, the reconstructed target
//   release (git-fork: the full tag; closed-artifact: the version), the
//   ledger commit, and the intent-log path. Spawning the executor session is
//   the wake session's act (§1.21), not this script's.
//
// Usage:
//   invoke-routine-cycle.mjs [--harness <name>] [--announcement <path>]
//                            [--now <UTC ISO-8601>] [--json]
//   invoke-routine-cycle.mjs --start --harness <name> --intent-log <path>
//                            [--announcement <path>]
//
// --now is passed through to the cadence gate (tests); it does not affect
// the ledger timestamp written by --start, which is always the real clock.
//
// Exit codes: 0 = survey found nothing launch-ready, or start completed;
//             1 = usage error;
//             2 = fail closed (any child fail-closed, unexpected child exit,
//                 ledger/intent-log/commit act failure);
//             3 = survey found at least one launch-ready harness.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const DETECT_SCRIPT = process.env.PENDING_TARGET_SCRIPT ?? join(here, 'detect-pending-target.mjs');
const CADENCE_SCRIPT = process.env.CYCLE_CADENCE_SCRIPT ?? join(here, 'check-cycle-cadence.mjs');
const FORWARD_PORT_SPEC =
  process.env.FORWARD_PORT_SPEC ?? join(here, '..', 'docs/agent-specs/forward-port-spec.md');
const CADENCE_LEDGER =
  process.env.CYCLE_CADENCE_LEDGER ?? join(here, '..', 'docs/agent-specs/cycle-cadence-ledger.json');

function failClosed(msg) {
  process.stderr.write(`FAIL-CLOSED: ${msg}\n`);
  process.exit(2);
}

function usage(msg) {
  process.stderr.write(
    `${msg}\nusage: invoke-routine-cycle.mjs [--start] [--harness <name>] [--intent-log <path>] [--announcement <path>] [--now <UTC ISO-8601>] [--json]\n`
  );
  process.exit(1);
}

// Run a child gate script; only the exit codes the child documents are legal.
function runChild(script, args, allowed) {
  const r = spawnSync('node', [script, ...args], { encoding: 'utf8' });
  if (r.error) failClosed(`cannot run ${script}: ${r.error.message}`);
  if (!allowed.includes(r.status))
    failClosed(
      `${script} exited ${r.status} (allowed: ${allowed.join(',')}): ${r.stderr.trim()}`
    );
  return r;
}

// Reconstruct the cycle-start target the spec requires the invoker to supply
// (§"How a routine cycle uses this spec"): for a git-remote-tag upstream
// query the full release tag `<prefix><version><suffix>`, for npm the bare
// version. The slot line is re-read from the spec (same single source of
// truth the detector parses) rather than trusting a re-typed value.
function targetFor(harness, upstreamVersion) {
  let text;
  try {
    text = readFileSync(FORWARD_PORT_SPEC, 'utf8');
  } catch (e) {
    failClosed(`cannot read forward-port spec at ${FORWARD_PORT_SPEC}: ${e.message}`);
  }
  const lines = text.split('\n');
  const head = lines.findIndex((l) =>
    new RegExp(`^## 4\\.\\d+ ${harness.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\(shape: `).test(l)
  );
  if (head === -1) failClosed(`no Part 4 section for "${harness}"`);
  let body = [];
  for (let i = head + 1; i < lines.length && !/^#{1,2} /.test(lines[i]); i++) body.push(lines[i]);
  const m = body.join('\n').match(/upstream query `([^`]+)`/);
  if (!m) failClosed(`no upstream query directive in the "${harness}" Release detection slot`);
  const parts = m[1].trim().split(/\s+/);
  if (parts[0] === 'npm') return upstreamVersion;
  if (parts[0] === 'git-remote-tag') {
    const prefix = parts[3] ?? '';
    const suffix = parts[4] ?? '';
    return `${prefix}${upstreamVersion}${suffix}`;
  }
  failClosed(`unknown upstream query kind "${parts[0]}" for "${harness}"`);
}

function survey(harnessFilter, announcementPath, nowArg) {
  const detectArgs = ['--json', ...(harnessFilter ? ['--harness', harnessFilter] : [])];
  const det = runChild(DETECT_SCRIPT, detectArgs, [0, 3]);
  let detected;
  try {
    detected = JSON.parse(det.stdout);
  } catch (e) {
    failClosed(`detector output is not JSON: ${e.message}`);
  }
  return detected.map((d) => {
    if (d.status !== 'pending-target')
      return { harness: d.harness, status: 'up-to-date', ported: d.ported, upstream: d.upstream };
    const gateArgs = [
      '--harness', d.harness, '--json',
      ...(announcementPath ? ['--announcement', announcementPath] : []),
      ...(nowArg ? ['--now', nowArg] : []),
    ];
    const gate = runChild(CADENCE_SCRIPT, gateArgs, [0, 3]);
    let g;
    try {
      g = JSON.parse(gate.stdout);
    } catch (e) {
      failClosed(`cadence gate output is not JSON: ${e.message}`);
    }
    return gate.status === 0
      ? {
          harness: d.harness, status: 'launch-ready',
          ported: d.ported, upstream: d.upstream,
          target: targetFor(d.harness, d.upstream), cadence_reason: g.reason,
        }
      : {
          harness: d.harness, status: 'pending-rate-limited',
          ported: d.ported, upstream: d.upstream, next_eligible: g.next_eligible,
        };
  });
}

// --- main ---

const argv = process.argv.slice(2);
let start = false;
let harness = null;
let intentLog = null;
let announcementPath = null;
let nowArg = null;
let json = false;
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--start') start = true;
  else if (a === '--json') json = true;
  else if (a === '--harness') {
    harness = argv[++i];
    if (!harness) usage('--harness needs a name');
  } else if (a === '--intent-log') {
    intentLog = argv[++i];
    if (!intentLog) usage('--intent-log needs a path');
  } else if (a === '--announcement') {
    announcementPath = argv[++i];
    if (!announcementPath) usage('--announcement needs a path');
  } else if (a === '--now') {
    nowArg = argv[++i];
    if (!nowArg) usage('--now needs a UTC ISO-8601 timestamp');
  } else usage(`unknown argument: ${a}`);
}

if (!start) {
  if (intentLog) usage('--intent-log only applies with --start');
  const results = survey(harness, announcementPath, nowArg);
  if (json) process.stdout.write(JSON.stringify(results, null, 2) + '\n');
  else
    for (const r of results)
      process.stdout.write(
        `${r.status}: ${r.harness} ported=${r.ported} upstream=${r.upstream}` +
          (r.target ? ` target=${r.target}` : '') +
          (r.next_eligible ? ` next_eligible=${r.next_eligible}` : '') +
          '\n'
      );
  process.exit(results.some((r) => r.status === 'launch-ready') ? 3 : 0);
}

// --start
if (!harness) usage('--start requires --harness');
if (!intentLog) usage('--start requires --intent-log');
const [status] = survey(harness, announcementPath, nowArg);
if (!status || status.status !== 'launch-ready')
  failClosed(
    `harness "${harness}" is not launch-ready (${status?.status ?? 'no detector result'}) — --start performs cycle-start acts only for a pending, cadence-eligible target`
  );

const intentLogPath = resolve(intentLog);
if (existsSync(intentLogPath))
  failClosed(
    `intent log already exists at ${intentLogPath} — an existing log marks a resume (§1.18 relaunch-as-resume), not a new cycle start`
  );

// §1.20: command-sourced timestamp; the shell date command is the spec-named
// source (never model- or library-typed at a distance from the recording act).
const startedAt = execFileSync('date', ['-u', '+%FT%TZ'], { encoding: 'utf8' }).trim();

let ledger;
try {
  ledger = JSON.parse(readFileSync(CADENCE_LEDGER, 'utf8'));
} catch (e) {
  failClosed(`cannot read/parse cadence ledger at ${CADENCE_LEDGER}: ${e.message}`);
}
const key = status.harness.toLowerCase();
if (!ledger[key]) failClosed(`no ledger entry for "${status.harness}" in ${CADENCE_LEDGER}`);
ledger[key] = {
  last_cycle_start: startedAt,
  evidence: `invoke-routine-cycle.mjs start vs ${status.target} (this ledger commit is the start record)`,
};
try {
  writeFileSync(CADENCE_LEDGER, JSON.stringify(ledger, null, 2) + '\n');
} catch (e) {
  failClosed(`cannot write cadence ledger: ${e.message}`);
}

// §1.20: the ledger update lands immediately as its own commit, before any
// executor launch, so the consumed slot is durable even on a false start.
const ledgerDir = dirname(resolve(CADENCE_LEDGER));
try {
  execFileSync('git', ['-C', ledgerDir, 'add', resolve(CADENCE_LEDGER)], { stdio: 'pipe' });
  execFileSync(
    'git',
    ['-C', ledgerDir, 'commit', '-m',
      `cadence: record ${key} cycle start vs ${status.target}\n\nRoutine-path invoker (invoke-routine-cycle.mjs --start): detector reported\nported=${status.ported} upstream=${status.upstream}; cadence gate reported eligible\n(${status.cadence_reason}). Ledger commit per forward-port-spec.md §1.20.`,
      '--', resolve(CADENCE_LEDGER)],
    { stdio: 'pipe' }
  );
} catch (e) {
  failClosed(`ledger commit failed: ${e.stderr?.toString().trim() || e.message}`);
}
const ledgerCommit = execFileSync('git', ['-C', ledgerDir, 'rev-parse', 'HEAD'], {
  encoding: 'utf8',
}).trim();

// §1.18: seed the intent log (only-when-absent was asserted above).
writeFileSync(
  intentLogPath,
  `${startedAt} RUN-START invoker=invoke-routine-cycle.mjs harness=${status.harness} target=${status.target}\n`
);

process.stdout.write(
  JSON.stringify(
    {
      harness: status.harness,
      target: status.target,
      ported: status.ported,
      upstream: status.upstream,
      run_start: startedAt,
      ledger_commit: ledgerCommit,
      intent_log: intentLogPath,
      spec: resolve(FORWARD_PORT_SPEC),
    },
    null,
    2
  ) + '\n'
);
process.exit(0);
