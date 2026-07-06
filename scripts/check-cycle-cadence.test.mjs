// Tests for the update-cadence gate. Run: node --test scripts/
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const script = join(here, 'check-cycle-cadence.mjs');
const realSpec = join(here, '..', 'docs/agent-specs/forward-port-spec.md');
const realLedger = join(here, '..', 'docs/agent-specs/cycle-cadence-ledger.json');

let root;

function specText({ periodLine } = {}) {
  return `# Spec fixture

## 1.20 Update cadence

${periodLine ?? '- **Period**: `cadence-period-days: 7` — machine-readable binding.'}

# Part 4: Per-Harness Bindings

## 4.2 Alpha (shape: git-fork)

- body

## 4.3 Beta (shape: closed npm artifact)

- body

## 4.4 Unbound harnesses
`;
}

function writeFixture(name, content) {
  const path = join(root, `${name}-${Math.random().toString(36).slice(2)}`);
  writeFileSync(path, content);
  return path;
}

const DEFAULT_LEDGER = {
  alpha: { last_cycle_start: '2026-07-01T12:00:00Z', evidence: 'commit aaa' },
  beta: { last_cycle_start: '2026-07-05T12:00:00Z', evidence: 'commit bbb' },
};

function run(args, { spec, ledger } = {}) {
  const env = {
    ...process.env,
    FORWARD_PORT_SPEC: spec ?? writeFixture('spec', specText()),
    CYCLE_CADENCE_LEDGER:
      ledger ?? writeFixture('ledger', JSON.stringify(DEFAULT_LEDGER)),
  };
  try {
    const stdout = execFileSync('node', [script, ...args], { encoding: 'utf8', env });
    return { status: 0, stdout, stderr: '' };
  } catch (e) {
    return { status: e.status, stdout: e.stdout ?? '', stderr: e.stderr ?? '' };
  }
}

function announcement({ scope = 'all', declared = '2026-07-06T00:00:00Z', provenance = 'owner declaration 2026-07-06', omit = [] } = {}) {
  const lines = [
    '# Announcement fixture',
    '',
    ...(!omit.includes('scope') ? [`announcement-scope: ${scope}`] : []),
    ...(!omit.includes('declared') ? [`announcement-declared: ${declared}`] : []),
    ...(!omit.includes('provenance') ? [`announcement-provenance: ${provenance}`] : []),
  ];
  return writeFixture('announcement.md', lines.join('\n') + '\n');
}

before(() => {
  root = mkdtempSync(join(tmpdir(), 'check-cadence-'));
});

// --- tests --------------------------------------------------------------

test('eligible when the period has elapsed (exit 0)', () => {
  const r = run(['--harness', 'Alpha', '--now', '2026-07-08T12:00:00Z', '--json']);
  assert.equal(r.status, 0, r.stderr);
  const d = JSON.parse(r.stdout);
  assert.equal(d.status, 'eligible');
  assert.equal(d.reason, 'period-elapsed');
  assert.equal(d.next_eligible, '2026-07-08T12:00:00Z');
});

test('rate-limited inside the period (exit 3, next-eligible printed)', () => {
  const r = run(['--harness', 'Beta', '--now', '2026-07-08T12:00:00Z', '--json']);
  assert.equal(r.status, 3, r.stderr);
  const d = JSON.parse(r.stdout);
  assert.equal(d.status, 'rate-limited');
  assert.equal(d.reason, 'period-not-elapsed');
  assert.equal(d.next_eligible, '2026-07-12T12:00:00Z');
});

test('boundary: exactly at period end is eligible', () => {
  const r = run(['--harness', 'Beta', '--now', '2026-07-12T12:00:00Z']);
  assert.equal(r.status, 0, r.stderr);
});

test('announcement override: all-scope declared after last start grants eligibility', () => {
  const r = run([
    '--harness', 'Beta',
    '--now', '2026-07-06T06:00:00Z',
    '--announcement', announcement({ declared: '2026-07-06T00:00:00Z' }),
    '--json',
  ]);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(JSON.parse(r.stdout).reason, 'announcement-override');
});

