import assert from 'node:assert/strict';
import { join } from 'node:path';
import { npm } from './package-tools.mjs';
import { assertProtection, assertWorkflow, readArtifact, registryManifest, releaseDirectory, verifyRegistry } from './release-tools.mjs';

assertWorkflow();
await assertProtection();
const { identity } = await readArtifact();
const existing = await registryManifest(identity.version);
if (existing) {
  await verifyRegistry(existing, identity, identity.integrity);
  console.log(`${identity.tag} already contains the exact validated bytes; continuing release completion.`);
} else {
  assert.equal(identity.tagged, false, 'A tagged version must never be republished.');
  assert.ok(process.env.ACTIONS_ID_TOKEN_REQUEST_URL && process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN, 'Only ephemeral GitHub OIDC authentication is permitted.');
  assert.equal(npm(['--version'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).stdout.trim(), '12.0.2');
  // npm builds its provenance from GITHUB_SHA. Bind it to the checked source,
  // not a later manual retry's workflow commit; the OIDC workflow stays main.
  npm(['publish', join(releaseDirectory, identity.filename), '--provenance', '--access', 'public', '--tag', 'latest', '--ignore-scripts', '--registry', 'https://registry.npmjs.org/', '--fetch-retries=0', '--fetch-timeout=30000'], {
    env: { ...process.env, GITHUB_SHA: identity.source }, timeout: 300_000,
  });
  const published = await registryManifest(identity.version);
  assert.ok(published, 'npm publication is not visible yet; rerun to verify and finish safely.');
  await verifyRegistry(published, identity, identity.integrity);
  console.log(`Published and verified ${identity.tag} with GitHub OIDC provenance.`);
}
