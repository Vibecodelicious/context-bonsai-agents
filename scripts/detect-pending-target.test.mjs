// Tests for the release detector. Run: node --test scripts/
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  readFileSync,
  writeFileSync,
  mkdtempSync,
  mkdirSync,
  chmodSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const script = join(here, 'detect-pending-target.mjs');
const realSpec = join(here, '..', 'docs/agent-specs/forward-port-spec.md');

// --- fixture world -----------------------------------------------------
// A temp root holding: a synthetic spec, a git "upstream" with tags, a
// checkout with an `upstream` remote and local port tags, a docs dir with
// analysis files, and a stub `npm` prepended to PATH.

let root, binDir, npmVersionFile;

function sh(cwd, cmd, args) {
  execFileSync(cmd, args, { cwd, stdio: 'ignore' });
}

function gitInit(dir) {
  mkdirSync(dir, { recursive: true });
  sh(dir, 'git', ['init', '-q']);
  sh(dir, 'git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'seed']);
}

function specText({ releaseLineGit, releaseLineNpm, npmIdentity }) {
  return `# Spec fixture

# Part 4: Per-Harness Bindings

## 4.1 Slot schema

| Slot | Meaning |
|---|---|
| Release detection | machine-readable sources |

## 4.2 ForkHarness (shape: git-fork)

- **Upstream identity**: upstream release tags.
${releaseLineGit}

## 4.3 NpmHarness (shape: closed npm artifact)

- **Upstream identity**: npm package \`${npmIdentity}\`, frozen per §3.1.
${releaseLineNpm}

## 4.4 Unbound harnesses

No Release detection here; not a bound section.
`;
}

const DEFAULT_GIT_LINE =
  '- **Release detection**: ported-version evidence `git-tag fork bonsai/on-fork-`; upstream query `git-remote-tag fork upstream v`.';
const DEFAULT_NPM_LINE =
  '- **Release detection**: ported-version evidence `doc-file sidedocs analysis-`; upstream query `npm @scope/pkg`.';

function writeSpec(overrides = {}) {
  const path = join(root, `spec-${Math.random().toString(36).slice(2)}.md`);
  writeFileSync(
    path,
    specText({
      releaseLineGit: overrides.releaseLineGit ?? DEFAULT_GIT_LINE,
      releaseLineNpm: overrides.releaseLineNpm ?? DEFAULT_NPM_LINE,
      npmIdentity: overrides.npmIdentity ?? '@scope/pkg',
    })
  );
  return path;
}

function run(args, { spec, npmVersion } = {}) {
  if (npmVersion !== undefined) writeFileSync(npmVersionFile, npmVersion);
  const env = {
    ...process.env,
    PATH: `${binDir}:${process.env.PATH}`,
    FORWARD_PORT_SPEC: spec ?? writeSpec(),
    PENDING_TARGET_ROOT: root,
  };
  try {
    const stdout = execFileSync('node', [script, ...args], { encoding: 'utf8', env });
    return { status: 0, stdout, stderr: '' };
  } catch (e) {
    return { status: e.status, stdout: e.stdout ?? '', stderr: e.stderr ?? '' };
  }
}

before(() => {
  root = mkdtempSync(join(tmpdir(), 'detect-pending-'));

  // upstream repo with stable and prerelease tags
  const upstream = join(root, 'upstream-remote');
  gitInit(upstream);
  for (const t of ['v1.2.3', 'v1.3.0', 'v1.4.0-beta.1', 'vnext'])
    sh(upstream, 'git', ['tag', t]);

  // fork checkout: remote `upstream` -> the repo above; local port tags
  const fork = join(root, 'fork');
  gitInit(fork);
  sh(fork, 'git', ['remote', 'add', 'upstream', upstream]);
  sh(fork, 'git', ['tag', 'bonsai/on-fork-1.2.3']);

  // side-repo docs dir with per-cycle analysis files
  const docs = join(root, 'sidedocs');
  mkdirSync(docs);
  writeFileSync(join(docs, 'analysis-2.1.156.md'), 'x');
  writeFileSync(join(docs, 'analysis-2.1.200.md'), 'x');
  writeFileSync(join(docs, 'analysis-notes.md'), 'not a version file');

  // stub npm: prints the version stored in the fixture file
  binDir = join(root, 'bin');
  mkdirSync(binDir);
  npmVersionFile = join(root, 'npm-version.txt');
  writeFileSync(npmVersionFile, '2.1.200');
  const stub = join(binDir, 'npm');
  writeFileSync(stub, `#!/bin/sh\ncat "${npmVersionFile}"\n`);
  chmodSync(stub, 0o755);
});

// --- tests --------------------------------------------------------------

test('pending target detected: newer stable upstream tag, prereleases ignored', () => {
  const r = run(['--harness', 'ForkHarness', '--json']);
  assert.equal(r.status, 3, r.stderr);
  const [d] = JSON.parse(r.stdout);
  assert.deepEqual(d, {
    harness: 'ForkHarness',
    status: 'pending-target',
    ported: '1.2.3',
    upstream: '1.3.0', // not 1.4.0-beta.1, not vnext
  });
});

test('up to date: npm version equals highest analysis doc, exit 0', () => {
  const r = run(['--harness', 'NpmHarness', '--json'], { npmVersion: '2.1.200' });
  assert.equal(r.status, 0, r.stderr);
  const [d] = JSON.parse(r.stdout);
  assert.equal(d.status, 'up-to-date');
  assert.equal(d.ported, '2.1.200');
});

test('pending target via npm; combined run exits 3 and reports both harnesses', () => {
  const r = run(['--json'], { npmVersion: '2.2.0' });
  assert.equal(r.status, 3, r.stderr);
  const all = JSON.parse(r.stdout);
  assert.equal(all.length, 2);
  assert.equal(all.find((d) => d.harness === 'NpmHarness').status, 'pending-target');
  assert.equal(all.find((d) => d.harness === 'NpmHarness').upstream, '2.2.0');
});

test('ported ahead of upstream fails closed (exit 2)', () => {
  const r = run(['--harness', 'NpmHarness'], { npmVersion: '2.0.0' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /ported version ahead of upstream/);
});

test('prerelease npm version fails closed rather than comparing', () => {
  const r = run(['--harness', 'NpmHarness'], { npmVersion: '3.0.0-rc.1' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /non-stable version/);
});

test('bound section without a Release detection slot fails closed', () => {
  const spec = writeSpec({ releaseLineGit: '- (slot missing)' });
  const r = run(['--harness', 'ForkHarness'], { spec });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /no Release detection slot/);
});

test('npm package cross-check mismatch with Upstream identity fails closed', () => {
  const spec = writeSpec({ npmIdentity: '@scope/other-pkg' });
  const r = run(['--harness', 'NpmHarness'], { spec, npmVersion: '2.1.200' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /npm package mismatch/);
});

test('unknown directive kind fails closed', () => {
  const spec = writeSpec({
    releaseLineNpm:
      '- **Release detection**: ported-version evidence `magic sidedocs analysis-`; upstream query `npm @scope/pkg`.',
  });
  const r = run(['--harness', 'NpmHarness'], { spec });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /unknown ported-version evidence kind "magic"/);
});

test('wrong directive arity fails closed', () => {
  const spec = writeSpec({
    releaseLineGit:
      '- **Release detection**: ported-version evidence `git-tag fork`; upstream query `git-remote-tag fork upstream v`.',
  });
  const r = run(['--harness', 'ForkHarness'], { spec });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /needs 2 argument\(s\), got 1/);
});

test('no port tags matching the prefix fails closed', () => {
  const spec = writeSpec({
    releaseLineGit:
      '- **Release detection**: ported-version evidence `git-tag fork nosuch-prefix-`; upstream query `git-remote-tag fork upstream v`.',
  });
  const r = run(['--harness', 'ForkHarness'], { spec });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /no ported-version tags/);
});

