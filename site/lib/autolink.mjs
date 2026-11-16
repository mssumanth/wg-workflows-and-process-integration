// Links capitalised mentions of one term inside another term's text, e.g.
// "Workflow Executions" in a definition becomes a link to that term's page.
// Matching is case-sensitive on purpose: terms.md capitalises defined terms.

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// "Activity" → Activity, Activities; "Trigger" → Trigger, Triggers.
const surfaceForms = (name) => [
  name,
  /[^aeiou]y$/i.test(name) ? `${name.slice(0, -1)}ies` : `${name}s`,
];

export const ROOT = '@@ROOT@@'; // swapped for a relative path when a page is written

export function buildLinker(terms, aliases = {}) {
  const forms = new Map();
  for (const t of terms) for (const f of surfaceForms(t.name)) forms.set(f, t.slug);
  for (const [form, slug] of Object.entries(aliases)) {
    if (terms.some((t) => t.slug === slug)) forms.set(form, slug);
  }
  const pattern = new RegExp(
    `(?<![\\w-])(?:${[...forms.keys()]
      .sort((a, b) => b.length - a.length)
      .map(escapeRe)
      .join('|')})(?![\\w-])`,
    'g',
  );

  return function link(html, selfSlug) {
    const refs = new Set();
    let depth = 0; // inside <a> or <code>
    const out = html
      .split(/(<[^>]+>)/)
      .map((part) => {
        if (part.startsWith('<')) {
          if (/^<(a|code)\b/i.test(part)) depth++;
          else if (/^<\/(a|code)>/i.test(part)) depth--;
          return part;
        }
        if (depth > 0) return part;
        return part.replace(pattern, (m) => {
          const slug = forms.get(m);
          if (slug === selfSlug) return m;
          refs.add(slug);
          return `<a class="xref" href="${ROOT}terms/${slug}/">${m}</a>`;
        });
      })
      .join('');
    return { html: out, refs: [...refs] };
  };
}
