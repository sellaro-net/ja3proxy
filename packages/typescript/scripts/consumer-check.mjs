import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { artifactPath, assertPackagePolicy, assertReleaseContext, npm, packageDirectory, require, runNode } from './package-tools.mjs';

const release = process.argv.includes('--release');
if (release) assertReleaseContext();
const checksum = (await readFile(`${artifactPath}.sha256`, 'utf8')).split(' ')[0];
assert.equal(createHash('sha256').update(await readFile(artifactPath)).digest('hex'), checksum, 'Packed bytes changed after validation.');
const temporary = await mkdtemp(join(tmpdir(), 'ja3proxy-consumer-'));
try {
  await writeFile(join(temporary, 'package.json'), JSON.stringify({ name: 'ja3proxy-installed-consumer', private: true, type: 'module' }));
  npm(['install', '--ignore-scripts', '--no-audit', '--no-fund', '--package-lock=false', artifactPath], { cwd: temporary });
  const installed = join(temporary, 'node_modules/@sellaro/ja3proxy');
  assertPackagePolicy(JSON.parse(await readFile(join(installed, 'package.json'), 'utf8')), release);
  const compiler = require.resolve('typescript/bin/tsc');
  const typeRoots = dirname(require.resolve('@types/node/package.json'));
  const fixture = await readFile(join(packageDirectory, 'test/consumer-contract.ts'), 'utf8');
  for (const extension of ['mts', 'cts']) {
    const filename = `consumer.${extension}`;
    await writeFile(join(temporary, filename), fixture);
    for (const resolution of ['Node16', 'NodeNext']) {
      for (const libraries of ['ES2023', 'ES2023,DOM,DOM.Iterable,ESNext.Disposable']) {
        runNode(compiler, [filename, '--noEmit', '--strict', '--exactOptionalPropertyTypes', '--noUncheckedIndexedAccess', '--target', 'ES2022', '--lib', libraries, '--types', 'node', '--module', resolution, '--moduleResolution', resolution, '--typeRoots', dirname(typeRoots)], { cwd: temporary });
      }
    }
  }
  runNode(compiler, ['consumer.mts', '--noEmit', '--strict', '--target', 'ES2022', '--lib', 'ES2023,DOM,DOM.Iterable,ESNext.Disposable', '--module', 'ESNext', '--moduleResolution', 'Bundler', '--typeRoots', dirname(typeRoots)], { cwd: temporary });
  const common = `
const assert = MODULE_ASSERT;
const { Ja3ProxyClient, Ja3ProxyTransportError } = MODULE_ROOT;
const { Ja3ProxySyncClient } = MODULE_SYNC;
const options = { baseUrl: 'http://127.0.0.1:9', token: 'consumer-explicit-token-32-bytes-long' };
const asyncClient = new Ja3ProxyClient(options);
const syncClient = new Ja3ProxySyncClient(options);
assert.equal(typeof asyncClient.request, 'function');
assert.equal(typeof syncClient.request, 'function');
assert.throws(() => MODULE_HIDDEN, error => error.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED');
assert.throws(() => syncClient.capabilities(), error => error instanceof Ja3ProxyTransportError && error.kind === 'service_unavailable');
syncClient.close();
ASYNC_CLOSE
`;
  await writeFile(join(temporary, 'consumer.mjs'), "import { createRequire } from 'node:module';\nconst require = createRequire(import.meta.url);\n" + common.replace('MODULE_ASSERT', '(await import(\'node:assert/strict\')).default').replace('MODULE_ROOT', 'await import(\'@sellaro/ja3proxy\')').replace('MODULE_SYNC', 'await import(\'@sellaro/ja3proxy/sync\')').replace('MODULE_HIDDEN', 'require(\'@sellaro/ja3proxy/dist/sync/worker.cjs\')').replace('ASYNC_CLOSE', 'await asyncClient.close();'));
  await writeFile(join(temporary, 'consumer.cjs'), common.replace('MODULE_ASSERT', 'require(\'node:assert/strict\')').replace('MODULE_ROOT', 'require(\'@sellaro/ja3proxy\')').replace('MODULE_SYNC', 'require(\'@sellaro/ja3proxy/sync\')').replace('MODULE_HIDDEN', 'require(\'@sellaro/ja3proxy/dist/sync/worker.cjs\')').replace('ASYNC_CLOSE', 'asyncClient.close().catch(error => { console.error(error); process.exitCode = 1; });'));
  const unrelated = join(temporary, 'unrelated-working-directory');
  await mkdir(unrelated);
  runNode(join(temporary, 'consumer.mjs'), [], { cwd: unrelated, timeout: 30_000 });
  runNode(join(temporary, 'consumer.cjs'), [], { cwd: unrelated, timeout: 30_000 });
  await cp(join(packageDirectory, 'test/consumer-mixed.mjs'), join(temporary, 'consumer-mixed.mjs'));
  await cp(join(packageDirectory, '../../contracts/fixtures/wire.json'), join(temporary, 'wire-fixtures.json'));
  runNode(join(temporary, 'consumer-mixed.mjs'), [], { cwd: unrelated, timeout: 30_000 });
  if (process.argv.includes('--interop')) {
    for (const file of ['interop-smoke.mjs', 'interop-origin.mjs']) {
      await cp(join(packageDirectory, 'scripts', file), join(temporary, file));
    }
    for (const mode of ['esm', 'cjs']) {
      runNode(join(temporary, 'interop-smoke.mjs'), [], {
        cwd: unrelated, timeout: 120_000,
        env: { ...process.env, JA3_SDK_INSTALLED: 'true', JA3_SDK_MODULE_MODE: mode },
      });
    }
  }
  console.log('Installed ESM/CJS exports, worker locations and negative consumer type contracts passed.');
} finally {
  await rm(temporary, { recursive: true, force: true });
}
