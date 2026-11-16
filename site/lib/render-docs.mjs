// Pages for the reference-architectures workstream: the index and one page per
// document (architecture, pattern, decision, principles, background).

import { escapeHtml as esc, renderInline, stripInline } from './markdown.mjs';
import { renderDocument } from './markdown-doc.mjs';
import { ROOT } from './autolink.mjs';
import { page } from './layout.mjs';

const KIND = {
  about: { label: 'Document', plural: 'Use cases', hue: 28 },
  architecture: { label: 'Reference architecture', plural: 'Reference architectures', hue: 212 },
  pattern: { label: 'Pattern', plural: 'Patterns', hue: 262 },
  decision: { label: 'Decision note', plural: 'Decision notes', hue: 28 },
  principles: { label: 'Principles', plural: 'Principles', hue: 150 },
  background: { label: 'Background', plural: 'Background reading', hue: 330 },
};
export const kindInfo = KIND;

const issueFor = (ctx, d, type) => {
  const { gh } = ctx;
  const src = gh.blob(d.path);
  const what = KIND[d.kind].label.toLowerCase();
  const head = `**Document:** ${d.title}\n**Source:** ${src}\n`;
  const body =
    type === 'comment'
      ? `${head}\n### Section\n<!-- Which heading or sentence is this about? -->\n\n### What I noticed\n<!-- Unclear, missing, inconsistent with another document, or wrong? -->\n\n### Suggestion\n<!-- Optional: the wording or structure you would use instead. -->\n`
      : `${head}\n### Where this ${what} did not fit\n<!-- Describe the use case or workflow and what you could not express. -->\n\n### What would have helped\n`;
  return gh.issue({
    title: type === 'comment' ? `${d.issuePrefix ?? 'Reference architectures'}: feedback on “${d.title}”` : `Reference architectures: “${d.title}” did not fit my workflow`,
    body,
    labels: d.issueLabel ?? 'reference-architecture',
  });
};

const factHtml = (f, inline) => `<div><dt>${esc(f.label)}</dt><dd>${inline(f.value)}</dd></div>`;

/* ----------------------------------------------------------------- index */

