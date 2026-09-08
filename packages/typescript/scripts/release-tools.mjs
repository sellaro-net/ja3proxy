import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFile, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { npmCliPath } from './package-tools.mjs';

export const repository = 'sellaro-net/ja3proxy';
export const packageName = '@sellaro/ja3proxy';
export const manifestFile = 'packages/typescript/package.json';
export const workflowPath = '.github/workflows/sdk-publish.yml';
export const stableVersion = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
export const releaseDirectory = resolve(process.env.SDK_ARTIFACT_DIRECTORY ?? 'packages/typescript/artifacts');
// The already-public, owner-published release predates OIDC. This immutable trust
// anchor permits verification/recovery, never another unsigned publication.
export const initialPublication = Object.freeze({
  version: '1.0.0',
  source: '34c39e02a879255943e931b5cca30107aa36316f',
  integrity: 'sha512-vYpA+28yc8FTREMxrXb+HvAXD4qNAn2nvBHePCSchTFOrlv4OsJ0PKlCqT/4cg4vW6RoJkNYTDcq6PdWn0zI0A==',
});

export function assertWorkflow() {
  assert.equal(process.env.GITHUB_ACTIONS, 'true');
  assert.equal(process.env.GITHUB_REPOSITORY, repository);
  assert.equal(process.env.GITHUB_REF, 'refs/heads/main');
  assert.equal(process.env.GITHUB_WORKFLOW_REF, `${repository}/${workflowPath}@refs/heads/main`);
  assert.equal(process.env.RUNNER_ENVIRONMENT, 'github-hosted');
  assert.equal(process.env.NODE_AUTH_TOKEN || process.env.NPM_TOKEN, undefined, 'Registry tokens are forbidden.');
}

export function git(args, cwd = process.cwd()) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', timeout: 30_000, maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `git ${args[0]} failed: ${result.stderr}`);
  return result.stdout.trim();
}

export function sourceManifest(runGit, sha) {
  assert.match(sha, /^[a-f0-9]{40}$/);
  return JSON.parse(runGit(['show', `${sha}:${manifestFile}`]));
}

export function resolveIdentity(runGit, eventSha, requestedVersion) {
  const current = sourceManifest(runGit, eventSha);
  const version = requestedVersion || current.version;
  assert.match(version, stableVersion, 'A stable source version is required.');
  const tag = `sdk-v${version}`;
  const tagged = runGit(['tag', '--list', tag]) === tag;
  let source;
  if (tagged) {
    source = runGit(['rev-parse', `${tag}^{commit}`]);
    runGit(['merge-base', '--is-ancestor', source, eventSha]);
  } else {
    // First-parent history records the main merge, not the pre-approval PR tip.
    // Walk manifest changes rather than every commit; stop at the transition.
    const commits = runGit(['log', '--first-parent', '--format=%H', eventSha, '--', manifestFile]).split('\n').filter(Boolean);
    for (const sha of commits) {
      const value = sourceManifest(runGit, sha);
      if (value.version === version) source = sha;
      else if (source) break;
    }
    assert.ok(source, `Version ${version} was never introduced on main.`);
  }
  const value = sourceManifest(runGit, source);
  assert.equal(value.name, packageName);
  assert.equal(value.version, version);
  assert.equal(value.private, true, 'Source must remain private.');
  assert.equal(value.license, 'MIT');
  return { version, tag, source, tagged, filename: `sellaro-ja3proxy-${version}.tgz` };
}

export async function request(url, { method = 'GET', body, headers = {}, statuses = [200], github = false, notFoundRetries = 0 } = {}) {
  if (github) assert.ok(process.env.GITHUB_TOKEN, 'An ephemeral GitHub token is required.');
  assert.ok(Number.isSafeInteger(notFoundRetries) && notFoundRetries >= 0 && notFoundRetries <= 30);
  if (notFoundRetries) assert.equal(method, 'GET', 'Only publication visibility reads may be retried.');
  const requestHeaders = {
    accept: 'application/json',
    ...(github ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}`, 'x-github-api-version': '2022-11-28' } : {}),
    ...headers,
  };
  for (let attempt = 0; ; attempt += 1) {
    const response = await fetch(url, {
      method, body, headers: requestHeaders, redirect: 'manual', signal: AbortSignal.timeout(30_000),
    });
    if (response.status === 404 && attempt < notFoundRetries) {
      await response.body?.cancel();
      await delay(2_000);
      continue;
    }
    assert.ok(statuses.includes(response.status), `${method} ${url}: unexpected HTTP ${response.status}`);
    return response;
  }
}

export async function github(path, options = {}) {
  const response = await request(`https://api.github.com/repos/${repository}/${path}`, {
    ...options, github: true,
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body), headers: { 'content-type': 'application/json', ...options.headers } }),
  });
  if (response.status === 404 || response.status === 204) {
    await response.body?.cancel();
    return null;
  }
  return response.json();
}

export async function assertProtection() {
  const branch = await github('branches/main');
  assert.equal(branch.protected, true, 'Main must be protected.');
  const environment = await github('environments/npm-production');
  assert.deepEqual(environment.deployment_branch_policy, { protected_branches: false, custom_branch_policies: true });
  assert.ok(!(environment.protection_rules ?? []).some(rule => rule.type === 'required_reviewers' || rule.type === 'wait_timer'), 'The version PR merge is the only release approval.');
  const policies = await github('environments/npm-production/deployment-branch-policies?per_page=100');
  assert.equal(policies.total_count, 1, 'Only main may deploy to npm-production.');
  assert.equal(policies.branch_policies?.[0]?.name, 'main');
  assert.equal(policies.branch_policies?.[0]?.type, 'branch');
}

