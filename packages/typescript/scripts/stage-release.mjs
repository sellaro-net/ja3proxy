import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { artifactPath, assertReleaseApproval, npm } from './package-tools.mjs';

assertReleaseApproval();
assert.ok(process.env.ACTIONS_ID_TOKEN_REQUEST_URL && process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN, 'Only ephemeral GitHub OIDC authentication is permitted.');
assert.match(process.env.SDK_ARTIFACT_SHA256 ?? '', /^[a-f0-9]{64}$/);
const digest = createHash('sha256').update(await readFile(artifactPath)).digest('hex');
assert.equal(digest, process.env.SDK_ARTIFACT_SHA256, 'Artifact differs from the bytes validated in the preparation job.');
assert.equal((await readFile(`${artifactPath}.sha256`, 'utf8')).split(' ')[0], digest);
const version = npm(['--version'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).stdout.trim();
assert.equal(version, '12.0.2', 'Use the reviewed pinned npm CLI, which supports stage-only OIDC.');
// Never approve or directly publish here. The owner reviews this staged version
// and approves separately on npm with 2FA. The trusted publisher must disallow
// direct npm publish and authorize only sdk-publish.yml / npm-staging.
npm(['stage', 'publish', artifactPath, '--provenance', '--access', 'public', '--tag', 'latest', '--ignore-scripts', '--registry', 'https://registry.npmjs.org/']);
