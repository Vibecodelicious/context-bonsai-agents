// Tests for the routine-path invoker chain. Run: node --test scripts/
//
// The two child gate scripts are stubbed via their env overrides
// (PENDING_TARGET_SCRIPT, CYCLE_CADENCE_SCRIPT): these tests exercise the
// chaining, the start acts, and the fail-closed propagation — the children's
// own behavior is covered by their own test files.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFileSync, readFileSync, mkdtempSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const script = join(here, 'invoke-routine-cycle.mjs');

let root;
let n = 0;

const SPEC_TEXT = `# Spec fixture

## 1.20 Update cadence

- **Period**: \`cadence-period-days: 7\`

# Part 4: Per-Harness Bindings

## 4.2 Alpha (shape: git-fork)

- **Release detection**: ported-version evidence \`git-tag alpha bonsai/v1-on-alpha-\`; upstream query \`git-remote-tag alpha upstream v\`

## 4.3 Beta (shape: closed npm artifact)

- **Release detection**: ported-version evidence \`doc-file beta/docs analysis-\`; upstream query \`npm @example/beta\`

## 4.4 Gamma (shape: git-fork)

- **Release detection**: ported-version evidence \`git-tag gamma bonsai/v1-on-gamma-\`; upstream query \`git-remote-tag gamma upstream v -cli\`

## 4.5 Unbound harnesses
`;

// A stub child script: prints canned JSON, exits with a canned code, and can
// assert on the arguments it received.
function stubScript(name, { json, exit }) {
  const path = join(root, `${name}-${n++}.mjs`);
  writeFileSync(
    path,
    `const out = ${JSON.stringify(JSON.stringify(json))};
process.stdout.write(out + '\\n');
process.exit(${exit});
`
  );
  return path;
}

function write(name, content) {
  const path = join(root, `${name}-${n++}`);
  writeFileSync(path, content);
  return path;
}

function run(args, { detect, cadence, ledger, env: extraEnv } = {}) {
  const env = {
    ...process.env,
    FORWARD_PORT_SPEC: write('spec.md', SPEC_TEXT),
    ...(detect ? { PENDING_TARGET_SCRIPT: detect } : {}),
    ...(cadence ? { CYCLE_CADENCE_SCRIPT: cadence } : {}),
    ...(ledger ? { CYCLE_CADENCE_LEDGER: ledger } : {}),
    ...extraEnv,
  };
  try {
    const stdout = execFileSync('node', [script, ...args], { encoding: 'utf8', env });
    return { status: 0, stdout, stderr: '' };
  } catch (e) {
    return { status: e.status, stdout: e.stdout ?? '', stderr: e.stderr ?? '' };
  }
}

const DETECT_ALL_CURRENT = (r) => [
  { harness: 'Alpha', status: 'up-to-date', ported: '1.0.0', upstream: '1.0.0' },
  { harness: 'Beta', status: 'up-to-date', ported: '2.0.0', upstream: '2.0.0' },
];

before(() => {
  root = mkdtempSync(join(tmpdir(), 'invoke-routine-'));
});

// --- survey mode ---------------------------------------------------------

test('all up-to-date: exit 0, no cadence gate consulted', () => {
  const detect = stubScript('detect', {
    json: [
      { harness: 'Alpha', status: 'up-to-date', ported: '1.0.0', upstream: '1.0.0' },
      { harness: 'Beta', status: 'up-to-date', ported: '2.0.0', upstream: '2.0.0' },
    ],
    exit: 0,
  });
  // A cadence stub that fails closed: reaching it would fail the test.
  const cadence = stubScript('cadence', { json: {}, exit: 2 });
  const r = run(['--json'], { detect, cadence });
  assert.equal(r.status, 0, r.stderr);
  const d = JSON.parse(r.stdout);
  assert.equal(d.length, 2);
  assert.ok(d.every((x) => x.status === 'up-to-date'));
});

test('pending + rate-limited: exit 0, next_eligible surfaced', () => {
  const detect = stubScript('detect', {
    json: [{ harness: 'Alpha', status: 'pending-target', ported: '1.0.0', upstream: '1.2.0' }],
    exit: 3,
  });
  const cadence = stubScript('cadence', {
    json: { harness: 'Alpha', status: 'rate-limited', reason: 'period-not-elapsed', next_eligible: '2026-07-12T12:00:00Z' },
    exit: 3,
  });
  const r = run(['--json'], { detect, cadence });
  assert.equal(r.status, 0, r.stderr);
  const [d] = JSON.parse(r.stdout);
  assert.equal(d.status, 'pending-rate-limited');
  assert.equal(d.next_eligible, '2026-07-12T12:00:00Z');
});

test('pending + eligible: exit 3, git-fork target reconstructed with prefix', () => {
  const detect = stubScript('detect', {
    json: [{ harness: 'Alpha', status: 'pending-target', ported: '1.0.0', upstream: '1.2.0' }],
    exit: 3,
  });
  const cadence = stubScript('cadence', {
    json: { harness: 'Alpha', status: 'eligible', reason: 'period-elapsed' },
    exit: 0,
  });
  const r = run(['--json'], { detect, cadence });
  assert.equal(r.status, 3, r.stderr);
  const [d] = JSON.parse(r.stdout);
  assert.equal(d.status, 'launch-ready');
  assert.equal(d.target, 'v1.2.0');
  assert.equal(d.cadence_reason, 'period-elapsed');
});

