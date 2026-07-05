#!/usr/bin/env node
// Path-selection dispatcher for escalation reason codes.
//
// Input contract: docs/agent-specs/forward-port-spec.md §1.17 (the reason-code
// registry). Expensive branch: docs/agent-specs/derivation-pipeline-spec.md §2.2
// (structural-break entry stages and demotion sets). Both tables are parsed from
// the spec files at runtime — the specs stay the single source of truth; this
// script carries no copy of the registry.
//
// Routing rule (verbatim from §1.17): only `structural-*` codes enter level-2
// re-derivation; every other class resumes within the routine path by its
// recorded route. Routing a non-structural code into re-derivation is itself an
// error — so this dispatcher never does it.
//
// Usage:
//   dispatch-escalation.mjs <code> [--json]
//   dispatch-escalation.mjs --report <file> [--json]
//
// Report mode scans the file for emission lines of the form
//   escalation-reason-code: <code>
// (case-insensitive key; the code may be backtick-wrapped) and requires exactly
// one distinct code — zero or several distinct codes is a fail-closed error.
//
// Exit codes: 0 = routed (route named in output); 1 = usage error;
//             2 = fail closed (unknown code, ambiguous emission, registry
//                 parse failure, or §1.17/§2.2 cross-check mismatch).

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const FORWARD_PORT_SPEC =
  process.env.FORWARD_PORT_SPEC ??
  join(repoRoot, 'docs/agent-specs/forward-port-spec.md');
const DERIVATION_PIPELINE_SPEC =
  process.env.DERIVATION_PIPELINE_SPEC ??
  join(repoRoot, 'docs/agent-specs/derivation-pipeline-spec.md');

function failClosed(msg) {
  process.stderr.write(`FAIL-CLOSED: ${msg}\n`);
  process.exit(2);
}

function usage(msg) {
  process.stderr.write(
    `${msg}\nusage: dispatch-escalation.mjs <code> [--json]\n` +
      `       dispatch-escalation.mjs --report <file> [--json]\n`
  );
  process.exit(1);
}

// Extract the markdown section starting at `heading` up to the next same-or-
// higher-level heading.
function section(text, heading) {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => l.startsWith(heading));
  if (start === -1) return null;
  const level = heading.match(/^#+/)[0].length;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    const m = lines[i].match(/^(#+) /);
    if (m && m[1].length <= level) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join('\n');
}

// Parse all pipe-table body rows in a markdown fragment into cell arrays.
function tableRows(fragment) {
  const rows = [];
  for (const line of fragment.split('\n')) {
    if (!line.startsWith('|')) continue;
    const cells = line
      .split('|')
      .slice(1, -1)
      .map((c) => c.trim());
    if (cells.length < 2) continue;
    if (cells.every((c) => /^:?-+:?$/.test(c))) continue; // separator row
    rows.push(cells);
  }
  return rows;
}