test('announcement declared before last start grants nothing (one start per announcement)', () => {
  const r = run([
    '--harness', 'Beta',
    '--now', '2026-07-06T06:00:00Z',
    '--announcement', announcement({ declared: '2026-07-05T00:00:00Z' }),
  ]);
  assert.equal(r.status, 3, r.stderr);
});

test('harness-scoped announcement does not unlock out-of-scope harness', () => {
  const r = run([
    '--harness', 'Beta',
    '--now', '2026-07-06T06:00:00Z',
    '--announcement', announcement({ scope: 'Alpha' }),
  ]);
  assert.equal(r.status, 3, r.stderr);
});

test('harness-scoped announcement unlocks the named harness (case-insensitive)', () => {
  const r = run([
    '--harness', 'beta',
    '--now', '2026-07-06T06:00:00Z',
    '--announcement', announcement({ scope: 'beta' }),
    '--json',
  ]);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(JSON.parse(r.stdout).harness, 'Beta');
});

test('announcement scoping an unbound harness fails closed', () => {
  const r = run([
    '--harness', 'Beta',
    '--now', '2026-07-06T06:00:00Z',
    '--announcement', announcement({ scope: 'Gamma' }),
  ]);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /not a bound Part 4 harness/);
});

test('announcement missing a required line fails closed', () => {
  for (const omit of ['scope', 'declared', 'provenance']) {
    const r = run([
      '--harness', 'Beta',
      '--now', '2026-07-06T06:00:00Z',
      '--announcement', announcement({ omit: [omit] }),
    ]);
    assert.equal(r.status, 2, `omitting ${omit} should fail closed`);
    assert.match(r.stderr, /exactly one/);
  }
});

test('non-UTC ledger timestamp fails closed', () => {
  const ledger = writeFixture(
    'ledger',
    JSON.stringify({ alpha: { last_cycle_start: '2026-07-01T12:00:00-07:00' }, beta: DEFAULT_LEDGER.beta })
  );
  const r = run(['--harness', 'Alpha', '--now', '2026-07-08T12:00:00Z'], { ledger });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /not a Z-suffixed UTC/);
});

test('missing ledger entry for a bound harness fails closed', () => {
  const ledger = writeFixture('ledger', JSON.stringify({ alpha: DEFAULT_LEDGER.alpha }));
  const r = run(['--harness', 'Beta', '--now', '2026-07-08T12:00:00Z'], { ledger });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /no ledger entry/);
});

test('clock before last_cycle_start fails closed', () => {
  const r = run(['--harness', 'Beta', '--now', '2026-07-04T00:00:00Z']);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /clock .* is before last_cycle_start/);
});

test('spec without exactly one period binding fails closed', () => {
  const none = writeFixture('spec', specText({ periodLine: '- no binding here' }));
  let r = run(['--harness', 'Alpha', '--now', '2026-07-08T12:00:00Z'], { spec: none });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /expected exactly one/);
  const two = writeFixture(
    'spec',
    specText() + '\nstray duplicate `cadence-period-days: 3`\n'
  );
  r = run(['--harness', 'Alpha', '--now', '2026-07-08T12:00:00Z'], { spec: two });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /found 2/);
});

test('unknown --harness is a usage error (exit 1)', () => {
  const r = run(['--harness', 'NoSuch', '--now', '2026-07-08T12:00:00Z']);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /no bound harness named/);
});

test('live spec + live ledger: every bound harness has a well-formed entry', () => {
  // Fixed --now far in the future: asserts shape (exit 0 for all), not policy.
  for (const h of ['OpenCode', 'Claude Code', 'Pi', 'Codex', 'Cline']) {
    const r = run(['--harness', h, '--now', '2027-01-01T00:00:00Z'], {
      spec: realSpec,
      ledger: realLedger,
    });
    assert.equal(r.status, 0, `${h}: ${r.stderr}`);
  }
});
