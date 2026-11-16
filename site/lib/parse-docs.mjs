// Parses the workstream documents (architectures, patterns, decisions, …) into
// a title, an optional block of "**Label:** value" facts, a status line, and
// the remaining Markdown body.

import { stripInline } from './markdown.mjs';
import { slugify } from './parse-terms.mjs';

const FACT = /^\*\*([^*:][^*]*?):\*\*\s*(.*?)\s*\\?$/;

export function parseDoc(source, { file = 'document' } = {}) {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const h1 = lines.findIndex((l) => /^#\s+\S/.test(l));
  if (h1 === -1) throw new Error(`${file}: no "# Title" heading`);
  const title = stripInline(lines[h1].replace(/^#\s+/, '').trim());

  // Facts: the run of **Label:** lines straight after the title.
  let i = h1 + 1;
  while (i < lines.length && !lines[i].trim()) i++;
  const factLines = [];
  while (i < lines.length && lines[i].trim() && FACT.test(lines[i].trim())) factLines.push(lines[i++].trim());
  const facts = factLines.map((l) => {
    const [, label, value] = l.match(FACT);
    return { label, value: value.replace(/\s*\\$/, '').trim() };
  });
  const bodyStart = facts.length ? i : h1 + 1;
  const body = lines.slice(bodyStart).join('\n').replace(/^\s+/, '');

  // Status: the first paragraph under a "## Status" heading.
  let status = '';
  const s = lines.findIndex((l) => /^##\s+Status\s*$/i.test(l));
  if (s !== -1) {
    const para = [];
    for (let j = s + 1; j < lines.length; j++) {
      if (/^#{1,6}\s/.test(lines[j])) break;
      if (!lines[j].trim()) {
        if (para.length) break;
        continue;
      }
      para.push(lines[j].trim());
    }
    status = stripInline(para.join(' '));
  }

  // First paragraph under the first of these headings, for index cards.
  const summarySection = ['Purpose', 'Problem', 'Context', 'Overview'];
  let summary = '';
  for (const name of summarySection) {
    const at = lines.findIndex((l) => new RegExp(`^##\\s+${name}\\b`, 'i').test(l));
    if (at === -1) continue;
    const para = [];
    for (let j = at + 1; j < lines.length; j++) {
      if (/^#{1,6}\s/.test(lines[j])) break;
      if (!lines[j].trim()) {
        if (para.length) break;
        continue;
      }
      para.push(lines[j].trim());
    }
    summary = stripInline(para.join(' '));
    if (summary) break;
  }
  if (!summary) {
    const first = body.split(/\n\s*\n/).find((p) => p.trim() && !/^(#|```|\||>|[-*] |\d+\. )/.test(p.trim()));
    summary = stripInline((first ?? '').replace(/\s+/g, ' ').trim());
  }

  return { title, slug: slugify(title), facts, body, status, summary, file };
}
