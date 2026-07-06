#!/usr/bin/env node
// Automated release detection for the routine forward-port path.
//
// Input contract: docs/agent-specs/forward-port-spec.md Part 4 — each bound
// harness section (`## 4.x <Name> (shape: ...)`) carries a `**Release
// detection**` slot naming its ported-version evidence and upstream release
// query. Both are parsed from the spec at runtime — the spec stays the single
// source of truth; this script carries no per-harness values.
//
// Purpose (docs/meta-loop-direction.md, human-step reduction): the routine
// path's entry trigger stops being a human noticing a release. When the latest
// stable upstream release is newer than the harness's latest ported version,
// this script emits a pending-target signal naming the candidate target. The
// signal is a detection, not an authorization: the cycle-start target is still
// invoker-supplied per §"How a routine cycle uses this spec", and all owner
// gates apply unchanged.
//
// Slot micro-format (backtick-wrapped, space-separated directives):
//   ported-version evidence `git-tag <repo> <tag-prefix>`
//                           `doc-file <dir> <file-prefix>`   (<prefix><version>.md)
//   upstream query          `git-remote-tag <repo> <remote> <tag-prefix> [<tag-suffix>]`
//                           `npm <package>`
// Paths are relative to the repo root (this script's parent directory).
//
// Usage:
//   detect-pending-target.mjs [--harness <name>] [--json] [--plan]
//
// --plan parses and cross-checks the spec bindings and prints the resolved
// sources without running any query (no network, no version reads).
//
// Exit codes: 0 = all checked harnesses up to date (or --plan OK);
//             1 = usage error;
//             2 = fail closed (missing/malformed slot, cross-check mismatch,
//                 query failure, no ported evidence, or ported version ahead
//                 of upstream — an anomaly meaning the evidence or the query
//                 is wrong);
//             3 = pending target detected for at least one checked harness.

import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const FORWARD_PORT_SPEC =
  process.env.FORWARD_PORT_SPEC ??
  join(repoRoot, 'docs/agent-specs/forward-port-spec.md');
const SOURCE_ROOT = process.env.PENDING_TARGET_ROOT ?? repoRoot;

function failClosed(msg) {
  process.stderr.write(`FAIL-CLOSED: ${msg}\n`);
  process.exit(2);
}

function usage(msg) {
  process.stderr.write(
    `${msg}\nusage: detect-pending-target.mjs [--harness <name>] [--json] [--plan]\n`
  );
  process.exit(1);
}

// A version is a plain dot-separated numeric tuple; anything else (prerelease
// suffixes, build metadata) is not a stable release and parses to null.
function parseVersion(s) {
  if (!/^\d+(\.\d+)*$/.test(s)) return null;
  return s.split('.').map(Number);
}

function cmpVersion(a, b) {
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

function maxVersion(strings) {
  let best = null;
  for (const s of strings) {
    const v = parseVersion(s);
    if (v && (best === null || cmpVersion(v, best.parsed) > 0))
      best = { raw: s, parsed: v };
  }
  return best;
}

// Extract bound harness sections from Part 4. A bound section is a `## 4.x`
// heading carrying a `(shape: ...)` marker; schema (§4.1) and unbound (§4.7)
// sections carry none and are skipped by construction.
function loadBoundHarnesses() {
  let specText;
  try {
    specText = readFileSync(FORWARD_PORT_SPEC, 'utf8');
  } catch (e) {
    failClosed(`cannot read forward-port spec at ${FORWARD_PORT_SPEC}: ${e.message}`);
  }
  const lines = specText.split('\n');
  const sections = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^## 4\.\d+ (.+) \(shape: .+\)\s*$/);
    if (!m) continue;
    let end = lines.length;
    for (let j = i + 1; j < lines.length; j++) {
      if (/^#{1,2} /.test(lines[j])) {
        end = j;
        break;
      }
    }
    sections.push({ name: m[1].trim(), body: lines.slice(i, end).join('\n') });
  }
  if (sections.length === 0)
    failClosed('parsed zero bound harness sections from Part 4');
  return sections.map(parseHarnessSlot);
}

function parseHarnessSlot({ name, body }) {
  const line = body.match(/^- \*\*Release detection\*\*.*$/m);
  if (!line)
    failClosed(`bound harness "${name}" has no Release detection slot (Part 4 §4.1)`);
  const ported = line[0].match(/ported-version evidence `([^`]+)`/);
  const upstream = line[0].match(/upstream query `([^`]+)`/);
  if (!ported || !upstream)
    failClosed(
      `Release detection slot for "${name}" is malformed — expected ported-version evidence \`...\` and upstream query \`...\``
    );
  const portedDirective = parseDirective(name, 'ported-version evidence', ported[1], {
    'git-tag': 2,
    'doc-file': 2,
  });
  const upstreamDirective = parseDirective(name, 'upstream query', upstream[1], {
    'git-remote-tag': [3, 4],
    npm: 1,
  });
  // Integrity cross-check: an npm query must target the exact package the
  // Upstream identity slot freezes.
  if (upstreamDirective.kind === 'npm') {
    const identity = body.match(/^- \*\*Upstream identity\*\*: npm package `([^`]+)`/m);
    if (!identity)
      failClosed(
        `"${name}" queries npm but its Upstream identity slot names no npm package`
      );
    if (identity[1] !== upstreamDirective.args[0])
      failClosed(
        `npm package mismatch for "${name}" — Release detection queries "${upstreamDirective.args[0]}", Upstream identity freezes "${identity[1]}"`
      );
  }
  return { name, ported: portedDirective, upstream: upstreamDirective };
}

function parseDirective(harness, field, raw, kinds) {
  const parts = raw.trim().split(/\s+/);
  const kind = parts[0];
  const args = parts.slice(1);
  if (!(kind in kinds))
    failClosed(
      `unknown ${field} kind "${kind}" for "${harness}" (known: ${Object.keys(kinds).join(', ')})`
    );
  const allowed = Array.isArray(kinds[kind]) ? kinds[kind] : [kinds[kind]];
  if (!allowed.includes(args.length))
    failClosed(
      `${field} \`${raw}\` for "${harness}" needs ${allowed.join(' or ')} argument(s), got ${args.length}`
    );
  return { kind, args, raw };
}

