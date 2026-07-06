#!/usr/bin/env node
// Update-cadence gate for the routine forward-port path.
//
// Input contract: docs/agent-specs/forward-port-spec.md §1.20 — routine cycle
// starts are rate-limited to one per cadence period per harness, measured
// against the committed ledger docs/agent-specs/cycle-cadence-ledger.json.
// The period (`cadence-period-days: N`) and the bound harness set (Part 4
// sections) are parsed from the spec at runtime — the spec stays the single
// source of truth; this script carries no policy values.
//
// The gate governs cycle STARTS only. Detection (detect-pending-target.mjs)
// stays continuous; a pending-target signal persists until the harness is
// eligible. A rate-limited refusal is pre-cycle: no §1.17 STOP, no reason
// code.
//
// Major-announcement override (§1.20): --announcement <path> names a
// committed record under docs/announcements/ carrying the machine-checkable
// lines `announcement-scope:`, `announcement-declared:`, and
// `announcement-provenance:`. The gate honors it for a harness when the
// harness is in scope and the declared time postdates the harness's
// last_cycle_start. Announcements are owner-declared; this script only
// verifies the record's shape and timing, never infers one.
//
// Usage:
//   check-cycle-cadence.mjs --harness <name> [--announcement <path>]
//                           [--now <UTC ISO-8601>] [--json]
//
// --now overrides the clock (tests); default is the current system time.
//
// Exit codes: 0 = eligible (period elapsed, or in-scope announcement);
//             1 = usage error (including a harness name not bound in Part 4);
//             2 = fail closed (period binding unparseable, missing/malformed
//                 ledger entry or announcement record, clock before
//                 last_cycle_start);
//             3 = rate-limited (prints the next-eligible UTC time).

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const FORWARD_PORT_SPEC =
  process.env.FORWARD_PORT_SPEC ??
  join(repoRoot, 'docs/agent-specs/forward-port-spec.md');
const CADENCE_LEDGER =
  process.env.CYCLE_CADENCE_LEDGER ??
  join(repoRoot, 'docs/agent-specs/cycle-cadence-ledger.json');

function failClosed(msg) {
  process.stderr.write(`FAIL-CLOSED: ${msg}\n`);
  process.exit(2);
}

function usage(msg) {
  process.stderr.write(
    `${msg}\nusage: check-cycle-cadence.mjs --harness <name> [--announcement <path>] [--now <UTC ISO-8601>] [--json]\n`
  );
  process.exit(1);
}

// Strict UTC ISO-8601: date, time, Z suffix. Local-offset or bare-date forms
// are ambiguous evidence and fail closed at the call sites.
function parseUtc(s, what) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(s))
    failClosed(`${what} is not a Z-suffixed UTC ISO-8601 timestamp: "${s}"`);
  const ms = Date.parse(s);
  if (Number.isNaN(ms)) failClosed(`${what} does not parse as a date: "${s}"`);
  return ms;
}

