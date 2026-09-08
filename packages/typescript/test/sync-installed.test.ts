import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const packageRoot = fileURLToPath(new URL('../', import.meta.url));

async function installedPackage(run: (directory: string, sdk: string) => Promise<void>): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), 'ja3-sync-installed-'));
  const sdk = join(directory, 'node_modules', '@sellaro', 'ja3proxy');
  try {
    await mkdir(sdk, { recursive: true });
    await cp(join(packageRoot, 'dist'), join(sdk, 'dist'), { recursive: true });
    await writeFile(join(sdk, 'package.json'), await readFile(join(packageRoot, 'package.json')));
    await run(directory, sdk);
  } finally { await rm(directory, { recursive: true, force: true }); }
}

for (const format of ['esm', 'cjs'] as const) {
  const extension = format === 'esm' ? 'js' : 'cjs';
  const imports = format === 'esm'
    ? "import {Ja3ProxySyncClient} from '@sellaro/ja3proxy/sync'; import {isJa3ProxyError, Ja3ProxyTransportError} from '@sellaro/ja3proxy';"
    : "const {Ja3ProxySyncClient} = require('@sellaro/ja3proxy/sync'); const {isJa3ProxyError, Ja3ProxyTransportError} = require('@sellaro/ja3proxy');";
  const run = (directory: string, program: string) => {
    const child = spawnSync(process.execPath, [...(format === 'esm' ? ['--input-type=module'] : []), '--eval', `${imports}\n${program}`], {
      cwd: directory, encoding: 'utf8', timeout: 15_000,
      env: { ...process.env, NODE_OPTIONS: '' },
    });
    assert.ifError(child.error);
    assert.equal(child.status, 0, child.stderr);
    assert.equal(child.stderr, '');
    return JSON.parse(child.stdout) as unknown;
  };

  test(`${format}: an installed entry loads its actual sibling worker from an unrelated cwd`, async () => {
    await installedPackage(async directory => {
      const result = run(directory, `
const client = new Ja3ProxySyncClient({baseUrl:'http://127.0.0.1:1',token:'installed-token-012345678901234567890'});
client.close(); client.close();
let error; try { client.capabilities(); } catch (caught) { error = caught; }
console.log(JSON.stringify({typed:isJa3ProxyError(error),instance:error instanceof Ja3ProxyTransportError,kind:error.kind}));
`);
      assert.deepEqual(result, { typed: true, instance: true, kind: 'client_closed' });
    });
  });

  // These are true platform deadlines: the parent intentionally blocks in Atomics.wait,
  // so fake timers on its event loop cannot prove startup/dead-worker liveness.
  for (const fault of ['startup-silent', 'startup-throw', 'dead-after-ready', 'operation-silent'] as const) {
    test(`${format}: ${fault} returns a finite typed error without exposing worker exception text`, async () => {
      await installedPackage(async (directory, sdk) => {
        const prelude = format === 'esm'
          ? "import {workerData} from 'node:worker_threads';"
          : "const {workerData} = require('node:worker_threads');";
        const ready = "const {port,signal:buffer} = workerData; const signal = new Int32Array(buffer); port.postMessage({id:0,ok:true,value:null}); Atomics.store(signal,1,1); Atomics.add(signal,0,1); Atomics.notify(signal,0);";
        const script = fault === 'startup-silent'
          ? 'Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0);'
          : fault === 'startup-throw'
            ? "throw new Error('token-super-secret proxy://user:password@private');"
            : fault === 'dead-after-ready'
              ? `${ready} process.exit(1);`
              : `${ready} port.on('message', () => {});`;
        await writeFile(join(sdk, 'dist', 'sync', `worker.${extension}`), `${prelude}\n${script}`);
        const result = run(directory, `
const started = performance.now(); let client; let error;
try {
  client = new Ja3ProxySyncClient({baseUrl:'http://127.0.0.1:1',token:'installed-token-012345678901234567890',startupTimeoutMs:300,operationTimeoutMs:300});
  client.capabilities();
} catch (caught) { error = caught; } finally { if (client) client.close(); }
if (!error || performance.now()-started > 5000) throw new Error('bounded worker failure missing');
console.log(JSON.stringify({typed:isJa3ProxyError(error),instance:error instanceof Ja3ProxyTransportError,kind:error.kind,code:error.code,safe:!JSON.stringify(error).includes('super-secret')&&!error.stack.includes('password')}));
`);
        assert.ok(result !== null && typeof result === 'object');
        assert.equal(Reflect.get(result, 'typed'), true);
        assert.equal(Reflect.get(result, 'instance'), true);
        assert.equal(Reflect.get(result, 'kind'), 'worker_unavailable');
        assert.ok(['UNKNOWN', 'TIMEOUT'].includes(Reflect.get(result, 'code')));
        assert.equal(Reflect.get(result, 'safe'), true);
      });
    });
  }
}
