// Parses workstreams/taxonomy/terms.md into a model.
//
//   # Title
//   > **Status:** In Review — note
//   ## Category
//   ### Term
//   Definition paragraph.
//
//   **Scope:** optional field          <- any `**Label:** value` paragraph is a field
//
// Anything malformed throws with a line number so a bad PR fails the build early.

const FIELD = /^\*\*([^*:]{2,40}):\*\*\s*(.*)$/;

export const slugify = (s) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-');

export function parseTerms(source, { file = 'terms.md' } = {}) {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const doc = { title: '', status: { label: '', note: '' }, categories: [], terms: [] };
  let category = null;
  let term = null;

  const closeTerm = () => {
    if (!term) return;
    const paragraphs = term.body
      .join('\n')
      .split(/\n\s*\n/)
      .map((p) => p.trim().replace(/\s*\n\s*/g, ' '))
      .filter(Boolean);

    const prose = [];
    for (const p of paragraphs) {
      const m = FIELD.exec(p);
      if (m) {
        if (m[2].trim()) term.fields.push({ label: m[1].trim(), value: m[2].trim() });
      } else prose.push(p);
    }
    if (!prose.length) throw new Error(`${file}:${term.line}: term "${term.name}" has no definition`);
    [term.definition, ...term.notes] = prose;
    delete term.body;
    term = null;
  };

  lines.forEach((raw, i) => {
    const line = raw.trimEnd();
    let m;
    if ((m = /^# (.+)/.exec(line))) {
      doc.title = m[1].trim();
    } else if ((m = /^## (.+)/.exec(line))) {
      closeTerm();
      const name = m[1].trim();
      category = { name, slug: slugify(name), terms: [], index: doc.categories.length };
      doc.categories.push(category);
    } else if ((m = /^### (.+)/.exec(line))) {
      if (!category) throw new Error(`${file}:${i + 1}: term "${m[1]}" appears before any ## category`);
      closeTerm();
      const name = m[1].trim();
      term = {
        name,
        slug: slugify(name),
        category,
        line: i + 1,
        body: [],
        fields: [],
        notes: [],
        index: doc.terms.length,
      };
      category.terms.push(term);
      doc.terms.push(term);
    } else if (term) {
      if (!/^-{3,}$/.test(line)) term.body.push(line);
    } else if (!category && (m = /^>\s*\*\*Status:\*\*\s*(.+)$/.exec(line))) {
      const [label, ...rest] = m[1].split(/\s+[—–-]\s+/);
      const note = rest.join(' — ').trim();
      doc.status = { label: label.trim(), note: note.charAt(0).toUpperCase() + note.slice(1) };
    }
  });
  closeTerm();

  const seen = new Map();
  for (const t of doc.terms) {
    if (seen.has(t.slug)) {
      throw new Error(`${file}:${t.line}: duplicate term "${t.name}" (first defined at line ${seen.get(t.slug)})`);
    }
    seen.set(t.slug, t.line);
  }
  if (!doc.terms.length) throw new Error(`${file}: no terms found`);
  return doc;
}

export const findField = (term, label) =>
  term.fields.find((f) => f.label.toLowerCase() === label.toLowerCase());
