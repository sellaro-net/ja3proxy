import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assertProtection, assertWorkflow, git, outputs, registryManifest, resolveIdentity, sourceManifest } from './release-tools.mjs';

assertWorkflow();
assert.match(process.env.GITHUB_SHA ?? '', /^[a-f0-9]{40}$/);
git(['merge-base', '--is-ancestor', process.env.GITHUB_SHA, 'refs/remotes/origin/main']);
const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, 'utf8'));
if (process.env.GITHUB_EVENT_NAME === 'push' && event.before !== '0'.repeat(40)
  && sourceManifest(git, event.before).version === sourceManifest(git, process.env.GITHUB_SHA).version) {
  await outputs({ release: false });
  console.log('SDK source version is unchanged; nothing to publish.');
} else {
  assert.ok(['push', 'workflow_dispatch'].includes(process.env.GITHUB_EVENT_NAME));
  const requested = process.env.GITHUB_EVENT_NAME === 'workflow_dispatch' ? (process.env.SDK_RETRY_VERSION ?? '').trim() : '';
  const identity = resolveIdentity(git, process.env.GITHUB_SHA, requested);
  await assertProtection();
  const registered = await registryManifest(identity.version);
  // A tag is a completed publication identity, never permission to republish an
  // unpublished/deleted version. Initial 1.0.0 follows this same rule.
  assert.ok(!identity.tagged || registered, 'An existing SDK tag has no npm version; refusing to overwrite release history.');
  await outputs({ release: true, source: identity.source, version: identity.version, identity: JSON.stringify(identity) });
  console.log(`${identity.tag}: ${identity.source} (${registered ? 'verify and resume' : 'validate and publish'})`);
}
