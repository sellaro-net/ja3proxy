import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const packageDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const require = createRequire(join(packageDirectory, 'package.json'));
export const manifest = JSON.parse(readFileSync(join(packageDirectory, 'package.json'), 'utf8'));
export const artifactDirectory = join(packageDirectory, 'artifacts');
export const artifactPath = join(artifactDirectory, `sellaro-ja3proxy-${manifest.version}.tgz`);

// Invoke JS CLIs through Node rather than shell-dependent .cmd wrappers on Windows.
export function runNode(script, args = [], options = {}) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: packageDirectory, stdio: 'inherit', timeout: 180_000, ...options,
  });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `${script} exited with ${result.status ?? result.signal}`);
  return result;
}

export function npm(args, options = {}) {
  const candidates = [
    process.env.SDK_NPM_CLI,
    process.env.npm_execpath?.endsWith('npm-cli.js') ? process.env.npm_execpath : undefined,
    join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'),
    resolve(dirname(process.execPath), '../lib/node_modules/npm/bin/npm-cli.js'),
  ];
  const cli = candidates.find(candidate => candidate && existsSync(candidate));
  assert.ok(cli, 'npm-cli.js was not found; set SDK_NPM_CLI to the installed npm CLI path.');
  return runNode(cli, args, options);
}

export function assertPackagePolicy(value, release = false) {
  assert.equal(value.name, '@sellaro/ja3proxy');
  assert.equal(value.version, manifest.version);
  assert.equal(value.license, manifest.license, 'The artifact must preserve the source license.');
  assert.equal(value.private, !release, 'Publication is blocked except in an approved staging copy.');
  assert.equal(value.engines.node, '>=22.14.0');
  for (const field of ['dependencies', 'optionalDependencies', 'peerDependencies', 'bundledDependencies']) {
    assert.equal(Object.keys(value[field] ?? {}).length, 0, `Unexpected runtime ${field}`);
  }
  for (const name of ['preinstall', 'install', 'postinstall', 'prepare', 'prepublish', 'prepublishOnly']) {
    assert.equal(value.scripts?.[name], undefined, `Lifecycle hook ${name} is forbidden.`);
  }
  assert.deepEqual(Object.keys(value.exports), ['.', './sync']);
}

export function assertReleaseApproval() {
  assert.equal(process.env.GITHUB_ACTIONS, 'true', 'Staging copies may only be prepared in the approved workflow.');
  assert.equal(process.env.GITHUB_REPOSITORY, 'sellaro-net/ja3proxy');
  assert.equal(process.env.GITHUB_REF, 'refs/heads/main');
  assert.equal(process.env.SDK_NPM_BOOTSTRAPPED, 'true', 'The owner must bootstrap the real package and configure a stage-only trusted publisher first.');
  assert.ok(typeof manifest.license === 'string' && manifest.license.trim() && manifest.license !== 'UNLICENSED', 'Staging remains blocked until the owner explicitly licenses the source package.');
  assert.equal(process.env.SDK_RELEASE_APPROVED_LICENSE, manifest.license, 'The owner-approved license must exactly match the source and packed artifact.');
  assert.equal(process.env.SDK_RELEASE_APPROVED_VERSION, manifest.version);
  assert.match(process.env.GITHUB_SHA ?? '', /^[a-f0-9]{40}$/);
  assert.equal(process.env.SDK_RELEASE_APPROVED_SHA, process.env.GITHUB_SHA);
  assert.equal(process.env.NODE_AUTH_TOKEN || process.env.NPM_TOKEN, undefined, 'Long-lived registry tokens are forbidden.');
}

// The first real package cannot have an npm trusted publisher before it exists.
// This explicit owner bootstrap uses an interactive npm login, never fake CI
// variables or a long-lived publish token. Subsequent releases stay on OIDC.
export async function assertBootstrapApproval() {
  assert.notEqual(process.env.GITHUB_ACTIONS, 'true', 'Bootstrap requires the owner’s local interactive npm login.');
  assert.notEqual(process.env.SDK_NPM_BOOTSTRAPPED, 'true', 'An existing package must use the protected OIDC workflow.');
  assert.equal(process.env.NODE_AUTH_TOKEN || process.env.NPM_TOKEN, undefined, 'Registry tokens in the environment are forbidden.');
  assert.ok(manifest.license && manifest.license !== 'UNLICENSED', 'The owner must explicitly license the source package.');
  assert.equal(process.env.SDK_RELEASE_APPROVED_LICENSE, manifest.license);
  assert.equal(process.env.SDK_RELEASE_APPROVED_VERSION, manifest.version);
  const approvedSha = process.env.SDK_RELEASE_APPROVED_SHA;
  assert.match(approvedSha ?? '', /^[a-f0-9]{40}$/);
  const git = args => {
    const result = spawnSync('git', args, { cwd: packageDirectory, encoding: 'utf8', timeout: 30_000, stdio: ['ignore', 'pipe', 'pipe'] });
    if (result.error) throw result.error;
    assert.equal(result.status, 0, 'Unable to verify the reviewed Git source.');
    return result.stdout.trim();
  };
  assert.equal(git(['rev-parse', 'HEAD']), approvedSha, 'Bootstrap must use the explicitly approved commit.');
  assert.equal(git(['status', '--porcelain', '--untracked-files=normal']), '', 'Bootstrap requires a clean source checkout.');
  const main = git(['ls-remote', '--exit-code', 'https://github.com/sellaro-net/ja3proxy.git', 'refs/heads/main']).split(/\s+/)[0];
  assert.equal(main, approvedSha, 'Bootstrap must use the integrated main commit.');
  const identity = JSON.parse(npm(['whoami', '--json', '--registry=https://registry.npmjs.org'], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  }).stdout);
  assert.ok(process.env.SDK_BOOTSTRAP_NPM_USER, 'An explicitly approved npm account is required.');
  assert.equal(identity, process.env.SDK_BOOTSTRAP_NPM_USER, 'The active npm login is not the approved publisher.');
  const existing = await fetch('https://registry.npmjs.org/@sellaro%2Fja3proxy', { signal: AbortSignal.timeout(15_000), redirect: 'error' });
  await existing.body?.cancel();
  assert.equal(existing.status, 404, 'Bootstrap is only allowed before the first real package publication.');
}
