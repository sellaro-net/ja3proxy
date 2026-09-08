import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { assertProvenance, digests, git, initialPublication, request, resolveIdentity, verifyRegistry } from '../scripts/release-tools.mjs';

async function repositoryFixture() {
  const directory = await mkdtemp(join(tmpdir(), 'sdk-release-history-'));
  const run = args => git(args, directory);
  run(['init', '--initial-branch=main']);
  run(['config', 'user.name', 'SDK release regression']);
  run(['config', 'user.email', 'sdk-regression@example.invalid']);
  run(['config', 'commit.gpgsign', 'false']);
  run(['config', 'tag.gpgsign', 'false']);
  await mkdir(join(directory, 'packages/typescript'), { recursive: true });
  const commit = async (version, extra = {}) => {
    await writeFile(join(directory, 'packages/typescript/package.json'), JSON.stringify({ name: '@sellaro/ja3proxy', private: true, license: 'MIT', version, ...extra }));
    run(['add', '.']);
    run(['commit', '-m', `SDK ${version}`]);
    return run(['rev-parse', 'HEAD']);
  };
  return { directory, run, commit };
}

test('canonical source is the approving main merge, stable through manifest edits, tags and newer versions', async () => {
  const { directory, run, commit } = await repositoryFixture();
  try {
    await commit('1.0.0');
    run(['checkout', '-b', 'release/sdk-1.0.1']);
    const branchTip = await commit('1.0.1');
    run(['checkout', 'main']);
    run(['merge', '--no-ff', 'release/sdk-1.0.1', '-m', 'Approve SDK 1.0.1']);
    const merged = run(['rev-parse', 'HEAD']);
    assert.notEqual(merged, branchTip);
    const manifestEdit = await commit('1.0.1', { description: 'Not a version release' });
    assert.equal(resolveIdentity(run, manifestEdit).source, merged);
    const advanced = await commit('1.1.0');
    assert.equal(resolveIdentity(run, advanced, '1.0.1').source, merged);
    run(['tag', 'sdk-v1.0.1', merged]);
    const retried = resolveIdentity(run, advanced, '1.0.1');
    assert.equal(retried.source, merged);
    assert.equal(retried.tagged, true);
    assert.equal(resolveIdentity(run, advanced).source, advanced);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('tags outside approved main history and nonexistent source versions cannot select release source', async () => {
  const { directory, run, commit } = await repositoryFixture();
  try {
    const main = await commit('1.0.0');
    run(['checkout', '-b', 'unapproved']);
    await commit('1.0.1');
    run(['tag', 'sdk-v1.0.1']);
    run(['checkout', 'main']);
    assert.throws(() => resolveIdentity(run, main, '1.0.1'));
    assert.throws(() => resolveIdentity(run, main, '9.9.9'), /never introduced/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

function provenance(identity, integrity) {
  return {
    _type: 'https://in-toto.io/Statement/v1',
    subject: [{ name: `pkg:npm/%40sellaro/ja3proxy@${identity.version}`, digest: { sha512: Buffer.from(integrity.slice(7), 'base64').toString('hex') } }],
    predicateType: 'https://slsa.dev/provenance/v1',
    predicate: {
      buildDefinition: {
        buildType: 'https://slsa-framework.github.io/github-actions-buildtypes/workflow/v1',
        externalParameters: { workflow: { ref: 'refs/heads/main', repository: 'https://github.com/sellaro-net/ja3proxy', path: '.github/workflows/sdk-publish.yml' } },
        resolvedDependencies: [{ uri: 'git+https://github.com/sellaro-net/ja3proxy@refs/heads/main', digest: { gitCommit: identity.source } }],
      },
      runDetails: { builder: { id: 'https://github.com/actions/runner/github-hosted' } },
    },
  };
}

test('recovery rejects a signed statement for different source, bytes, version or workflow', () => {
  const identity = { version: '1.0.1', source: 'a'.repeat(40) };
  const { integrity } = digests(Buffer.from('published bytes'));
  const statement = provenance(identity, integrity);
  assertProvenance(statement, identity, integrity);
  for (const mutate of [
    value => { value.predicate.buildDefinition.resolvedDependencies[0].digest.gitCommit = 'b'.repeat(40); },
    value => { value.subject[0].digest.sha512 = '0'.repeat(128); },
    value => { value.subject[0].name = 'pkg:npm/%40sellaro/ja3proxy@1.0.2'; },
    value => { value.predicate.buildDefinition.externalParameters.workflow.path = '.github/workflows/other.yml'; },
    value => { value.predicate.buildDefinition.externalParameters.workflow.ref = 'refs/heads/unapproved'; },
  ]) {
    const changed = structuredClone(statement);
    mutate(changed);
    assert.throws(() => assertProvenance(changed, identity, integrity));
  }
});

test('the pre-OIDC publication exception is bound to all three immutable facts', async () => {
  const value = { dist: { integrity: initialPublication.integrity } };
  const identity = { version: initialPublication.version, source: initialPublication.source, tagged: true };
  await verifyRegistry(value, identity, initialPublication.integrity);
  await assert.rejects(verifyRegistry(value, { ...identity, source: 'a'.repeat(40) }));
  await assert.rejects(verifyRegistry(value, { ...identity, tagged: false }));
  await assert.rejects(verifyRegistry({ dist: { integrity: digests(Buffer.from('other bytes')).integrity } }, identity));
  await assert.rejects(verifyRegistry(value, identity, digests(Buffer.from('rebuilt bytes')).integrity), /different bytes/);
});

test('publication boundary rejects tampered tarball even when its local checksum and descriptor are changed together', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'sdk-release-artifact-'));
  try {
    const version = '1.0.1';
    const filename = `sellaro-ja3proxy-${version}.tgz`;
    const source = 'a'.repeat(40);
    const original = Buffer.from('validated artifact');
    const expected = digests(original);
    const writeArtifact = async bytes => {
      const hashes = digests(bytes);
      await writeFile(join(directory, filename), bytes);
      await writeFile(join(directory, `${filename}.sha256`), `${hashes.sha256}  ${filename}\n`);
      await writeFile(join(directory, 'release.json'), JSON.stringify({ version, source, filename, tag: `sdk-v${version}`, ...hashes }));
    };
    const verify = () => spawnSync(process.execPath, ['--input-type=module', '-e', `const { readArtifact } = await import(${JSON.stringify(new URL('../scripts/release-tools.mjs', import.meta.url).href)}); await readArtifact();`], {
      encoding: 'utf8', timeout: 15_000,
      env: { ...process.env, SDK_ARTIFACT_DIRECTORY: directory, SDK_RELEASE_SHA: source, SDK_RELEASE_VERSION: version, SDK_ARTIFACT_SHA256: expected.sha256 },
    });
    await writeArtifact(original);
    const good = verify();
    assert.equal(good.status, 0, good.stderr);
    await writeArtifact(Buffer.from('tampered artifact'));
    const bad = verify();
    assert.notEqual(bad.status, 0);
    assert.match(bad.stderr, /exact validated tarball/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('release requests expose explicitly allowed redirects without following them or forwarding credentials', async () => {
  let destinationRequests = 0;
  const server = createServer((incoming, response) => {
    if (incoming.url === '/asset') {
      response.writeHead(302, { location: '/destination' });
    } else {
      destinationRequests += 1;
    }
    response.end();
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const url = `http://127.0.0.1:${server.address().port}/asset`;
    const headers = { authorization: 'Bearer regression-only' };
    const response = await request(url, { headers, statuses: [200, 302] });
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('location'), '/destination');
    await response.body?.cancel();
    await assert.rejects(request(url, { headers }), /unexpected HTTP 302/);
    assert.equal(destinationRequests, 0);
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

test('publication visibility polling survives a transient 404 but still rejects a missing document after its bound', async () => {
  let visible = false;
  const server = createServer((incoming, response) => {
    response.statusCode = visible && incoming.url === '/publication' ? 200 : 404;
    visible = true;
    response.end();
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const origin = `http://127.0.0.1:${server.address().port}`;
    await assert.rejects(request(`${origin}/publication`), /unexpected HTTP 404/);
    visible = false;
    const response = await request(`${origin}/publication`, { notFoundRetries: 1 });
    assert.equal(response.status, 200);
    await response.body?.cancel();
    await assert.rejects(request(`${origin}/missing`, { notFoundRetries: 1 }), /unexpected HTTP 404/);
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
