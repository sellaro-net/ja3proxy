import assert from 'node:assert/strict';
import { assertReleaseApproval, manifest } from './package-tools.mjs';

assertReleaseApproval();
assert.ok(process.env.GITHUB_TOKEN, 'The ephemeral workflow token is required to inspect environment protection.');
const environmentResponse = await fetch('https://api.github.com/repos/sellaro-net/ja3proxy/environments/npm-staging', {
  headers: { authorization: `Bearer ${process.env.GITHUB_TOKEN}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28' },
  signal: AbortSignal.timeout(15_000), redirect: 'error',
});
assert.equal(environmentResponse.status, 200, 'Cannot verify npm-staging environment protection; staging is denied.');
const environment = await environmentResponse.json();
const reviewers = environment.protection_rules?.find(rule => rule.type === 'required_reviewers');
assert.ok(reviewers?.reviewers?.length > 0, 'npm-staging must require an owner/team reviewer.');
assert.equal(reviewers.prevent_self_review, true, 'npm-staging must prevent self-review.');
assert.equal(environment.deployment_branch_policy?.protected_branches, true, 'npm-staging must be restricted to protected branches.');
const registered = await fetch('https://registry.npmjs.org/@sellaro%2fja3proxy', { signal: AbortSignal.timeout(15_000), redirect: 'error' });
assert.equal(registered.status, 200, 'The owner must bootstrap the real, approved package first; this workflow cannot create a placeholder or first publication.');
const current = await registered.json();
assert.equal(current.name, manifest.name);
assert.ok(Object.keys(current.versions ?? {}).length > 0, 'No existing package version; owner bootstrap is required.');
assert.equal(current.versions?.[manifest.version], undefined, 'This version is already published.');
console.log('Owner license/version/commit approval, protected review environment and existing npm package verified.');
