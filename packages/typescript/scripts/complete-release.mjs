import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { assertWorkflow, digests, git, github, readArtifact, registryManifest, releaseDirectory, repository, request, verifyRegistry } from './release-tools.mjs';

assertWorkflow();
const { identity, bytes } = await readArtifact();
git(['merge-base', '--is-ancestor', identity.source, 'refs/remotes/origin/main']);
const published = await registryManifest(identity.version);
assert.ok(published, 'GitHub releases may only complete after npm publication.');
await verifyRegistry(published, identity, identity.integrity);

async function tagSource(ref) {
  let object = ref.object;
  for (let depth = 0; object.type === 'tag' && depth < 8; depth++) {
    object = (await github(`git/tags/${object.sha}`)).object;
  }
  assert.equal(object.type, 'commit', 'SDK tag must resolve to a commit.');
  assert.equal(object.sha, identity.source, 'An existing tag points at different source; it must never be moved.');
}

let ref = await github(`git/ref/tags/${identity.tag}`, { statuses: [200, 404] });
if (!ref) {
  ref = await github('git/refs', { method: 'POST', body: { ref: `refs/tags/${identity.tag}`, sha: identity.source }, statuses: [201, 422] });
  if (!ref.object) ref = await github(`git/ref/tags/${identity.tag}`);
}
await tagSource(ref);
let release = await github(`releases/tags/${identity.tag}`, { statuses: [200, 404] });
if (!release) {
  // A previous failed run may have left a draft; the by-tag endpoint does not
  // consistently include drafts, so inspect the authenticated release list.
  for (let page = 1; page <= 20; page++) {
    const releases = await github(`releases?per_page=100&page=${page}`);
    release = releases.find(item => item.tag_name === identity.tag);
    if (release || releases.length < 100) break;
    assert.ok(page < 20, 'Release pagination limit reached; refusing ambiguous creation.');
  }
}
if (!release) {
  release = await github('releases', {
    method: 'POST', statuses: [201],
    body: {
      tag_name: identity.tag, target_commitish: identity.source, name: `TypeScript SDK ${identity.version}`,
      body: `Published [@sellaro/ja3proxy@${identity.version}](https://www.npmjs.com/package/@sellaro/ja3proxy/v/${identity.version}).\n\nSource: [${identity.source}](https://github.com/${repository}/commit/${identity.source})\n\nThe attached tarball is byte-for-byte identical to npm (SHA-256: \`${identity.sha256}\`).`,
      draft: true, prerelease: false, make_latest: 'false',
    },
  });
}
assert.equal(release.tag_name, identity.tag);
assert.equal(release.prerelease, false);
const assets = await github(`releases/${release.id}/assets?per_page=100`);
assert.ok(assets.length < 100, 'Too many release assets to verify safely.');

async function ensureAsset(name, content) {
  const existing = assets.filter(asset => asset.name === name);
  assert.ok(existing.length <= 1, `Duplicate release asset ${name}.`);
  if (existing[0]?.state === 'starter') {
    // GitHub can retain an empty starter after a failed upload. It is not a
    // published asset; remove only this documented incomplete state to retry.
    await github(`releases/assets/${existing.pop().id}`, { method: 'DELETE', statuses: [204] });
  }
  if (existing.length) {
    assert.equal(existing[0].state, 'uploaded', 'Unknown asset state; refusing replacement.');
    // Verify the stored bytes rather than trusting a filename or replacing an
    // upload whose contents differ. GitHub serves asset downloads via one CDN redirect.
    let response = await request(`https://api.github.com/repos/${repository}/releases/assets/${existing[0].id}`, {
      github: true, headers: { accept: 'application/octet-stream' }, statuses: [200, 302],
    });
    if (response.status === 302) {
      const url = new URL(response.headers.get('location'));
      assert.equal(url.protocol, 'https:');
      assert.equal(url.hostname, 'release-assets.githubusercontent.com');
      assert.equal(url.username + url.password, '');
      await response.body?.cancel();
      response = await request(url);
    }
    assert.equal(digests(Buffer.from(await response.arrayBuffer())).sha256, digests(content).sha256, `Existing asset ${name} differs; refusing to overwrite it.`);
    return;
  }
  const response = await request(`https://uploads.github.com/repos/${repository}/releases/${release.id}/assets?name=${encodeURIComponent(name)}`, {
    method: 'POST', body: content, github: true, statuses: [201], headers: { 'content-type': 'application/octet-stream' },
  });
  const uploaded = await response.json();
  assert.equal(uploaded.state, 'uploaded');
  assert.equal(uploaded.digest, `sha256:${digests(content).sha256}`, 'GitHub did not retain the exact uploaded bytes.');
}

await ensureAsset(identity.filename, bytes);
await ensureAsset(`${identity.filename}.sha256`, await readFile(join(releaseDirectory, `${identity.filename}.sha256`)));
if (release.draft) {
  release = await github(`releases/${release.id}`, { method: 'PATCH', body: { draft: false, make_latest: 'false' } });
}
assert.equal(release.draft, false);
console.log(`Completed ${release.html_url}; npm, SDK tag and GitHub assets agree.`);