export function renderArchitectures(ctx) {
  const { docs, config, gh } = ctx;
  const byKind = (k) => docs.filter((d) => d.kind === k);
  const pill = (d) => (d.status ? `<span class="status-label">${esc(d.status.split(/[.—]/)[0].trim())}</span>` : '');
  const inline = (d) => (t) => renderInline(t, { resolveUrl: d.resolveUrl });
  const linkTo = (d) => `${ROOT}${d.url}`;

  const factOf = (d, ...labels) => d.facts.find((f) => labels.includes(f.label));

  const archCard = (d) => {
    const job = factOf(d, 'The job it serves');
    const patterns = factOf(d, 'Built from patterns');
    return `    <li class="card arch" style="--h:${KIND.architecture.hue}">
      <p class="eyebrow">${pill(d)}</p>
      <h3><a href="${linkTo(d)}">${esc(d.title)}</a></h3>
      <p class="arch-job">${job ? inline(d)(job.value) : esc(d.summary)}</p>
      ${patterns ? `<p class="arch-from"><span>Built from</span> ${inline(d)(patterns.value.replace(/\s*·\s*/g, ' · '))}</p>` : ''}
      <p class="way-action"><a class="more" href="${linkTo(d)}">See the architecture</a></p>
    </li>`;
  };

  const patternCard = (d) => {
    const solves = factOf(d, 'Solves');
    return `    <li class="card pat" style="--h:${KIND.pattern.hue}">
      <h3><a href="${linkTo(d)}">${esc(d.title)}</a></h3>
      <p>${solves ? inline(d)(solves.value) : esc(d.summary)}</p>
    </li>`;
  };

  const row = (d) => `    <li><a href="${linkTo(d)}"><strong>${esc(d.title)}</strong><span>${esc(d.summary.length > 140 ? `${d.summary.slice(0, 137).trimEnd()}…` : d.summary)}</span></a></li>`;

  const groups = [
    ['decision', 'Decisions'],
    ['principles', 'Principles'],
    ['background', 'Background reading'],
  ]
    .map(([k, title]) => ({ k, title, items: byKind(k) }))
    .filter((g) => g.items.length);

  const body = `<section class="hero compact">
  <div class="wrap">
    <p class="eyebrow">Reference architectures</p>
    <h1>How agentic workflows are put together.</h1>
    <p class="lede">Organised around the <em>job</em> a practitioner needs done, not agent count. Each architecture shows the components, the boundaries and the guarantees; each pattern solves one recurring sub-problem.</p>
    <p class="status"><span class="status-label">Draft</span>Everything here is proposed for working group review. Nothing is locked.</p>
  </div>
</section>

<div class="wrap">
  <section class="how" aria-label="How to read these documents">
    <div><h3>Reference architecture</h3><p>A complete composition for a job you’d describe as “we’re building a ___”: patterns, capabilities, boundaries, guarantees and exit states.</p></div>
    <div><h3>Pattern</h3><p>One recurring sub-problem with its own invariants and failure modes. Adopt it alone or compose it into several architectures.</p></div>
    <div><h3>Use case</h3><p>Tests whether an architecture fits real work. <a href="${ROOT}use-cases/">Browse the inventory</a>.</p></div>
  </section>

  <section class="cat" id="architectures" style="--h:${KIND.architecture.hue}">
    <div class="cat-head"><span class="dot"></span><h2>Reference architectures</h2><span class="count">${byKind('architecture').length}</span></div>
    <ul class="cards two-up">
${byKind('architecture').map(archCard).join('\n')}
    </ul>
  </section>

  <section class="cat" id="patterns" style="--h:${KIND.pattern.hue}">
    <div class="cat-head"><span class="dot"></span><h2>Patterns</h2><span class="count">${byKind('pattern').length}</span></div>
    <ul class="cards three-up">
${byKind('pattern').map(patternCard).join('\n')}
    </ul>
  </section>

${groups
  .map(
    (g) => `  <section class="cat" id="${g.k}" style="--h:${KIND[g.k].hue}">
    <div class="cat-head"><span class="dot"></span><h2>${esc(g.title)}</h2><span class="count">${g.items.length}</span></div>
    <ul class="doc-list">
${g.items.map(row).join('\n')}
    </ul>
  </section>`,
  )
  .join('\n\n')}
</div>

<section class="cta">
  <div class="wrap">
    <h2 class="section-title">Does it fit your workflow?</h2>
    <p class="lede">The architectures are only as good as the real workflows they have been tried against. Tell us where one fit, where it didn’t, and what was missing.</p>
    <p class="btn-row"><a class="btn btn-primary" href="${gh.issue({ title: 'Reference architectures: where an architecture did or did not fit', body: '### My workflow\n\n### Architecture or pattern I tried\n\n### Where it fit\n\n### Where it did not\n', labels: 'reference-architecture' })}" target="_blank" rel="noopener">Share how it fit</a><a class="btn btn-secondary" href="${gh.blob(config.archPath)}" target="_blank" rel="noopener">Read the workstream README</a></p>
  </div>
</section>`;

  return page({
    ctx,
    root: '../',
    title: 'Reference architectures · AAIF Workflows & Process Integration',
    description: 'Job-oriented reference architectures and reusable patterns for agentic AI workflows, from the AAIF Workflows and Process Integration Working Group.',
    active: 'architectures',
    body,
  });
}

/* ------------------------------------------------------------- one doc */

