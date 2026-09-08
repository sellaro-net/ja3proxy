import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const packageDirectory = process.env.SDK_SOURCE_DIRECTORY
  ? resolve(process.env.SDK_SOURCE_DIRECTORY, 'packages/typescript')
  : resolve(dirname(fileURLToPath(import.meta.url)), '..');
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

export function npmCliPath() {
  const candidates = [
    process.env.SDK_NPM_CLI,
    process.env.npm_execpath?.endsWith('npm-cli.js') ? process.env.npm_execpath : undefined,
    join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'),
    resolve(dirname(process.execPath), '../lib/node_modules/npm/bin/npm-cli.js'),
  ];
  const cli = candidates.find(candidate => candidate && existsSync(candidate));
  assert.ok(cli, 'npm-cli.js was not found; set SDK_NPM_CLI to the installed npm CLI path.');
  return cli;
}

export function npm(args, options = {}) {
  return runNode(npmCliPath(), args, options);
}

export function assertPackagePolicy(value, release = false) {
  assert.equal(value.name, '@sellaro/ja3proxy');
  assert.equal(value.version, manifest.version);
  assert.equal(value.license, 'MIT', 'Only the MIT-licensed SDK may be published.');
  assert.equal(value.private, !release, 'Only the isolated release copy may be public.');
  assert.equal(value.engines.node, '>=22.14.0');
  for (const field of ['dependencies', 'optionalDependencies', 'peerDependencies', 'bundledDependencies']) {
    assert.equal(Object.keys(value[field] ?? {}).length, 0, `Unexpected runtime ${field}`);
  }
  for (const name of ['preinstall', 'install', 'postinstall', 'prepare', 'prepublish', 'prepublishOnly']) {
    assert.equal(value.scripts?.[name], undefined, `Lifecycle hook ${name} is forbidden.`);
  }
  assert.deepEqual(Object.keys(value.exports), ['.', './sync']);
}

export function assertReleaseContext() {
  assert.equal(process.env.GITHUB_ACTIONS, 'true', 'Release copies require the protected GitHub workflow.');
  assert.equal(process.env.GITHUB_REPOSITORY, 'sellaro-net/ja3proxy');
  assert.equal(process.env.GITHUB_REF, 'refs/heads/main');
  assert.equal(process.env.GITHUB_WORKFLOW_REF, 'sellaro-net/ja3proxy/.github/workflows/sdk-publish.yml@refs/heads/main');
  assert.match(process.env.SDK_RELEASE_SHA ?? '', /^[a-f0-9]{40}$/);
  assert.equal(process.env.SDK_RELEASE_VERSION, manifest.version);
  assertPackagePolicy(manifest);
  assert.equal(process.env.NODE_AUTH_TOKEN || process.env.NPM_TOKEN, undefined, 'Registry tokens are forbidden.');
}
