// Parses the use-case inventory: one "### Category" section per table, one row
// per use case. Columns are located by header name, so reordering them in the
// Markdown does not break the build; a missing column does, with file:line.

import { stripInline } from './markdown.mjs';
import { splitTableRow } from './markdown-doc.mjs';
import { slugify } from './parse-terms.mjs';

export const COLUMNS = {
  name: 'Use Case',
  description: 'Description',
  tools: 'Tools & Systems',
  trigger: 'Trigger',
  hitl: 'HITL Pattern',
  agents: 'Agent Count',
  coordination: 'Coordination',
  pattern: 'Workflow Pattern',
  duration: 'Duration',
  failure: 'Key Failure Mode',
  preconditions: 'Preconditions',
  notes: 'Notes',
};

// The five dimensions the schema classifies on, in display order.
export const DIMENSIONS = [
  ['trigger', 'Trigger'],
  ['hitl', 'Human in the loop'],
  ['agents', 'Agent count'],
  ['coordination', 'Coordination'],
  ['pattern', 'Workflow pattern'],
];

const FOOTNOTES = '¹²³⁴⁵⁶⁷⁸⁹⁰';

// `Approval gate` (content)¹  →  { label, qualifier, footnote }
export function parseValue(raw) {
  const text = raw.trim();
  const m = text.match(new RegExp(`^\`([^\`]+)\`\\s*(?:\\(([^)]*)\\))?\\s*([${FOOTNOTES}]*)$`));
  if (m) {
    const full = m[1].trim();
    return { label: full.startsWith('Unspecified') ? 'Unspecified' : full, full, qualifier: (m[2] ?? '').trim(), footnote: m[3] ?? '' };
  }
  const bare = stripInline(text).replace(new RegExp(`[${FOOTNOTES}]+$`), '').trim();
  const foot = (text.match(new RegExp(`[${FOOTNOTES}]+$`)) ?? [''])[0];
  return { label: bare || 'Unspecified', full: bare, qualifier: '', footnote: foot };
}

const splitList = (cell) =>
  cell
    .split(/<br\s*\/?>/i)
    .map((s) => s.replace(/^\s*[•\-*]\s*/, '').trim())
    .filter(Boolean);

const isEmpty = (s) => !s.trim() || /^[—–-]+$/.test(s.trim());

export function parseUseCases(source, { file = 'use-case-inventory.md' } = {}) {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const start = lines.findIndex((l) => /^##\s+Use Case Inventory\s*$/i.test(l));
  if (start === -1) throw new Error(`${file}: no "## Use Case Inventory" section`);

  const categories = [];
  const useCases = [];
  const slugs = new Set();
  let cat = null;
  let cols = null;

  for (let n = start + 1; n < lines.length; n++) {
    const line = lines[n];
    const h = line.match(/^###\s+(.+?)\s*$/);
    if (h) {
      cat = { name: h[1].replace(/\s*\{#.*\}$/, ''), slug: slugify(h[1]), index: categories.length, useCases: [] };
      categories.push(cat);
      cols = null;
      continue;
    }
    if (/^##\s/.test(line)) break; // next top-level section ends the inventory
    if (!cat || !line.trim().startsWith('|')) continue;

    const cells = splitTableRow(line);
    if (!cols) {
      if (!cells.includes(COLUMNS.name)) continue;
      cols = {};
      for (const [key, header] of Object.entries(COLUMNS)) {
        const at = cells.indexOf(header);
        if (at === -1) throw new Error(`${file}:${n + 1}: table in "${cat.name}" has no "${header}" column`);
        cols[key] = at;
      }
      n++; // skip the |---|---| separator
      continue;
    }
    if (cells.length < Object.keys(COLUMNS).length) {
      throw new Error(`${file}:${n + 1}: row has ${cells.length} cells, expected ${Object.keys(COLUMNS).length}`);
    }

    const cell = (key) => cells[cols[key]] ?? '';
    const name = stripInline(cell('name'));
    if (!name) throw new Error(`${file}:${n + 1}: row has no use case name`);
    let slug = slugify(name);
    for (let k = 2; slugs.has(slug); k++) slug = `${slugify(name)}-${k}`;
    slugs.add(slug);

    const uc = {
      name,
      slug,
      line: n + 1,
      category: cat,
      description: cell('description'),
      tools: splitList(cell('tools')),
      duration: parseValue(cell('duration')),
      failure: stripInline(cell('failure')),
      failureRaw: cell('failure'),
      preconditions: isEmpty(cell('preconditions')) ? '' : cell('preconditions'),
      notes: isEmpty(cell('notes')) ? '' : cell('notes'),
    };
    for (const [key] of DIMENSIONS) uc[key] = parseValue(cell(key));
    cat.useCases.push(uc);
    useCases.push(uc);
  }

  if (!useCases.length) throw new Error(`${file}: no use cases found`);
  return { categories, useCases };
}
