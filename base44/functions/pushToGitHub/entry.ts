import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const owner = body.owner || 'biedavinc-cloud';
    const repo = body.repo || 'Sasha-CRM';
    const branch = body.branch || 'main';
    const message = body.message;
    const files = body.files;

    if (!message || !Array.isArray(files) || files.length === 0) {
      return Response.json({ error: 'message and files[] are required' }, { status: 400 });
    }
    if (files.length > 20) {
      return Response.json({ error: 'Max 20 files per push' }, { status: 400 });
    }

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('github');
    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      'User-Agent': 'Sasha-CRM-Base44',
    };
    const base = `https://api.github.com/repos/${owner}/${repo}`;
    const timeout = 15000;

    // 1. Try to get the ref SHA (repo may be empty)
    const refResp = await fetch(`${base}/git/ref/heads/${branch}`, { headers, signal: AbortSignal.timeout(timeout) });
    const isEmptyRepo = refResp.status === 409;
    let commitSha = null;
    let treeSha = null;

    if (!isEmptyRepo) {
      if (!refResp.ok) {
        const errText = await refResp.text();
        return Response.json({ error: `Failed to get ref (${refResp.status})`, details: errText }, { status: refResp.status });
      }
      const refData = await refResp.json();
      commitSha = refData.object.sha;

      // 2. Get the commit's tree SHA
      const commitResp = await fetch(`${base}/git/commits/${commitSha}`, { headers, signal: AbortSignal.timeout(timeout) });
      if (!commitResp.ok) {
        const errText = await commitResp.text();
        return Response.json({ error: `Failed to get commit (${commitResp.status})`, details: errText }, { status: commitResp.status });
      }
      const commitData = await commitResp.json();
      treeSha = commitData.tree.sha;
    }

    // For an empty repo, the Git Database API returns 409. Use the Contents API instead.
    if (isEmptyRepo) {
      let lastCommitUrl = null;
      for (const file of files) {
        const contentResp = await fetch(`${base}/contents/${encodeURIComponent(file.path)}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            message,
            content: btoa(unescape(encodeURIComponent(file.content))),
            branch,
          }),
          signal: AbortSignal.timeout(timeout),
        });
        if (!contentResp.ok) {
          const errText = await contentResp.text();
          return Response.json({ error: `Failed to create ${file.path} (${contentResp.status})`, details: errText }, { status: contentResp.status });
        }
        const contentData = await contentResp.json();
        lastCommitUrl = contentData.commit?.html_url;
      }
      return Response.json({
        success: true,
        commit: { url: lastCommitUrl, message },
        filesPushed: files.length,
      });
    }

    // --- Non-empty repo: single commit via Git Database API ---
    // 3. Create blobs for each file
    const treeEntries = [];
    for (const file of files) {
      const blobResp = await fetch(`${base}/git/blobs`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ content: file.content, encoding: 'utf-8' }),
        signal: AbortSignal.timeout(timeout),
      });
      if (!blobResp.ok) {
        const errText = await blobResp.text();
        return Response.json({ error: `Failed to create blob for ${file.path} (${blobResp.status})`, details: errText }, { status: blobResp.status });
      }
      const blobData = await blobResp.json();
      treeEntries.push({ path: file.path, mode: '100644', type: 'blob', sha: blobData.sha });
    }

    // 4. Create a new tree
    const treeResp = await fetch(`${base}/git/trees`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ base_tree: treeSha, tree: treeEntries }),
      signal: AbortSignal.timeout(timeout),
    });
    if (!treeResp.ok) {
      const errText = await treeResp.text();
      return Response.json({ error: `Failed to create tree (${treeResp.status})`, details: errText }, { status: treeResp.status });
    }
    const treeData = await treeResp.json();

    // 5. Create a commit
    const newCommitResp = await fetch(`${base}/git/commits`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ message, tree: treeData.sha, parents: [commitSha] }),
      signal: AbortSignal.timeout(timeout),
    });
    if (!newCommitResp.ok) {
      const errText = await newCommitResp.text();
      return Response.json({ error: `Failed to create commit (${newCommitResp.status})`, details: errText }, { status: newCommitResp.status });
    }
    const newCommitData = await newCommitResp.json();

    // 6. Update the ref
    const updateRefResp = await fetch(`${base}/git/refs/heads/${branch}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ sha: newCommitData.sha }),
      signal: AbortSignal.timeout(timeout),
    });
    if (!updateRefResp.ok) {
      const errText = await updateRefResp.text();
      return Response.json({ error: `Failed to update ref (${updateRefResp.status})`, details: errText }, { status: updateRefResp.status });
    }

    return Response.json({
      success: true,
      commit: { sha: newCommitData.sha, url: newCommitData.html_url, message },
      filesPushed: files.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}