export async function registryManifest(version, { notFoundRetries = 0 } = {}) {
  assert.match(version, stableVersion);
  const response = await request(`https://registry.npmjs.org/@sellaro%2fja3proxy/${version}`, { statuses: [200, 404], notFoundRetries });
  if (response.status === 404) {
    await response.body?.cancel();
    return null;
  }
  const value = await response.json();
  assert.equal(value.name, packageName);
  assert.equal(value.version, version);
  assert.equal(value.license, 'MIT');
  assert.match(value.dist?.integrity ?? '', /^sha512-[A-Za-z0-9+/]{86}==$/);
  return value;
}

export function assertProvenance(statement, identity, integrity) {
  assert.equal(statement._type, 'https://in-toto.io/Statement/v1');
  assert.equal(statement.predicateType, 'https://slsa.dev/provenance/v1');
  assert.deepEqual(statement.subject, [{ name: `pkg:npm/%40sellaro/ja3proxy@${identity.version}`, digest: { sha512: Buffer.from(integrity.slice(7), 'base64').toString('hex') } }]);
  const build = statement.predicate?.buildDefinition;
  assert.equal(build?.buildType, 'https://slsa-framework.github.io/github-actions-buildtypes/workflow/v1');
  assert.deepEqual(build.externalParameters?.workflow, { ref: 'refs/heads/main', repository: `https://github.com/${repository}`, path: workflowPath });
  assert.deepEqual(build.resolvedDependencies, [{ uri: `git+https://github.com/${repository}@refs/heads/main`, digest: { gitCommit: identity.source } }]);
  assert.equal(statement.predicate.runDetails?.builder?.id, 'https://github.com/actions/runner/github-hosted');
}

export async function verifyRegistry(value, identity, expectedIntegrity, { notFoundRetries = 0 } = {}) {
  const integrity = value.dist.integrity;
  if (expectedIntegrity) assert.equal(integrity, expectedIntegrity, 'npm contains different bytes; versions must never be overwritten.');
  if (identity.version === initialPublication.version) {
    assert.equal(identity.source, initialPublication.source);
    assert.equal(identity.tagged, true, 'The initial publication must retain its existing SDK tag.');
    assert.equal(integrity, initialPublication.integrity);
    return;
  }
  const url = new URL(value.dist.attestations?.url ?? 'https://invalid.invalid');
  assert.equal(url.origin, 'https://registry.npmjs.org', 'npm provenance is required for recovery.');
  assert.equal(url.username + url.password + url.hash, '');
  const response = await request(url, { notFoundRetries });
  const document = await response.json();
  const provenance = document.attestations?.filter(item => item.predicateType === 'https://slsa.dev/provenance/v1');
  assert.equal(provenance?.length, 1, 'Exactly one npm provenance attestation is required.');
  const bundle = provenance[0].bundle;
  const { verify } = createRequire(npmCliPath())('sigstore');
  await verify(bundle, {
    certificateIssuer: 'https://token.actions.githubusercontent.com',
    certificateIdentityURI: `https://github.com/${repository}/${workflowPath}@refs/heads/main`,
    timeout: 15_000, retry: 0,
  });
  const statement = JSON.parse(Buffer.from(bundle.dsseEnvelope.payload, 'base64').toString('utf8'));
  assertProvenance(statement, identity, integrity);
}

export function digests(bytes) {
  return {
    sha256: createHash('sha256').update(bytes).digest('hex'),
    integrity: `sha512-${createHash('sha512').update(bytes).digest('base64')}`,
  };
}

export async function downloadRegistry(value, identity) {
  const url = new URL(value.dist.tarball);
  assert.equal(url.href, `https://registry.npmjs.org/@sellaro/ja3proxy/-/ja3proxy-${identity.version}.tgz`);
  const response = await request(url);
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.equal(digests(bytes).integrity, value.dist.integrity, 'Registry tarball integrity mismatch.');
  await writeFile(join(releaseDirectory, identity.filename), bytes);
  return digests(bytes);
}

export async function outputs(values) {
  assert.ok(process.env.GITHUB_OUTPUT);
  await appendFile(process.env.GITHUB_OUTPUT, Object.entries(values).map(([key, value]) => `${key}=${value}\n`).join(''));
}

export async function readArtifact() {
  const identity = JSON.parse(await readFile(join(releaseDirectory, 'release.json'), 'utf8'));
  assert.match(identity.version, stableVersion);
  assert.match(identity.source, /^[a-f0-9]{40}$/);
  assert.equal(identity.tag, `sdk-v${identity.version}`);
  assert.equal(identity.filename, `sellaro-ja3proxy-${identity.version}.tgz`);
  assert.equal(identity.source, process.env.SDK_RELEASE_SHA);
  assert.equal(identity.version, process.env.SDK_RELEASE_VERSION);
  const bytes = await readFile(join(releaseDirectory, identity.filename));
  const actual = digests(bytes);
  assert.equal(actual.sha256, process.env.SDK_ARTIFACT_SHA256, 'Artifact differs from the exact validated tarball.');
  assert.equal(identity.sha256, actual.sha256);
  assert.equal(identity.integrity, actual.integrity);
  assert.equal(await readFile(join(releaseDirectory, `${identity.filename}.sha256`), 'utf8'), `${actual.sha256}  ${identity.filename}\n`);
  return { identity, bytes };
}