// d: a document with .html, .headings, .facts, .status, .kind, .url, .path, .resolveUrl
export function renderDoc(ctx, d, { siblings = [], backTo = null } = {}) {
  const { gh } = ctx;
  const info = KIND[d.kind];
  const root = '../'.repeat(d.url.split('/').filter(Boolean).length);
  const inline = (t) => renderInline(t, { resolveUrl: d.resolveUrl });

  const [lead, ...restFacts] = d.facts;
  // Documents that use "#" for their sections get those as the top of the outline.
  const top = d.headings.some((h) => h.level === 1) ? 1 : 2;
  const toc = d.headings.filter((h) => h.level === top || h.level === top + 1);
  const idx = siblings.findIndex((s) => s.slug === d.slug);
  const prev = idx > 0 ? siblings[idx - 1] : null;
  const next = idx !== -1 && idx < siblings.length - 1 ? siblings[idx + 1] : null;
  const section = d.section ?? { href: `${ROOT}architectures/`, label: 'Architectures' };
  const back = backTo ?? { href: `${ROOT}architectures/#${d.kind === 'architecture' ? 'architectures' : d.kind === 'pattern' ? 'patterns' : d.kind}`, label: info.plural };

  const body = `<article class="doc" style="--h:${info.hue}">
  <div class="wrap">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="${section.href}">${esc(section.label)}</a>${d.section ? '' : `<span aria-hidden="true">/</span><a href="${back.href}">${esc(back.label)}</a>`}</nav>
    <p class="eyebrow"><span class="dot"></span>${esc(d.eyebrow ?? info.label)}</p>
    <h1>${esc(d.title)}</h1>
    ${lead ? `<p class="definition">${inline(lead.value)}</p>` : ''}
    ${d.status || d.statusLabel ? `<p class="status"><span class="status-label">${esc(d.statusLabel ?? d.status.split(/[.—]/)[0].trim())}</span>${esc(d.statusNote ?? d.status.split(/(?<=\.)\s+/).slice(1).join(' '))}</p>` : ''}
  </div>

  <div class="wrap doc-grid">
    <div class="doc-main">
      ${restFacts.length ? `<dl class="facts doc-facts card">${restFacts.map((f) => factHtml(f, inline)).join('\n')}</dl>` : ''}
      <div class="prose">
${d.html}
      </div>

      <section class="card improve" aria-labelledby="imp-h">
        <h2 id="imp-h">Improve this ${esc(info.label.toLowerCase())}</h2>
        <ul class="actions">
          <li><a href="${issueFor(ctx, d, 'comment')}" target="_blank" rel="noopener"><strong>Comment on it</strong><span>Opens a GitHub issue with this document already referenced</span></a></li>
          <li><a href="${gh.edit(d.path)}" target="_blank" rel="noopener"><strong>Edit on GitHub</strong><span>Propose the exact wording as a pull request</span></a></li>
          ${d.kind === 'architecture' || d.kind === 'pattern' ? `<li><a href="${issueFor(ctx, d, 'fit')}" target="_blank" rel="noopener"><strong>It didn’t fit my workflow</strong><span>Tell the group where this fell short</span></a></li>` : ''}
          <li><a href="${gh.blob(d.path)}" target="_blank" rel="noopener"><strong>View source</strong><span><code>${esc(d.path.split('/').slice(-2).join('/'))}</code></span></a></li>
        </ul>
        <button class="btn btn-secondary" type="button" data-copy-url>Copy link to this page</button>
      </section>

      ${
        prev || next
          ? `<nav class="pager" aria-label="Neighbouring documents">
        ${prev ? `<a class="prev" href="${ROOT}${prev.url}"><span>Previous</span><strong>${esc(prev.title)}</strong></a>` : '<span></span>'}
        ${next ? `<a class="next" href="${ROOT}${next.url}"><span>Next</span><strong>${esc(next.title)}</strong></a>` : '<span></span>'}
      </nav>`
          : ''
      }
    </div>

    ${
      toc.length > 2
        ? `<aside class="toc" aria-label="On this page">
      <p class="toc-title">On this page</p>
      <ol>
${toc.map((h) => `        <li class="l${h.level - top + 2}"><a href="#${h.id}">${esc(h.text)}</a></li>`).join('\n')}
      </ol>
    </aside>`
        : ''
    }
  </div>
</article>`;

  return page({
    ctx,
    root,
    title: `${d.title} · AAIF Workflows & Process Integration`,
    description: `${d.title}. ${d.summary}`.slice(0, 200),
    active: d.active ?? 'architectures',
    body,
    mermaid: d.diagrams > 0,
  });
}
