// Block-level Markdown → HTML for the long documents (architectures, patterns,
// decisions, use-case notes). It covers what those files use: headings, paragraphs
// with hard breaks, nested lists, GFM tables, fenced code, Mermaid diagrams,
// blockquotes and rules. Inline syntax is delegated to markdown.mjs.

import { escapeHtml, renderInline, stripInline } from './markdown.mjs';

// GitHub's heading anchors, so in-document links like (#51-foundations) keep working.
export const headingSlug = (text) =>
  stripInline(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .trim()
    .replace(/\s/g, '-');

const FENCE = /^(\s*)(`{3,})\s*([\w+-]*)\s*$/;
const HEADING = /^(#{1,6})\s+(.+?)\s*#*\s*$/;
const RULE = /^\s{0,3}([-*_])(\s*\1){2,}\s*$/;
const BULLET = /^(\s*)([-*+])\s+(.*)$/;
const ORDERED = /^(\s*)(\d+)[.)]\s+(.*)$/;
const TABLE_SEP = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;

const splitRow = (line) => {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
  const cells = [];
  let cur = '';
  let inCode = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '`') inCode = !inCode;
    if (ch === '\\' && s[i + 1] === '|') {
      cur += '|';
      i++;
    } else if (ch === '|' && !inCode) {
      cells.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  cells.push(cur.trim());
  return cells;
};

export function splitTableRow(line) {
  return splitRow(line);
}

/**
 * @param {string} source
 * @param {{resolveUrl?: (u: string) => string, startLine?: number}} [opts]
 * @returns {{html: string, headings: {level:number,text:string,id:string}[], diagrams: number}}
 */
export function renderDocument(source, { resolveUrl } = {}) {
  const inline = (t) => renderInline(t, { resolveUrl });
  const headings = [];
  const used = new Map();
  let diagrams = 0;

  const uniqueId = (text) => {
    const base = headingSlug(text) || 'section';
    const n = used.get(base) ?? 0;
    used.set(base, n + 1);
    return n ? `${base}-${n}` : base;
  };

  // A paragraph's lines are joined; "\" or two trailing spaces force a break.
  const paragraph = (lines) =>
    inline(
      lines
        .map((l, i) => {
          const last = i === lines.length - 1;
          if (!last && /\\$/.test(l)) return `${l.replace(/\\$/, '').trimEnd()}\u0001`;
          if (!last && / {2,}$/.test(l)) return `${l.trimEnd()}\u0001`;
          return l.trim();
        })
        .join('\n')
        .replace(/\u0001\n?/g, '\u0001')
        .replace(/\n/g, ' '),
    ).replace(/\u0001/g, '<br>');

  function blocks(lines) {
    const out = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (!line.trim()) {
        i++;
        continue;
      }

      const fence = line.match(FENCE);
      if (fence) {
        const [, indent, ticks, lang] = fence;
        const body = [];
        i++;
        while (i < lines.length && !new RegExp(`^\\s*${ticks}\`*\\s*$`).test(lines[i])) {
          body.push(lines[i].startsWith(indent) ? lines[i].slice(indent.length) : lines[i]);
          i++;
        }
        i++; // closing fence
        const code = body.join('\n');
        if (lang === 'mermaid') {
          diagrams++;
          out.push(
            `<figure class="diagram"><pre class="mermaid" data-diagram>${escapeHtml(code)}</pre><figcaption class="sr">Diagram</figcaption></figure>`,
          );
        } else {
          out.push(`<pre class="code"${lang ? ` data-lang="${escapeHtml(lang)}"` : ''}><code>${escapeHtml(code)}</code></pre>`);
        }
        continue;
      }

      if (/^\s*<!--/.test(line)) {
        while (i < lines.length && !/-->/.test(lines[i])) i++;
        i++;
        continue;
      }

      const h = line.match(HEADING);
      if (h) {
        const level = h[1].length;
        const text = h[2];
        const id = uniqueId(text);
        headings.push({ level, text: stripInline(text), id });
        out.push(`<h${level} id="${id}"><a class="anchor" href="#${id}" aria-label="Link to this section">#</a>${inline(text)}</h${level}>`);
        i++;
        continue;
      }

      if (RULE.test(line)) {
        out.push('<hr>');
        i++;
        continue;
      }

      if (/^\s*>/.test(line)) {
        const inner = [];
        while (i < lines.length && /^\s*>/.test(lines[i])) inner.push(lines[i++].replace(/^\s*> ?/, ''));
        out.push(`<blockquote>${blocks(inner)}</blockquote>`);
        continue;
      }

      if (line.includes('|') && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1]) && lines[i + 1].includes('-')) {
        const head = splitRow(line);
        const align = splitRow(lines[i + 1]).map((c) => (/^:-+:$/.test(c) ? 'center' : /-:$/.test(c) ? 'right' : ''));
        i += 2;
        const rows = [];
        while (i < lines.length && lines[i].trim() && lines[i].includes('|')) rows.push(splitRow(lines[i++]));
        const cell = (tag, c, n) => `<${tag}${align[n] ? ` style="text-align:${align[n]}"` : ''}>${inline(c)}</${tag}>`;
        out.push(
          `<div class="table-wrap"><table><thead><tr>${head.map((c, n) => cell('th', c, n)).join('')}</tr></thead><tbody>${rows
            .map((r) => `<tr>${head.map((_, n) => cell('td', r[n] ?? '', n)).join('')}</tr>`)
            .join('')}</tbody></table></div>`,
        );
        continue;
      }

      const li = line.match(BULLET) ?? line.match(ORDERED);
      if (li) {
        const [html, next] = list(lines, i);
        out.push(html);
        i = next;
        continue;
      }

      // Paragraph: runs until a blank line or the start of another block.
      const para = [];
      while (
        i < lines.length &&
        lines[i].trim() &&
        !FENCE.test(lines[i]) &&
        !HEADING.test(lines[i]) &&
        !/^\s*>/.test(lines[i]) &&
        !RULE.test(lines[i]) &&
        !(para.length && (BULLET.test(lines[i]) || ORDERED.test(lines[i])))
      ) {
        para.push(lines[i++]);
      }
      out.push(`<p>${paragraph(para)}</p>`);
    }
    return out.join('\n');
  }

  // A list starts at lines[start]; nested lists are items indented deeper than the marker.
  function list(lines, start) {
    const first = lines[start].match(BULLET) ?? lines[start].match(ORDERED);
    const ordered = Boolean(lines[start].match(ORDERED)) && !lines[start].match(BULLET);
    const baseIndent = first[1].length;
    const items = [];
    let i = start;

    while (i < lines.length) {
      const m = (lines[i].match(BULLET) ?? lines[i].match(ORDERED));
      if (!m || m[1].length !== baseIndent || Boolean(lines[i].match(ORDERED)) !== ordered) break;
      const text = [m[3]];
      const nested = [];
      i++;
      while (i < lines.length) {
        const l = lines[i];
        if (!l.trim()) {
          // A blank line continues the item only if an indented line follows.
          const nxt = lines.slice(i + 1).find((x) => x.trim());
          if (nxt && /^\s+\S/.test(nxt) && nxt.search(/\S/) > baseIndent) {
            nested.push('');
            i++;
            continue;
          }
          break;
        }
        const indent = l.search(/\S/);
        if (indent <= baseIndent) break;
        nested.push(l);
        i++;
      }
      // Continuation text before the first nested block belongs to the item's paragraph.
      const cut = nested.findIndex((l) => BULLET.test(l) || ORDERED.test(l) || FENCE.test(l));
      const cont = cut === -1 ? nested : nested.slice(0, cut);
      const sub = cut === -1 ? [] : nested.slice(cut);
      const body = [...text, ...cont.map((l) => l.trim()).filter(Boolean)];
      const subHtml = sub.length ? blocks(dedent(sub)) : '';
      items.push(`<li>${paragraph(body)}${subHtml}</li>`);
    }
    const tag = ordered ? 'ol' : 'ul';
    const startAttr = ordered && Number(first[2]) !== 1 ? ` start="${first[2]}"` : '';
    return [`<${tag}${startAttr}>${items.join('')}</${tag}>`, i];
  }

  function dedent(ls) {
    const min = Math.min(...ls.filter((l) => l.trim()).map((l) => l.search(/\S/)));
    return ls.map((l) => l.slice(Math.min(min, l.length)));
  }

  let html = blocks(source.replace(/\r\n?/g, '\n').split('\n'));

  // A link to a heading that does not exist (it is dead on GitHub too) reads as plain text.
  const ids = new Set(headings.map((h) => h.id));
  html = html.replace(/<a href="#([^"]*)">([^<]*)<\/a>/g, (m, id, text) =>
    ids.has(decodeURIComponent(id)) || id === '' || m.includes('class="anchor"') ? m : text,
  );
  return { html, headings, diagrams };
}
