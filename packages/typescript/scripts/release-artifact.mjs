import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { assertReleaseContext } from './package-tools.mjs';
import { assertWorkflow, digests, downloadRegistry, git, outputs, registryManifest, releaseDirectory, verifyRegistry } from './release-tools.mjs';

assertWorkflow();
assertReleaseContext();
assert.equal(git(['rev-parse', 'HEAD'], process.env.SDK_SOURCE_DIRECTORY), process.env.SDK_RELEASE_SHA);
const identity = JSON.parse(process.env.SDK_RELEASE_IDENTITY);
assert.equal(identity.version, process.env.SDK_RELEASE_VERSION);
assert.equal(identity.source, process.env.SDK_RELEASE_SHA);
assert.equal(identity.filename, `sellaro-ja3proxy-${identity.version}.tgz`);
const metadataPath = join(releaseDirectory, 'release.json');
await mkdir(releaseDirectory, { recursive: true });
if (process.argv[2] === 'recover') {
  const value = await registryManifest(identity.version);
  if (value) {
    await verifyRegistry(value, identity);
    const hashes = await downloadRegistry(value, identity);
    await writeFile(join(releaseDirectory, `${identity.filename}.sha256`), `${hashes.sha256}  ${identity.filename}\n`);
    console.log(`Recovered verified npm bytes for ${identity.tag}; they will not be rebuilt.`);
  } else {
    assert.equal(identity.tagged, false, 'A tagged SDK version must already exist on npm.');
  }
  await writeFile(metadataPath, `${JSON.stringify(identity, null, 2)}\n`);
  await outputs({ recovered: Boolean(value) });
} else {
  assert.equal(process.argv[2], 'record');
  const hashes = digests(await readFile(join(releaseDirectory, identity.filename)));
  assert.equal(await readFile(join(releaseDirectory, `${identity.filename}.sha256`), 'utf8'), `${hashes.sha256}  ${identity.filename}\n`);
  await writeFile(metadataPath, `${JSON.stringify({ ...identity, ...hashes }, null, 2)}\n`);
  await outputs({ sha256: hashes.sha256 });
}
