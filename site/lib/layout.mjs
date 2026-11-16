// Shared page chrome: the document shell, navigation and footer. Every page is
// complete without JavaScript; assets/app.js only adds search, filters, copy
// buttons and the live proposal form.

import { escapeHtml as esc, stripInline } from './markdown.mjs';
import { ROOT } from './autolink.mjs';
import { findField } from './parse-terms.mjs';

export const hue = (cat) => (cat.index * 67 + 210) % 360;
export const hasScope = (t) => Boolean(findField(t, 'Scope'));
export const aliasesOf = (t) => (findField(t, 'Also known as')?.value ?? '').split(/\s*[,;]\s*/).filter(Boolean);
export const searchText = (t) =>
  [t.name, t.category.name, ...aliasesOf(t), stripInline(t.definition), ...t.notes.map(stripInline), ...t.fields.map((f) => stripInline(f.value))]
    .join(' ')
    .toLowerCase();

const brandMark = `<svg class="mark" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="5" r="2.2" fill="currentColor" stroke="none"/><circle cx="5.5" cy="18.5" r="2.2" fill="currentColor" stroke="none"/><circle cx="18.5" cy="18.5" r="2.2" fill="currentColor" stroke="none"/><path d="M12 7.5v4.5M12 12l-5.2 4.8M12 12l5.2 4.8"/></svg>`;
const favicon = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#0071e3"/><g fill="#fff"><circle cx="16" cy="9" r="3"/><circle cx="9" cy="23" r="3"/><circle cx="23" cy="23" r="3"/></g><path d="M16 11v5M16 16l-6 5M16 16l6 5" stroke="#fff" stroke-width="2" stroke-linecap="round" fill="none"/></svg>`,
)}`;
export const searchIcon = `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg>`;

export function page({ ctx, root, title, description, active, body, mermaid = false }) {
  const { config, gh, meta } = ctx;
  const nav = (key, href, label) =>
    `<a href="${href}"${active === key ? ' aria-current="page"' : ''}>${label}</a>`;
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="color-scheme" content="light dark">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="website">
<link rel="icon" href="${favicon}">
<link rel="stylesheet" href="${root}assets/styles.css">
${mermaid ? `<script src="${root}assets/vendor/mermaid/mermaid.min.js" defer></script>\n` : ''}<script src="${root}assets/app.js" defer></script>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="nav">
  <div class="wrap nav-inner">
    <a class="brand" href="${ROOT}" aria-label="Workflows &amp; Process Integration, home">${brandMark}<span><span class="long">Workflows &amp; Process Integration</span><span class="short">Workflows WG</span></span></a>
    <nav class="nav-links" aria-label="Primary">
      ${nav('terms', `${ROOT}terms/`, 'Taxonomy')}
      ${nav('architectures', `${ROOT}architectures/`, 'Architectures')}
      ${nav('use-cases', `${ROOT}use-cases/`, 'Use cases')}
      <a class="pill" href="${ROOT}contribute/"${active === 'contribute' ? ' aria-current="page"' : ''}>Contribute</a>
    </nav>
  </div>
</header>
<main id="main">
${body}
</main>
<footer class="footer">
  <div class="wrap">
    <p class="footer-title">Workflows &amp; Process Integration Working Group · Agentic AI Foundation</p>
    <ul class="footer-links">
      <li><a href="${gh.blob(config.charterPath)}">Charter</a></li>
      <li><a href="${gh.base}">GitHub</a></li>
      <li><a href="${config.community.mailingList}">Mailing list</a></li>
      <li><a href="${config.community.discord}">Discord</a></li>
      <li><a href="${ROOT}terms.json">terms.json</a></li>
    </ul>
    <p class="fine">Built from the Markdown in <a href="${gh.base}">the working group's repository</a>${
      meta.updated ? ` · source last changed ${esc(meta.updated)}` : ''
    }${meta.sha ? ` · <code>${esc(meta.sha)}</code>` : ''}. The Markdown is the source of truth; this site never stores edits.</p>
  </div>
</footer>
</body>
</html>
`;
  return html.replaceAll(ROOT, root);
}