test('target reconstruction: npm shape uses the bare version, suffix family keeps its suffix', () => {
  for (const [harness, upstream, expected] of [
    ['Beta', '2.3.0', '2.3.0'],
    ['Gamma', '3.1.0', 'v3.1.0-cli'],
  ]) {
    const detect = stubScript('detect', {
      json: [{ harness, status: 'pending-target', ported: '0.1.0', upstream }],
      exit: 3,
    });
    const cadence = stubScript('cadence', {
      json: { harness, status: 'eligible', reason: 'period-elapsed' },
      exit: 0,
    });
    const r = run(['--json', '--harness', harness], { detect, cadence });
    assert.equal(r.status, 3, r.stderr);
    assert.equal(JSON.parse(r.stdout)[0].target, expected);
  }
});

test('child fail-closed propagates as fail-closed (exit 2)', () => {
  const detect = stubScript('detect', { json: [], exit: 2 });
  const r = run([], { detect });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /FAIL-CLOSED/);
});

test('unknown argument is a usage error (exit 1)', () => {
  const r = run(['--bogus']);
  assert.equal(r.status, 1);
});

// --- start mode ----------------------------------------------------------

function startFixture({ eligible = true } = {}) {
  const detect = stubScript('detect', {
    json: [{ harness: 'Alpha', status: 'pending-target', ported: '1.0.0', upstream: '1.2.0' }],
    exit: 3,
  });
  const cadence = eligible
    ? stubScript('cadence', { json: { harness: 'Alpha', status: 'eligible', reason: 'period-elapsed' }, exit: 0 })
    : stubScript('cadence', { json: { harness: 'Alpha', status: 'rate-limited', reason: 'period-not-elapsed', next_eligible: 'x' }, exit: 3 });
  // Ledger inside a real throwaway git repo so the start commit can land.
  const repo = mkdtempSync(join(tmpdir(), 'invoke-repo-'));
  execFileSync('git', ['-C', repo, 'init', '-q']);
  execFileSync('git', ['-C', repo, 'config', 'user.email', 't@t']);
  execFileSync('git', ['-C', repo, 'config', 'user.name', 't']);
  const ledger = join(repo, 'ledger.json');
  writeFileSync(
    ledger,
    JSON.stringify({ alpha: { last_cycle_start: '2026-07-01T00:00:00Z', evidence: 'seed' } })
  );
  execFileSync('git', ['-C', repo, 'add', '.']);
  execFileSync('git', ['-C', repo, 'commit', '-qm', 'seed']);
  return { detect, cadence, ledger, repo, intentLog: join(repo, 'intent.log') };
}

test('start: writes ledger, commits it alone, seeds intent log, prints launch packet', () => {
  const f = startFixture();
  const r = run(['--start', '--harness', 'Alpha', '--intent-log', f.intentLog], f);
  assert.equal(r.status, 0, r.stderr);
  const packet = JSON.parse(r.stdout);
  assert.equal(packet.harness, 'Alpha');
  assert.equal(packet.target, 'v1.2.0');
  assert.match(packet.run_start, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  // Ledger updated with the same command-sourced timestamp.
  const ledger = JSON.parse(readFileSync(f.ledger, 'utf8'));
  assert.equal(ledger.alpha.last_cycle_start, packet.run_start);
  assert.match(ledger.alpha.evidence, /invoke-routine-cycle\.mjs start vs v1\.2\.0/);
  // The start commit exists, is HEAD, and touches only the ledger.
  const head = execFileSync('git', ['-C', f.repo, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  assert.equal(packet.ledger_commit, head);
  const files = execFileSync('git', ['-C', f.repo, 'show', '--name-only', '--format=', 'HEAD'], { encoding: 'utf8' }).trim();
  assert.equal(files, 'ledger.json');
  // Intent log seeded with RUN-START at the same timestamp.
  const log = readFileSync(f.intentLog, 'utf8');
  assert.equal(log, `${packet.run_start} RUN-START invoker=invoke-routine-cycle.mjs harness=Alpha target=v1.2.0\n`);
});

test('start refuses a harness that is not launch-ready', () => {
  const f = startFixture({ eligible: false });
  const r = run(['--start', '--harness', 'Alpha', '--intent-log', f.intentLog], f);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /not launch-ready/);
  // No start acts happened.
  assert.equal(existsSync(f.intentLog), false);
  assert.equal(JSON.parse(readFileSync(f.ledger, 'utf8')).alpha.last_cycle_start, '2026-07-01T00:00:00Z');
});

test('start refuses an existing intent log (resume is not a new start)', () => {
  const f = startFixture();
  writeFileSync(f.intentLog, 'prior RUN-START\n');
  const r = run(['--start', '--harness', 'Alpha', '--intent-log', f.intentLog], f);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /already exists.*resume/);
  // Ledger untouched: the refusal precedes the recording acts.
  assert.equal(JSON.parse(readFileSync(f.ledger, 'utf8')).alpha.last_cycle_start, '2026-07-01T00:00:00Z');
});

test('start without --harness or --intent-log is a usage error', () => {
  const f = startFixture();
  assert.equal(run(['--start', '--intent-log', f.intentLog], f).status, 1);
  assert.equal(run(['--start', '--harness', 'Alpha'], f).status, 1);
});

test('default child paths resolve to the real sibling scripts', () => {
  // Behavior of the children is covered by their own tests; this asserts
  // only that the no-override fallback paths exist beside the invoker.
  for (const child of ['detect-pending-target.mjs', 'check-cycle-cadence.mjs'])
    assert.ok(existsSync(join(here, child)), `${child} missing beside the invoker`);
});