function loadSpec() {
  let text;
  try {
    text = readFileSync(FORWARD_PORT_SPEC, 'utf8');
  } catch (e) {
    failClosed(`cannot read forward-port spec at ${FORWARD_PORT_SPEC}: ${e.message}`);
  }
  const periodMatches = [...text.matchAll(/`cadence-period-days: (\d+)`/g)];
  if (periodMatches.length !== 1)
    failClosed(
      `expected exactly one \`cadence-period-days: N\` binding in the spec, found ${periodMatches.length}`
    );
  const periodDays = Number(periodMatches[0][1]);
  if (!(periodDays > 0)) failClosed(`cadence period must be positive, got ${periodDays}`);
  const harnesses = [...text.matchAll(/^## 4\.\d+ (.+) \(shape: .+\)\s*$/gm)].map((m) =>
    m[1].trim()
  );
  if (harnesses.length === 0)
    failClosed('parsed zero bound harness sections from Part 4');
  return { periodDays, harnesses };
}

function loadLedgerEntry(harness) {
  let ledger;
  try {
    ledger = JSON.parse(readFileSync(CADENCE_LEDGER, 'utf8'));
  } catch (e) {
    failClosed(`cannot read/parse cadence ledger at ${CADENCE_LEDGER}: ${e.message}`);
  }
  const entry = ledger[harness.toLowerCase()];
  if (!entry)
    failClosed(`no ledger entry for bound harness "${harness}" in ${CADENCE_LEDGER}`);
  if (typeof entry.last_cycle_start !== 'string')
    failClosed(`ledger entry for "${harness}" has no last_cycle_start string`);
  return {
    lastStartMs: parseUtc(entry.last_cycle_start, `last_cycle_start for "${harness}"`),
    lastStartRaw: entry.last_cycle_start,
  };
}

function loadAnnouncement(path, boundHarnesses) {
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch (e) {
    failClosed(`cannot read announcement record at ${path}: ${e.message}`);
  }
  const field = (key) => {
    const matches = [...text.matchAll(new RegExp(`^${key}: *(.+)$`, 'gmi'))];
    if (matches.length !== 1)
      failClosed(`announcement record needs exactly one \`${key}:\` line, found ${matches.length}`);
    return matches[0][1].trim();
  };
  const scopeRaw = field('announcement-scope');
  const declaredMs = parseUtc(field('announcement-declared'), 'announcement-declared');
  const provenance = field('announcement-provenance');
  if (!provenance) failClosed('announcement-provenance is empty');
  let scope;
  if (scopeRaw.toLowerCase() === 'all') {
    scope = boundHarnesses.map((h) => h.toLowerCase());
  } else {
    scope = scopeRaw.split(',').map((s) => s.trim().toLowerCase());
    const bound = new Set(boundHarnesses.map((h) => h.toLowerCase()));
    for (const s of scope)
      if (!bound.has(s))
        failClosed(`announcement-scope names "${s}", which is not a bound Part 4 harness`);
  }
  return { scope, declaredMs, provenance };
}

// --- main ---

const argv = process.argv.slice(2);
let harness = null;
let announcementPath = null;
let nowArg = null;
let json = false;
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--json') json = true;
  else if (a === '--harness') {
    harness = argv[++i];
    if (!harness) usage('--harness needs a name');
  } else if (a === '--announcement') {
    announcementPath = argv[++i];
    if (!announcementPath) usage('--announcement needs a path');
  } else if (a === '--now') {
    nowArg = argv[++i];
    if (!nowArg) usage('--now needs a UTC ISO-8601 timestamp');
  } else usage(`unknown argument: ${a}`);
}
if (!harness) usage('--harness is required');

const { periodDays, harnesses } = loadSpec();
const bound = harnesses.find((h) => h.toLowerCase() === harness.toLowerCase());
if (!bound) usage(`no bound harness named "${harness}"`);

const { lastStartMs, lastStartRaw } = loadLedgerEntry(bound);
const nowMs = nowArg ? parseUtc(nowArg, '--now') : Date.now();
if (nowMs < lastStartMs)
  failClosed(
    `clock (${new Date(nowMs).toISOString()}) is before last_cycle_start (${lastStartRaw}) — the ledger or the clock is wrong`
  );

const nextEligibleMs = lastStartMs + periodDays * 24 * 60 * 60 * 1000;
const periodElapsed = nowMs >= nextEligibleMs;

let announcementGrants = false;
if (announcementPath) {
  const ann = loadAnnouncement(announcementPath, harnesses);
  const inScope = ann.scope.includes(bound.toLowerCase());
  announcementGrants = inScope && ann.declaredMs > lastStartMs;
}

const eligible = periodElapsed || announcementGrants;
const result = {
  harness: bound,
  status: eligible ? 'eligible' : 'rate-limited',
  reason: periodElapsed
    ? 'period-elapsed'
    : announcementGrants
      ? 'announcement-override'
      : 'period-not-elapsed',
  last_cycle_start: lastStartRaw,
  next_eligible: new Date(nextEligibleMs).toISOString().replace(/\.\d{3}Z$/, 'Z'),
  period_days: periodDays,
};
process.stdout.write(
  json
    ? JSON.stringify(result, null, 2) + '\n'
    : `${result.status}: ${result.harness} (${result.reason}) last_cycle_start=${result.last_cycle_start} next_eligible=${result.next_eligible}\n`
);
process.exit(eligible ? 0 : 3);
