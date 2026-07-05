// Tests for the path-selection dispatcher. Run: node --test scripts/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const script = join(here, 'dispatch-escalation.mjs');
const repoRoot = join(here, '..');
const fpSpec = join(repoRoot, 'docs/agent-specs/forward-port-spec.md');

function run(args, env = {}) {
  try {
    const stdout = execFileSync('node', [script, ...args], {
      encoding: 'utf8',
      env: { ...process.env, ...env },
    });
    return { status: 0, stdout, stderr: '' };
  } catch (e) {
    return { status: e.status, stdout: e.stdout ?? '', stderr: e.stderr ?? '' };
  }
}

// The live registry codes, read independently of the dispatcher's parser.
function liveCodes() {
  const text = readFileSync(fpSpec, 'utf8');
  const sec = text.slice(text.indexOf('## 1.17'), text.indexOf('## 1.18'));
  return [...sec.matchAll(/^\| `([a-z0-9-]+)` \|/gm)].map((m) => m[1]);
}

test('every live §1.17 code routes, structural vs routine split is exact', () => {
  const codes = liveCodes();
  assert.ok(codes.length >= 20, `expected ≥20 codes, parsed ${codes.length}`);
  for (const code of codes) {
    const r = run([code, '--json']);
    assert.equal(r.status, 0, `${code} failed: ${r.stderr}`);
    const d = JSON.parse(r.stdout);
    assert.equal(d.code, code);
    if (code.startsWith('structural-')) {
      assert.equal(d.route, 'level-2-re-derivation');
      assert.ok(d.entryStage.includes('Stage'), `${code} missing entry stage`);
      assert.ok(d.demotionSet.length > 0, `${code} missing demotion set`);
    } else {
      assert.equal(d.route, 'routine-resume');
      assert.ok(d.resumesBy.length > 0, `${code} missing resumption route`);
      assert.equal(d.entryStage, undefined);
    }
  }
});

test('unknown code fails closed with exit 2', () => {
  const r = run(['structural-not-a-real-code']);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /unknown reason code/);
});

test('report mode: exactly one emission line routes', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dispatch-'));
  const report = join(dir, 'report.md');
  writeFileSync(
    report,
    '# Final report\n\nGate 11 could not pass.\n\nEscalation-Reason-Code: `input-credentials-missing`\n'
  );
  const r = run(['--report', report, '--json']);
  assert.equal(r.status, 0, r.stderr);
  const d = JSON.parse(r.stdout);
  assert.equal(d.code, 'input-credentials-missing');
  assert.equal(d.route, 'routine-resume');
});

test('report mode: repeated identical code is still exactly one', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dispatch-'));
  const report = join(dir, 'report.md');
  writeFileSync(
    report,
    'escalation-reason-code: env-toolchain-missing\n...\nescalation-reason-code: env-toolchain-missing\n'
  );
  const r = run(['--report', report, '--json']);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(JSON.parse(r.stdout).code, 'env-toolchain-missing');
});

test('report mode: zero emission lines fails closed', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dispatch-'));
  const report = join(dir, 'report.md');
  writeFileSync(report, 'A STOP happened but no code was recorded.\n');
  const r = run(['--report', report]);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /no emission line/);
});

test('report mode: two distinct codes fails closed', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dispatch-'));
  const report = join(dir, 'report.md');
  writeFileSync(
    report,
    'escalation-reason-code: input-target-missing\nescalation-reason-code: env-workspace-dirty\n'
  );
  const r = run(['--report', report]);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /2 distinct reason codes/);
});

test('report mode: mid-line prose mention is not an emission', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dispatch-'));
  const report = join(dir, 'report.md');
  writeFileSync(
    report,
    'This run did NOT set an escalation-reason-code: input-target-missing was merely discussed.\n'
  );
  const r = run(['--report', report]);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /no emission line/);
});

test('report mode: key and code on separate lines is not an emission', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dispatch-'));
  const report = join(dir, 'report.md');
  writeFileSync(report, 'escalation-reason-code:\ninput-target-missing\n');
  const r = run(['--report', report]);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /no emission line/);
});

test('report mode: key is case-insensitive, uppercase code fails closed', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dispatch-'));
  const okReport = join(dir, 'ok.md');
  writeFileSync(okReport, 'ESCALATION-REASON-CODE: env-workspace-dirty\n');
  const ok = run(['--report', okReport, '--json']);
  assert.equal(ok.status, 0, ok.stderr);
  assert.equal(JSON.parse(ok.stdout).code, 'env-workspace-dirty');

  const badReport = join(dir, 'bad.md');
  writeFileSync(badReport, 'escalation-reason-code: ENV-WORKSPACE-DIRTY\n');
  const bad = run(['--report', badReport]);
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /non-lowercase code/);
});

test('a malformed §1.17 row (stray pipe) fails closed instead of dropping the code', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dispatch-'));
  const forged = join(dir, 'forward-port-spec.md');
  const text = readFileSync(fpSpec, 'utf8');
  writeFileSync(
    forged,
    text.replace(
      '| `env-toolchain-missing` | A §1.12 toolchain presence check fails |',
      '| `env-toolchain-missing` | A §1.12 | toolchain presence check fails |'
    )
  );
  const r = run(['input-target-missing'], { FORWARD_PORT_SPEC: forged });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /do not parse as 4 cells/);
});

test('invalidation-scope drift between §1.17 and §2.2 fails closed', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dispatch-'));
  const forged = join(dir, 'forward-port-spec.md');
  const text = readFileSync(fpSpec, 'utf8');
  writeFileSync(
    forged,
    text.replace(
      '| `structural-protocol-a-regression` | Protocol A (the e2e spec\'s secret-prune oracle) fails on a clean build after all prior validation gates passed (§1.13 gate 11, §2.9 step 2, §3.6) | Level-2 seam assumptions |',
      '| `structural-protocol-a-regression` | Protocol A (the e2e spec\'s secret-prune oracle) fails on a clean build after all prior validation gates passed (§1.13 gate 11, §2.9 step 2, §3.6) | Level-2 bindings |'
    )
  );
  const r = run(['env-toolchain-missing'], { FORWARD_PORT_SPEC: forged });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /invalidation-scope drift/);
});

test('cross-check: a structural code missing from §2.2 fails closed', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dispatch-'));
  const forged = join(dir, 'forward-port-spec.md');
  const text = readFileSync(fpSpec, 'utf8');
  writeFileSync(
    forged,
    text.replace(
      /^## 1.18/m,
      '| `structural-brand-new-break` | condition (§0) | Level-2 bindings | Owner tier |\n\n## 1.18'
    )
  );
  const r = run(['env-toolchain-missing'], { FORWARD_PORT_SPEC: forged });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /structural-code mismatch/);
  assert.match(r.stderr, /structural-brand-new-break/);
});

test('unreadable spec fails closed, not open', () => {
  const r = run(['env-toolchain-missing'], {
    FORWARD_PORT_SPEC: '/nonexistent/spec.md',
  });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /cannot read forward-port spec/);
});

test('usage errors exit 1', () => {
  assert.equal(run([]).status, 1);
  assert.equal(run(['--report']).status, 1);
  assert.equal(run(['a', 'b']).status, 1);
});
