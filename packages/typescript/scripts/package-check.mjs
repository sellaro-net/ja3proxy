import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { artifactDirectory, artifactPath, assertBootstrapApproval, assertPackagePolicy, assertReleaseApproval, manifest, npm, packageDirectory, require, runNode } from './package-tools.mjs';

const bootstrap = process.argv.includes('--bootstrap');
assert.ok(!bootstrap || !process.argv.includes('--release'), 'Choose bootstrap or OIDC release, not both.');
const release = bootstrap || process.argv.includes('--release');
assertPackagePolicy(manifest);
if (bootstrap) await assertBootstrapApproval();
else if (release) assertReleaseApproval();
await mkdir(artifactDirectory, { recursive: true });
const temporary = await mkdtemp(join(tmpdir(), 'ja3proxy-pack-'));
try {
  // Never flip private in the source checkout. No package scripts survive staging.
  const staged = { ...manifest, private: !release };
  delete staged.scripts;
  delete staged.devDependencies;
  await cp(join(packageDirectory, 'dist'), join(temporary, 'dist'), { recursive: true });
  await cp(join(packageDirectory, '../../README.md'), join(temporary, 'README.md'));
  await cp(join(packageDirectory, 'LICENSE'), join(temporary, 'LICENSE'));
  await writeFile(join(temporary, 'package.json'), `${JSON.stringify(staged, null, 2)}\n`);
  assertPackagePolicy(staged, release);
  const packed = JSON.parse(npm(['pack', '--ignore-scripts', '--json', '--pack-destination', artifactDirectory], {
    cwd: temporary, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'],
  }).stdout);
  assert.equal(packed.length, 1);
  assert.equal(join(artifactDirectory, packed[0].filename), artifactPath);
  const files = new Set(packed[0].files.map(file => file.path));
  for (const file of files) {
    assert.match(file, /^(package\.json|README\.md|LICENSE|dist\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_.-]+\.(?:js|cjs|d\.ts|d\.cts))$/, `Unexpected packed file: ${file}`);
  }
  for (const file of ['index.js', 'index.cjs', 'index.d.ts', 'index.d.cts', 'sync/index.js', 'sync/index.cjs', 'sync/index.d.ts', 'sync/index.d.cts', 'sync/worker.js', 'sync/worker.cjs']) {
    assert.ok(files.has(`dist/${file}`), `Missing installed entry: ${file}`);
  }
  const { publint } = await import('publint');
  const { messages } = await publint({ pkgDir: temporary, level: 'suggestion' });
  assert.deepEqual(messages, [], `publint rejected package: ${JSON.stringify(messages)}`);
  runNode(join(dirname(require.resolve('@arethetypeswrong/cli/package.json')), 'dist/index.js'), [artifactPath, '--profile', 'node16', '--no-emoji']);
  const sha256 = createHash('sha256').update(await readFile(artifactPath)).digest('hex');
  await writeFile(`${artifactPath}.sha256`, `${sha256}  ${packed[0].filename}\n`);
  console.log(`Validated packed artifact: ${packed[0].filename} (SHA-256 ${sha256})`);
} finally {
  await rm(temporary, { recursive: true, force: true });
}
