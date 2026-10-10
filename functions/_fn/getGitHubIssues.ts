import { createClientFromRequest } from '../_lib/compat.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const owner = body.owner || 'biedavinc-cloud';
    const repo = body.repo || 'Sasha-CRM';

    const SAFE = /^(?!\.+$)[A-Za-z0-9_.-]{1,100}$/;
    if (!SAFE.test(String(owner)) || !SAFE.test(String(repo))) return Response.json({ error: 'Invalid owner or repo' }, { status: 400 });
    const state = ['open', 'closed', 'all'].includes(body.state) ? body.state : 'open';
    const perPage = Math.min(body.perPage || 100, 100);

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('github');

    const resp = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/issues?state=${state}&sort=created&direction=desc&per_page=${perPage}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'Sasha-CRM-Base44',
        },
        signal: AbortSignal.timeout(15000),
      }
    );

    if (!resp.ok) {
      const errText = await resp.text();
      return Response.json({ error: `GitHub API error: ${resp.status}`, details: errText }, { status: resp.status });
    }

    const issues = await resp.json();
    const filteredIssues = issues
      .filter((i) => !i.pull_request)
      .map((i) => ({
        number: i.number,
        title: i.title,
        state: i.state,
        html_url: i.html_url,
        created_at: i.created_at,
        updated_at: i.updated_at,
        labels: (i.labels || []).map((l) => l.name),
        assignee: i.assignee?.login || null,
        user: i.user?.login || null,
        body: (i.body || '').substring(0, 500),
        comments: i.comments || 0,
      }));

    return Response.json({ issues: filteredIssues, repo: `${owner}/${repo}` });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}