function git(repo, gitArgs) {
  return execFileSync('git', ['-C', join(SOURCE_ROOT, repo), ...gitArgs], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function resolvePorted(harness, { kind, args }) {
  if (kind === 'git-tag') {
    const [repo, prefix] = args;
    let out;
    try {
      out = git(repo, ['tag', '-l', `${prefix}*`]);
    } catch (e) {
      failClosed(`git tag listing failed for "${harness}" in ${repo}: ${e.message}`);
    }
    const versions = out
      .split('\n')
      .filter(Boolean)
      .map((t) => t.slice(prefix.length));
    const best = maxVersion(versions);
    if (!best)
      failClosed(`no ported-version tags matching ${args[1]}* in ${repo} for "${harness}"`);
    return best;
  }
  // doc-file
  const [dir, prefix] = args;
  let entries;
  try {
    entries = readdirSync(join(SOURCE_ROOT, dir));
  } catch (e) {
    failClosed(`cannot list ${dir} for "${harness}": ${e.message}`);
  }
  const re = new RegExp(
    `^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\d+(?:\\.\\d+)*)\\.md$`
  );
  const versions = entries.map((f) => f.match(re)?.[1]).filter(Boolean);
  const best = maxVersion(versions);
  if (!best)
    failClosed(`no ${prefix}<version>.md docs in ${dir} for "${harness}"`);
  return best;
}

function resolveUpstream(harness, { kind, args }) {
  if (kind === 'npm') {
    const [pkg] = args;
    let out;
    try {
      out = execFileSync('npm', ['view', pkg, 'version'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (e) {
      failClosed(`npm view failed for "${harness}" (${pkg}): ${e.message}`);
    }
    const raw = out.trim();
    const parsed = parseVersion(raw);
    if (!parsed)
      failClosed(`npm view for "${harness}" returned a non-stable version "${raw}"`);
    return { raw, parsed };
  }
  // git-remote-tag; the optional 4th argument is a literal tag suffix for
  // release families named `<prefix><version><suffix>` (e.g. Cline's
  // `v2.17.0-cli`) — tags without the suffix belong to other families and
  // drop out before version parsing.
  const [repo, remote, prefix, suffix = ''] = args;
  let out;
  try {
    out = git(repo, ['ls-remote', '--tags', remote, `refs/tags/${prefix}*${suffix}`]);
  } catch (e) {
    failClosed(`ls-remote failed for "${harness}" (${repo} ${remote}): ${e.message}`);
  }
  const versions = out
    .split('\n')
    .map((l) => l.match(/\trefs\/tags\/(.+?)(\^\{\})?$/))
    .filter(Boolean)
    .filter((m) => !m[2]) // skip dereferenced ^{} duplicates
    .map((m) => m[1])
    .filter((t) => suffix === '' || t.endsWith(suffix))
    .map((t) => t.slice(prefix.length, t.length - suffix.length));
  const best = maxVersion(versions); // prerelease suffixes parse to null and drop out
  if (!best)
    failClosed(
      `no stable upstream tags matching ${prefix}*${suffix} on ${remote} for "${harness}"`
    );
  return best;
}

// --- main ---

const argv = process.argv.slice(2);
let harnessFilter = null;
let json = false;
let planOnly = false;
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--json') json = true;
  else if (a === '--plan') planOnly = true;
  else if (a === '--harness') {
    harnessFilter = argv[++i];
    if (!harnessFilter) usage('--harness needs a name');
  } else usage(`unknown argument: ${a}`);
}

let harnesses = loadBoundHarnesses();
if (harnessFilter) {
  harnesses = harnesses.filter(
    (h) => h.name.toLowerCase() === harnessFilter.toLowerCase()
  );
  if (harnesses.length === 0) usage(`no bound harness named "${harnessFilter}"`);
}

if (planOnly) {
  const plan = harnesses.map((h) => ({
    harness: h.name,
    ported: h.ported.raw,
    upstream: h.upstream.raw,
  }));
  process.stdout.write(
    json
      ? JSON.stringify(plan, null, 2) + '\n'
      : plan.map((p) => `plan: ${p.harness} ported=[${p.ported}] upstream=[${p.upstream}]`).join('\n') + '\n'
  );
  process.exit(0);
}

const results = [];
for (const h of harnesses) {
  const ported = resolvePorted(h.name, h.ported);
  const upstream = resolveUpstream(h.name, h.upstream);
  const d = cmpVersion(upstream.parsed, ported.parsed);
  if (d < 0)
    failClosed(
      `ported version ahead of upstream for "${h.name}" (ported=${ported.raw}, upstream=${upstream.raw}) — evidence or query is wrong`
    );
  results.push({
    harness: h.name,
    status: d > 0 ? 'pending-target' : 'up-to-date',
    ported: ported.raw,
    upstream: upstream.raw,
  });
}

if (json) {
  process.stdout.write(JSON.stringify(results, null, 2) + '\n');
} else {
  for (const r of results)
    process.stdout.write(`${r.status}: ${r.harness} ported=${r.ported} upstream=${r.upstream}\n`);
}
process.exit(results.some((r) => r.status === 'pending-target') ? 3 : 0);