const stripTicks = (s) => s.replace(/`/g, '');

function loadRegistry() {
  let specText;
  try {
    specText = readFileSync(FORWARD_PORT_SPEC, 'utf8');
  } catch (e) {
    failClosed(`cannot read forward-port spec at ${FORWARD_PORT_SPEC}: ${e.message}`);
  }
  const sec = section(specText, '## 1.17');
  if (!sec) failClosed('forward-port spec has no §1.17 section');
  const allRows = tableRows(sec);
  const rows = allRows.filter((r) => r.length === 4 && r[0] !== 'Code');
  // Integrity floor: every non-header table row in §1.17 must parse as exactly
  // 4 cells — a single malformed row must not silently drop a code.
  const malformed = allRows.filter((r) => r.length !== 4 && r[0] !== 'Code');
  if (malformed.length)
    failClosed(
      `§1.17 has ${malformed.length} table row(s) that do not parse as 4 cells (first: "${malformed[0][0]}")`
    );
  if (rows.length === 0) failClosed('parsed zero registry rows from §1.17');
  const registry = new Map();
  for (const [code, condition, invalidates, resumesBy] of rows) {
    const c = stripTicks(code);
    if (registry.has(c)) failClosed(`duplicate §1.17 code: ${c}`);
    registry.set(c, { code: c, condition, invalidates, resumesBy });
  }
  return registry;
}

function loadStructuralEntries() {
  let specText;
  try {
    specText = readFileSync(DERIVATION_PIPELINE_SPEC, 'utf8');
  } catch (e) {
    failClosed(
      `cannot read derivation-pipeline spec at ${DERIVATION_PIPELINE_SPEC}: ${e.message}`
    );
  }
  const sec = section(specText, '### 2.2');
  if (!sec) failClosed('derivation-pipeline spec has no §2.2 section');
  const rows = tableRows(sec).filter(
    (r) => r.length === 4 && stripTicks(r[0]).startsWith('structural-')
  );
  if (rows.length === 0) failClosed('parsed zero structural-entry rows from §2.2');
  const entries = new Map();
  for (const [code, scope, entryStage, demotionSet] of rows) {
    const c = stripTicks(code);
    if (!/Stage \d/.test(entryStage))
      failClosed(`§2.2 row for ${c} has no usable entry stage ("${entryStage}")`);
    if (!demotionSet)
      failClosed(`§2.2 row for ${c} has an empty demotion-set cell`);
    entries.set(c, { invalidationScope: scope, entryStage, demotionSet });
  }
  return entries;
}

// Cross-check: the structural codes in §1.17 and the rows in §2.2 must be the
// same set. A mismatch means one spec drifted — refuse to route anything.
function crossCheck(registry, entries) {
  const structural = [...registry.keys()].filter((c) => c.startsWith('structural-'));
  const missing = structural.filter((c) => !entries.has(c));
  const extra = [...entries.keys()].filter((c) => !registry.has(c));
  if (missing.length || extra.length) {
    failClosed(
      `§1.17/§2.2 structural-code mismatch — ` +
        `in §1.17 but not §2.2: [${missing.join(', ')}]; ` +
        `in §2.2 but not §1.17: [${extra.join(', ')}]`
    );
  }
  // §2.2's scope column claims to restate §1.17's Invalidates column ("per
  // §1.17"). §1.17 may carry an extra clarifying clause, so require the §2.2
  // value to appear within the §1.17 value after normalization — not equality.
  const norm = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  for (const c of structural) {
    const spec117 = norm(registry.get(c).invalidates);
    const spec22 = norm(entries.get(c).invalidationScope);
    if (!spec117.includes(spec22)) {
      failClosed(
        `invalidation-scope drift for ${c} — §1.17 says "${registry.get(c).invalidates}", §2.2 says "${entries.get(c).invalidationScope}"`
      );
    }
  }
}

function extractCodeFromReport(path) {
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch (e) {
    failClosed(`cannot read report at ${path}: ${e.message}`);
  }
  const found = new Set();
  // Line-anchored per the §1.17 emission contract: the key starts a line
  // (case-insensitive), the code sits on the SAME line. Prose that merely
  // mentions the phrase mid-line, or splits key and code across lines, is not
  // an emission.
  const re = /^[ \t]*escalation-reason-code:[ \t]*`?([A-Za-z0-9-]+)`?[ \t]*$/gim;
  for (const m of text.matchAll(re)) {
    const code = m[1];
    if (code !== code.toLowerCase())
      failClosed(
        `report ${path} emission line carries non-lowercase code "${code}" — codes are lowercase; only the key is case-insensitive`
      );
    found.add(code);
  }
  if (found.size === 0)
    failClosed(
      `report ${path} carries no emission line (expected "escalation-reason-code: <code>")`
    );
  if (found.size > 1)
    failClosed(
      `report ${path} carries ${found.size} distinct reason codes (${[...found].join(
        ', '
      )}) — §1.17 requires exactly one`
    );
  return [...found][0];
}

function main() {
  const argv = process.argv.slice(2);
  const json = argv.includes('--json');
  const args = argv.filter((a) => a !== '--json');

  let code;
  if (args[0] === '--report') {
    if (args.length !== 2) usage('--report takes exactly one file argument');
    code = extractCodeFromReport(args[1]);
  } else if (args.length === 1 && !args[0].startsWith('-')) {
    code = args[0];
  } else {
    usage(args.length === 0 ? 'missing reason code' : `unrecognized arguments: ${args.join(' ')}`);
  }

  const registry = loadRegistry();
  const entries = loadStructuralEntries();
  crossCheck(registry, entries);

  const row = registry.get(code);
  if (!row)
    failClosed(
      `unknown reason code "${code}" — not in the §1.17 registry (${registry.size} codes)`
    );

  const structural = code.startsWith('structural-');
  const decision = structural
    ? {
        code,
        route: 'level-2-re-derivation',
        invalidates: row.invalidates,
        entryStage: entries.get(code).entryStage,
        demotionSet: entries.get(code).demotionSet,
        note:
          'Owner-tier structural-break derivation per derivation-pipeline-spec.md §2.2; ' +
          'the emitting cycle is superseded (§1.9 semantics); demotion-set bindings become untrusted priors.',
      }
    : {
        code,
        route: 'routine-resume',
        invalidates: row.invalidates,
        resumesBy: row.resumesBy,
        note:
          'Resumes within the routine path by the recorded route (forward-port-spec.md §1.17); ' +
          'level-2 re-derivation is NOT entered.',
      };

  if (json) {
    process.stdout.write(JSON.stringify(decision, null, 2) + '\n');
  } else {
    process.stdout.write(`code:  ${decision.code}\nroute: ${decision.route}\n`);
    process.stdout.write(`invalidates: ${decision.invalidates}\n`);
    if (structural) {
      process.stdout.write(`entry stage: ${decision.entryStage}\n`);
      process.stdout.write(`demotion set: ${decision.demotionSet}\n`);
    } else {
      process.stdout.write(`resumes by: ${decision.resumesBy}\n`);
    }
    process.stdout.write(`${decision.note}\n`);
  }
}

main();
