// Minimal inline-Markdown renderer. terms.md only needs code, emphasis and links,
// so this stays small and escapes everything it does not recognise.

export const escapeHtml = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// Only http(s), mailto, fragment and site-internal links survive; anything else
// renders as plain text. "@@ROOT@@" is the placeholder render.mjs swaps for a
// relative path to the site root, so only a resolveUrl hook should produce it.
export const ROOT_TOKEN = '@@ROOT@@';
const safeHref = (url) => (/^(https?:\/\/|mailto:|#|@@ROOT@@)/i.test(url) ? url : null);

export function renderInline(text, { resolveUrl = (u) => u } = {}) {
  const stash = [];
  const hold = (html) => `\u0000${stash.push(html) - 1}\u0000`;

  let s = text.replace(/`([^`]+)`/g, (_, code) => hold(`<code>${escapeHtml(code)}</code>`));

  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, url) => {
    const href = safeHref(resolveUrl(url));
    const inner = renderInline(label);
    return href ? hold(`<a href="${escapeHtml(href)}">${inner}</a>`) : inner;
  });

  s = escapeHtml(s)
    .replace(/&lt;br\s*\/?&gt;/gi, '<br>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*(?!\s)(.+?)(?<!\s)\*/g, '$1<em>$2</em>')
    .replace(/(^|[\s(])_(?!\s)(.+?)(?<!\s)_(?![\w])/g, '$1<em>$2</em>');

  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => stash[Number(i)]);
}

// Markdown → plain text, for search indexes, meta descriptions and terms.json.
export function stripInline(text) {
  return text
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/(^|[\s(])\*(?!\s)(.+?)(?<!\s)\*/g, '$1$2')
    .replace(/(^|[\s(])_(?!\s)(.+?)(?<!\s)_(?![\w])/g, '$1$2');
}
