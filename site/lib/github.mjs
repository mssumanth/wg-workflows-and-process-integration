// URL builders for every "take this to GitHub" link on the site. The site has no
// backend: contributing means opening a prefilled GitHub issue, editing the
// Markdown source, or sending an email.

const MAX_BODY = 6000; // keeps prefilled URLs under GitHub's request-line limit

export function githubLinks({ repo, branch }) {
  const base = `https://github.com/${repo}`;
  return {
    base,
    blob: (path, line) => `${base}/blob/${branch}/${path}${line ? `#L${line}` : ''}`,
    edit: (path) => `${base}/edit/${branch}/${path}`,
    issues: `${base}/issues/new`,
    search: (q) => `https://github.com/search?q=${encodeURIComponent(`repo:${repo} "${q}"`)}&type=code`,
    issue: ({ title, body, labels = 'taxonomy' }) => {
      const q = new URLSearchParams({ title, body: body.slice(0, MAX_BODY), labels });
      return `${base}/issues/new?${q}`;
    },
  };
}