test('non-version doc filenames are ignored when picking the ported version', () => {
  // analysis-notes.md exists in the fixture dir; highest version must still be 2.1.200
  const r = run(['--harness', 'NpmHarness', '--json'], { npmVersion: '2.1.200' });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(JSON.parse(r.stdout)[0].ported, '2.1.200');
});

test('unknown --harness is a usage error (exit 1)', () => {
  const r = run(['--harness', 'NoSuchHarness']);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /no bound harness named/);
});

test('--plan resolves both live-spec bindings without running any query', () => {
  // Uses the real spec; --plan must not touch npm or the network. An empty
  // PATH-stub dir is still prepended, but --plan never invokes npm/git.
  const r = run(['--plan', '--json'], { spec: realSpec });
  assert.equal(r.status, 0, r.stderr);
  const plan = JSON.parse(r.stdout);
  const names = plan.map((p) => p.harness).sort();
  assert.deepEqual(names, ['Claude Code', 'OpenCode']);
  const cc = plan.find((p) => p.harness === 'Claude Code');
  assert.match(cc.upstream, /^npm @anthropic-ai\/claude-code$/);
  assert.match(cc.ported, /^doc-file tweakcc_context_bonsai\/docs semantic-anchor-analysis-$/);
  const oc = plan.find((p) => p.harness === 'OpenCode');
  assert.match(oc.upstream, /^git-remote-tag opencode upstream v$/);
  assert.match(oc.ported, /^git-tag opencode bonsai\/v1-on-opencode-$/);
});

test('live spec: Claude Code ported evidence resolves against the real side repo', () => {
  // Verify the doc-file regex against the real docs dir directly (a full
  // resolution would also run the npm query, which needs the network).
  const docs = join(here, '..', 'tweakcc_context_bonsai/docs');
  const files = execFileSync('ls', [docs], { encoding: 'utf8' }).split('\n');
  const versions = files
    .map((f) => f.match(/^semantic-anchor-analysis-(\d+(?:\.\d+)*)\.md$/)?.[1])
    .filter(Boolean);
  assert.ok(versions.includes('2.1.200'), 'expected the 2.1.200 cycle analysis doc');
});
