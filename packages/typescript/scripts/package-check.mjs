import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { artifactDirectory, artifactPath, assertPackagePolicy, assertReleaseContext, manifest, npm, npmCliPath, packageDirectory, require, runNode } from './package-tools.mjs';

const release = process.argv.includes('--release');
const existing = process.argv.includes('--existing');
const restoreDist = process.argv.includes('--restore-dist');
assert.ok(!restoreDist || existing, 'Restore requires an existing validated artifact.');
assertPackagePolicy(manifest);
if (release) assertReleaseContext();
await mkdir(artifactDirectory, { recursive: true });
const temporary = await mkdtemp(join(tmpdir(), 'ja3proxy-pack-'));
try {
  if (!existing) {
    // Never flip private in the source checkout. No package scripts survive staging.
    const staged = { ...manifest, private: !release };
    delete staged.scripts;
    delete staged.devDependencies;
    await cp(join(packageDirectory, 'dist'), join(temporary, 'dist'), { recursive: true });
    await cp(join(packageDirectory, '../../README.md'), join(temporary, 'README.md'));
    await cp(join(packageDirectory, 'LICENSE'), join(temporary, 'LICENSE'));
    await writeFile(join(temporary, 'package.json'), `${JSON.stringify(staged, null, 2)}\n`);
    assertPackagePolicy(staged, release);
    const packed = Object.values(JSON.parse(npm(['pack', '--ignore-scripts', '--json', '--pack-destination', artifactDirectory], {
      cwd: temporary, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'],
    }).stdout));
    assert.equal(packed.length, 1);
    assert.equal(join(artifactDirectory, packed[0].filename), artifactPath);
  }
  const bytes = await readFile(artifactPath);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (existing) {
    assert.equal(await readFile(`${artifactPath}.sha256`, 'utf8'), `${sha256}  ${basename(artifactPath)}\n`, 'Recovered bytes changed before validation.');
  }
  // Validate the tar archive itself, including recovery from npm. Reject links,
  // traversal and duplicate entries before extracting anything.
  const tar = createRequire(npmCliPath())('tar');
  const files = new Set();
  await tar.t({ file: artifactPath, strict: true, onReadEntry(entry) {
    if (entry.type === 'Directory') {
      assert.match(entry.path, /^package\/(?:[a-zA-Z0-9_-]+\/)*$/);
      return;
    }
    assert.equal(entry.type, 'File', 'Only regular files are permitted in SDK artifacts.');
    assert.match(entry.path, /^package\/(package\.json|README\.md|LICENSE|dist\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_.-]+\.(?:js|cjs|d\.ts|d\.cts))$/, `Unexpected packed file: ${entry.path}`);
    assert.ok(!files.has(entry.path), `Duplicate packed file: ${entry.path}`);
    files.add(entry.path);
  } });
  for (const file of ['package.json', 'README.md', 'LICENSE', 'dist/index.js', 'dist/index.cjs', 'dist/index.d.ts', 'dist/index.d.cts', 'dist/sync/index.js', 'dist/sync/index.cjs', 'dist/sync/index.d.ts', 'dist/sync/index.d.cts', 'dist/sync/worker.js', 'dist/sync/worker.cjs']) {
    assert.ok(files.has(`package/${file}`), `Missing installed entry: ${file}`);
  }
  const unpacked = join(temporary, 'unpacked');
  await mkdir(unpacked);
  await tar.x({ file: artifactPath, cwd: unpacked, strip: 1, strict: true });
  const packedManifest = JSON.parse(await readFile(join(unpacked, 'package.json'), 'utf8'));
  assertPackagePolicy(packedManifest, release);
  assert.equal(packedManifest.scripts, undefined, 'Artifact must contain no package scripts.');
  assert.equal(packedManifest.devDependencies, undefined);
  // Git may check out CRLF on Windows while the same validated tarball was
  // produced on Linux. Compare license text, never rewrite artifact bytes.
  assert.equal((await readFile(join(unpacked, 'LICENSE'), 'utf8')).replaceAll('\r\n', '\n'), (await readFile(join(packageDirectory, 'LICENSE'), 'utf8')).replaceAll('\r\n', '\n'), 'Packed license must match canonical SDK source.');
  const { publint } = await import(pathToFileURL(require.resolve('publint')).href);
  const { messages } = await publint({ pkgDir: unpacked, level: 'suggestion' });
  assert.deepEqual(messages, [], `publint rejected package: ${JSON.stringify(messages)}`);
  runNode(join(dirname(require.resolve('@arethetypeswrong/cli/package.json')), 'dist/index.js'), [artifactPath, '--profile', 'node16', '--no-emoji']);
  if (restoreDist) {
    // Source regressions import dist directly. Use the validated release bytes,
    // never a second build or leftover output from another source revision.
    await rm(join(packageDirectory, 'dist'), { recursive: true, force: true });
    await cp(join(unpacked, 'dist'), join(packageDirectory, 'dist'), { recursive: true });
  }
  await writeFile(`${artifactPath}.sha256`, `${sha256}  ${basename(artifactPath)}\n`);
  console.log(`Validated packed artifact: ${basename(artifactPath)} (SHA-256 ${sha256})`);
} finally {
  await rm(temporary, { recursive: true, force: true });
}
