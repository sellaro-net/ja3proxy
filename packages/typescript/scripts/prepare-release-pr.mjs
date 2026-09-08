import assert from 'node:assert/strict';
import { bumpVersion, planRelease } from './prepare-release.mjs';

const repository = 'sellaro-net/ja3proxy';
const manifestPath = 'packages/typescript/package.json';

// GitHub-only orchestration. All package/changelog generation stays local and
// deterministic in prepare-release.mjs; no branch is ever updated or force-pushed.
export async function prepareReleasePr({ github, core, context, bump, root }) {
  assert.equal(`${context.repo.owner}/${context.repo.repo}`, repository);
  assert.equal(context.eventName, 'workflow_dispatch');
  assert.equal(context.ref, 'refs/heads/main', 'Dispatch preparation from protected main only.');
  const repo = context.repo;
  const sourceSha = context.sha;
  const mainSha = async () => (await github.rest.git.getRef({ ...repo, ref: 'heads/main' })).data.object.sha;
  assert.equal(await mainSha(), sourceSha, 'Main advanced since dispatch; run preparation again from current main.');

  async function contentAt(path, ref) {
    const { data } = await github.rest.repos.getContent({ ...repo, path, ref });
    assert.equal(data.type, 'file');
    assert.equal(data.encoding, 'base64');
    return Buffer.from(data.content, 'base64').toString('utf8');
  }

  async function isPublished(version) {
    const response = await fetch(`https://registry.npmjs.org/@sellaro%2Fja3proxy/${version}`, {
      redirect: 'error', signal: AbortSignal.timeout(30_000), headers: { accept: 'application/json' },
    });
    if (response.status === 404) {
      await response.body?.cancel();
      return false;
    }
    assert.equal(response.status, 200, `The public npm registry could not verify ${version}; preparation is blocked.`);
    const metadata = await response.json();
    assert.equal(metadata.name, '@sellaro/ja3proxy');
    assert.equal(metadata.version, version);
    assert.ok(metadata.dist?.integrity && metadata.dist?.tarball, 'Published package metadata is incomplete.');
    return true;
  }

  async function announce(message, url) {
    core.notice(message);
    core.summary.addHeading('SDK release preparation').addRaw(`${message}\n`);
    if (url) core.summary.addLink('Review release pull request', url);
    await core.summary.write();
  }

  const manifest = JSON.parse(await contentAt(manifestPath, sourceSha));
  assert.equal(manifest.name, '@sellaro/ja3proxy');
  assert.equal(manifest.private, true, 'The source package must remain private.');
  assert.equal(manifest.license, 'MIT');
  const version = bumpVersion(manifest.version, bump);
  const branch = `release/sdk-${version}`;
  assert.ok(await isPublished(manifest.version),
    `Main's exact SDK version ${manifest.version} is not public yet. Finish or retry sdk-publish.yml before preparing another release.`);

  const open = await github.paginate(github.rest.pulls.list, { ...repo, state: 'open', base: 'main', per_page: 100 });
  const releasePrs = open.filter(pr => pr.head.repo?.full_name === repository && pr.head.ref.startsWith('release/sdk-'));
  const competing = releasePrs.find(pr => pr.head.ref !== branch);
  assert.ok(!competing, `Another SDK release is awaiting review: ${competing?.html_url}. Merge or close it explicitly first.`);
  const existingPr = releasePrs.find(pr => pr.head.ref === branch);
  if (existingPr) {
    await announce(`Release ${version} already has an open PR; its branch and review are unchanged.`, existingPr.html_url);
    return;
  }
  const priorPrs = await github.paginate(github.rest.pulls.list, {
    ...repo, state: 'closed', base: 'main', head: `${repo.owner}:${branch}`, per_page: 100,
  });
  assert.equal(priorPrs.length, 0, `Release ${version} has a closed or merged PR. Reconcile it manually; preparation never reopens rejected releases.`);
  assert.ok(!await isPublished(version), `SDK ${version} is already public. Reconcile main and the SDK tag; an npm version is never overwritten or skipped.`);

  let branchSha;
  try {
    branchSha = (await github.rest.git.getRef({ ...repo, ref: `heads/${branch}` })).data.object.sha;
  } catch (error) {
    if (error.status !== 404) throw error;
  }

  let plan;
  if (branchSha) {
    // Resume only the precise two-file commit left by a failed PR-creation call.
    // Generate from its immutable parent, even if ordinary main merges advanced.
    const { data: commit } = await github.rest.git.getCommit({ ...repo, commit_sha: branchSha });
    assert.equal(commit.parents.length, 1, 'The existing release branch is not an untouched preparation commit. Leave it unchanged and review manually.');
    const parentSha = commit.parents[0].sha;
    const { data: ancestry } = await github.rest.repos.compareCommitsWithBasehead({
      ...repo, basehead: `${parentSha}...${sourceSha}`,
    });
    assert.ok(ancestry.status === 'ahead' || ancestry.status === 'identical', 'The existing release branch is not based on main.');
    plan = planRelease({ bump, expectedVersion: manifest.version, sourceSha: parentSha, root });
    assert.equal(plan.status, 'ready', 'The existing release branch has no releasable SDK changes.');
    const { data: changes } = await github.rest.repos.compareCommitsWithBasehead({
      ...repo, basehead: `${parentSha}...${branchSha}`,
    });
    assert.deepEqual(changes.files?.map(file => file.filename).sort(), plan.files.map(file => file.path).sort(),
      'The existing release branch changes files outside the exact release plan. Leave it unchanged and review manually.');
    const { data: tree } = await github.rest.git.getTree({ ...repo, tree_sha: commit.tree.sha, recursive: 'true' });
    assert.equal(tree.truncated, false, 'The existing branch tree could not be fully verified.');
    for (const file of plan.files) {
      const entry = tree.tree.find(candidate => candidate.path === file.path);
      assert.equal(entry?.type, 'blob', `Expected a regular release file: ${file.path}`);
      assert.equal(entry.mode, '100644', `Unexpected release file mode: ${file.path}`);
      assert.equal(await contentAt(file.path, branchSha), file.content,
        `The existing branch differs from the deterministic release plan: ${file.path}. It will not be overwritten.`);
    }
  } else {
    plan = planRelease({ bump, expectedVersion: manifest.version, sourceSha, root });
    if (plan.status === 'unchanged') {
      await announce(`No SDK or shared wire-contract changes since ${plan.previousTag}; no version, branch, or PR was created.`);
      return;
    }
    assert.equal(await mainSha(), sourceSha, 'Main advanced during preparation; retry from current main.');
    const { data: base } = await github.rest.git.getCommit({ ...repo, commit_sha: sourceSha });
    const { data: tree } = await github.rest.git.createTree({
      ...repo, base_tree: base.tree.sha,
      tree: plan.files.map(file => ({ path: file.path, mode: '100644', type: 'blob', content: file.content })),
    });
    const { data: commit } = await github.rest.git.createCommit({
      ...repo, message: `chore(sdk): release v${version}`, tree: tree.sha, parents: [sourceSha],
    });
    // createRef fails atomically if anyone claimed this name. Never updateRef,
    // deleteRef, or replace an existing branch; a retry inspects it instead.
    await github.rest.git.createRef({ ...repo, ref: `refs/heads/${branch}`, sha: commit.sha });
    branchSha = commit.sha;
  }

  assert.equal(await mainSha(), sourceSha, 'Main advanced before PR creation. The release branch is unchanged; rerun preparation to inspect and resume it.');
  assert.equal((await github.rest.git.getRef({ ...repo, ref: `heads/${branch}` })).data.object.sha, branchSha,
    'The release branch changed before PR creation; leave it unchanged and review manually.');
  const { data: pr } = await github.rest.pulls.create({
    ...repo, base: 'main', head: branch, title: `chore(sdk): release v${version}`,
    body: [
      `Prepare **@sellaro/ja3proxy ${version}** from the already-public **${manifest.version}**.`,
      '',
      '**Merging this PR is the only release approval.** Normal required SDK checks must pass; merge manually under main branch protection. The merge automatically starts npm OIDC publication through sdk-publish.yml. This workflow never merges, approves, tags, or publishes.',
      '',
      `Source remains \`private: true\`; only the version and SDK changelog change. Release source: [${plan.sourceSha}](${`https://github.com/${repository}/commit/${plan.sourceSha}`}).`,
      '',
      'Review the generated commit summaries and edit the changelog if user-facing release notes need clarification. Choose a different bump only after explicitly closing this PR; preparation never replaces its branch.',
      '',
      plan.notes,
    ].join('\n'),
    draft: false, maintainer_can_modify: true,
  });
  await announce(`Prepared ${version}. Review and merge the PR manually; no package was published by preparation.`, pr.html_url);
}
