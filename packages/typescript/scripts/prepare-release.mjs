import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repositoryDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const repositoryUrl = 'https://github.com/sellaro-net/ja3proxy';
const manifestPath = 'packages/typescript/package.json';
const changelogPath = 'packages/typescript/CHANGELOG.md';
const stableVersion = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
// Include the SDK and the service's public wire/session semantics, not unrelated
// Rust transport internals, deployment changes, or release bookkeeping.
const sourcePaths = [
  'packages/typescript', 'contracts', 'README.md',
  'src/contracts.rs', 'src/models.rs', 'src/protocol.rs', 'src/error.rs',
  'src/handlers.rs', 'src/validation.rs', 'src/contexts.rs', 'src/contexts',
  'src/auth.rs',
  ':(exclude)packages/typescript/CHANGELOG.md',
  ':(exclude)packages/typescript/scripts/*release*.mjs',
  ':(exclude)packages/typescript/test/release.test.mjs',
];

function git(root, args) {
  return execFileSync('git', args, {
    cwd: root, encoding: 'utf8', timeout: 30_000,
    stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 16 * 1024 * 1024,
  });
}

export function bumpVersion(version, bump) {
  assert.equal(typeof version, 'string', 'The source version must be a string.');
  assert.match(version, stableVersion, 'Only canonical stable major.minor.patch versions may be released.');
  const index = ['major', 'minor', 'patch'].indexOf(bump);
  assert.notEqual(index, -1, 'Choose exactly patch, minor, or major.');
  const parts = version.split('.').map(Number);
  assert.ok(parts.every(Number.isSafeInteger), 'Version components exceed the exact integer range.');
  assert.ok(parts[index] < Number.MAX_SAFE_INTEGER, 'The selected version component cannot be incremented safely.');
  parts[index] += 1;
  for (let i = index + 1; i < parts.length; i += 1) parts[i] = 0;
  return parts.join('.');
}

function escapeMarkdown(text) {
  return text.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/[\\`*_{}\[\]()<>!#|]/g, '\\$&');
}

// Purely local: read immutable Git inputs, return deterministic proposed files.
// Registry checks, branch ownership, and PR creation belong to sdk-prepare.yml.
export function planRelease({ bump, expectedVersion, sourceSha, root = repositoryDirectory }) {
  assert.match(sourceSha ?? '', /^[a-f0-9]{40}$/, 'An exact source commit is required.');
  assert.equal(git(root, ['rev-parse', '--verify', `${sourceSha}^{commit}`]).trim(), sourceSha);
  const manifestText = git(root, ['show', `${sourceSha}:${manifestPath}`]);
  const manifest = JSON.parse(manifestText);
  assert.equal(manifest.name, '@sellaro/ja3proxy');
  assert.equal(manifest.private, true, 'The source package must remain private.');
  assert.equal(manifest.license, 'MIT');
  assert.equal(manifest.version, expectedVersion, 'The exact source version changed; restart preparation.');
  const version = bumpVersion(manifest.version, bump);
  const previousTag = `sdk-v${manifest.version}`;
  const previousSha = git(root, ['rev-parse', '--verify', `refs/tags/${previousTag}^{commit}`]).trim();
  git(root, ['merge-base', '--is-ancestor', previousSha, sourceSha]);
  const previousManifest = JSON.parse(git(root, ['show', `${previousSha}:${manifestPath}`]));
  assert.equal(previousManifest.name, manifest.name, 'The SDK tag must identify this package.');
  assert.equal(previousManifest.version, manifest.version, 'The SDK tag must identify the exact current version.');
  const result = {
    status: 'unchanged', previousVersion: manifest.version, version, sourceSha,
    previousTag, branch: `release/sdk-${version}`, files: [],
  };
  const changed = git(root, ['diff', '--name-only', previousSha, sourceSha, '--', ...sourcePaths]).trim();
  if (!changed) return result;
  // First-parent subjects describe merged changes once, rather than listing all
  // feature-branch commits or the repository's unrelated Rust release history.
  const history = git(root, [
    'log', '--first-parent', '--format=%H%x00%s%x00', `${previousSha}..${sourceSha}`,
    '--', ...sourcePaths,
  ]).trim().split('\0');
  const entries = [];
  for (let i = 0; i + 1 < history.length; i += 2) {
    const sha = history[i].trim();
    assert.match(sha, /^[a-f0-9]{40}$/);
    entries.push(`- ${escapeMarkdown(history[i + 1])} ([${sha.slice(0, 7)}](${repositoryUrl}/commit/${sha}))`);
  }
  assert.ok(entries.length, 'Changed SDK source must have scoped changelog commits.');
  const comparison = `${repositoryUrl}/compare/${previousTag}...sdk-v${version}`;
  const sourceComparison = `${repositoryUrl}/compare/${previousTag}...${sourceSha}`;
  const notes = `## [${version}](${comparison})\n\n${entries.join('\n')}\n\n[Reviewed source changes](${sourceComparison})\n`;
  const changelogText = git(root, ['show', `${sourceSha}:${changelogPath}`]);
  assert.ok(changelogText.startsWith('# Changelog\n'), 'Expected the SDK changelog heading.');
  assert.ok(changelogText.includes(`## [${manifest.version}](`), 'The current released version must exist in the changelog.');
  assert.ok(!changelogText.includes(`## [${version}](`), 'The requested release is already recorded; do not prepare it twice.');
  const firstRelease = changelogText.indexOf('\n## [');
  assert.notEqual(firstRelease, -1, 'The changelog must contain the initial SDK release.');
  const nextManifest = manifestText.replace(/^(\s*"version"\s*:\s*)"[^"]*"/m, (_, prefix) => `${prefix}"${version}"`);
  assert.deepEqual(JSON.parse(nextManifest), { ...manifest, version }, 'Only the source version may change.');
  return {
    ...result, status: 'ready', notes, sourceComparison,
    files: [
      { path: manifestPath, content: nextManifest },
      { path: changelogPath, content: `${changelogText.slice(0, firstRelease)}\n${notes}${changelogText.slice(firstRelease)}` },
    ],
  };
}

export function writeRelease(plan, { root = repositoryDirectory } = {}) {
  if (plan.status === 'unchanged') return;
  assert.equal(git(root, ['rev-parse', 'HEAD']).trim(), plan.sourceSha, 'Local writes require the exact planned checkout.');
  assert.equal(git(root, ['status', '--porcelain', '--untracked-files=normal']).trim(), '', 'Local writes require a clean checkout.');
  for (const file of plan.files) {
    assert.equal(readFileSync(resolve(root, file.path), 'utf8'), git(root, ['show', `${plan.sourceSha}:${file.path}`]),
      `The source file changed before preparation: ${file.path}`);
  }
  for (const file of plan.files) writeFileSync(resolve(root, file.path), file.content);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  assert.ok(process.argv.slice(2).every(argument => argument === '--write'), 'The only option is --write; inputs use SDK_RELEASE_* environment variables.');
  const plan = planRelease({
    bump: process.env.SDK_RELEASE_BUMP,
    expectedVersion: process.env.SDK_RELEASE_EXPECTED_VERSION,
    sourceSha: process.env.SDK_RELEASE_SOURCE_SHA,
  });
  if (process.argv.includes('--write')) writeRelease(plan);
  console.log(JSON.stringify(plan, null, 2));
}
