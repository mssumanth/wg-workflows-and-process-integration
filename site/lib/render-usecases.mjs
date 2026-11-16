// Pages for the critical-use-cases workstream: a filterable index and one page
// per use case, all generated from use-case-inventory.md.

import { escapeHtml as esc, renderInline, stripInline } from './markdown.mjs';
import { ROOT } from './autolink.mjs';
import { DIMENSIONS } from './parse-usecases.mjs';
import { hue, page, searchIcon } from './layout.mjs';

// Dimensions offered as filters on the index (Coordination stays on the page).
const FILTERS = [
  ['hitl', 'Human in the loop'],
  ['agents', 'Agent count'],
  ['pattern', 'Workflow pattern'],
  ['trigger', 'Trigger'],
];

const FOOTNOTE_TEXT = 'Kept with reasonable confidence; the rationale is not yet written in Notes.';

const value = (v) =>
  `${esc(v.label)}${v.qualifier ? ` <span class="qual">(${esc(v.qualifier)})</span>` : ''}${
    v.footnote ? `<sup class="fn" title="${esc(FOOTNOTE_TEXT)}">${v.footnote}</sup>` : ''
  }`;

const searchText = (u) =>
  [u.name, u.category.name, stripInline(u.description), ...u.tools, u.failure, ...DIMENSIONS.map(([k]) => u[k].full), stripInline(u.notes)]
    .join(' ')
    .toLowerCase();

/* ----------------------------------------------------------------- index */

export function renderUseCases(ctx) {
  const { inventory, config, gh } = ctx;
  const { categories, useCases } = inventory;

  const counts = (key) => {
    const m = new Map();
    useCases.forEach((u) => m.set(u[key].label, (m.get(u[key].label) ?? 0) + 1));
    return [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  };

  const filterGroup = ([key, title]) => `      <fieldset class="fgroup" data-filter="${key}">
        <legend>${esc(title)}</legend>
        <div class="chips">${counts(key)
          .map(
            ([label, n]) =>
              `<button type="button" class="chip toggle" data-value="${esc(label)}" aria-pressed="false">${esc(label)}<span class="n">${n}</span></button>`,
          )
          .join('')}</div>
      </fieldset>`;

  const chips = categories
    .map((c) => `<a class="chip" href="#cat-${c.slug}" style="--h:${hue(c)}"><span class="dot"></span>${esc(c.name)}<span class="n">${c.useCases.length}</span></a>`)
    .join('\n');

  const tag = (u, key) => `<span class="tag-chip" data-dim="${key}">${value(u[key])}</span>`;

  const sections = categories
    .map(
      (c) => `<section class="cat" id="cat-${c.slug}" style="--h:${hue(c)}" data-cat>
  <div class="cat-head"><span class="dot"></span><h2>${esc(c.name)}</h2><span class="count">${c.useCases.length}</span></div>
  <ul class="terms uc-list">
${c.useCases
  .map(
    (u) => `    <li class="term uc" data-search="${esc(searchText(u))}"${FILTERS.map(([k]) => ` data-${k}="${esc(u[k].label)}"`).join('')}>
      <h3 class="term-name"><a href="${ROOT}use-cases/${u.slug}/">${esc(u.name)}</a></h3>
      <div class="uc-body">
        <p class="term-def">${renderInline(u.description)}</p>
        <p class="uc-tags">${tag(u, 'hitl')}${tag(u, 'agents')}${tag(u, 'pattern')}</p>
      </div>
    </li>`,
  )
  .join('\n')}
  </ul>
</section>`,
    )
    .join('\n');

  const body = `<section class="hero">
  <div class="wrap">
    <p class="eyebrow">Critical use cases</p>
    <h1>Real agentic workflows, classified.</h1>
    <p class="lede">${useCases.length} workflows across ${categories.length} industries and functions, each described the same way, so you can find one shaped like yours and see what it needed.</p>
    <form class="search" role="search" onsubmit="return false">
      ${searchIcon}
      <label class="sr" for="uq">Search use cases</label>
      <input id="uq" type="search" placeholder="Search ${useCases.length} use cases" autocomplete="off" spellcheck="false">
      <kbd aria-hidden="true">/</kbd>
    </form>
    <p class="status"><span class="status-label">Draft</span>A starting inventory, not a ranked list. Classifications are open to challenge.</p>
  </div>
</section>

<div class="wrap" id="use-cases">
  <nav class="chips" aria-label="Jump to a category">
${chips}
  </nav>

  <details class="filters" id="filters" hidden>
    <summary><span>Filter by how a workflow is built</span><span class="filters-n" id="filters-n"></span></summary>
    <div class="fgrid">
${FILTERS.map(filterGroup).join('\n')}
    </div>
    <p class="fine"><button type="button" class="linklike" id="filters-clear">Clear filters</button> · <a href="${ROOT}use-cases/classification/">How the classification works</a></p>
  </details>

  <p id="uc-count" class="result-count" role="status" aria-live="polite"></p>
${sections}
  <div id="uc-empty" class="empty" hidden>
    <p class="empty-title">No use case matches.</p>
    <p>Missing the one you work on? <a class="more" href="${ROOT}use-cases/about/#how-to-contribute">Add it to the inventory</a></p>
  </div>
</div>

<section class="band" aria-labelledby="about-h">
  <div class="wrap">
    <p class="eyebrow">About the inventory</p>
    <h2 id="about-h" class="section-title">Breadth of pattern, not completeness.</h2>
    <p class="lede">It documents what the agent does and how it coordinates, not how the model works. Named products are examples of a kind of system, not recommendations.</p>
    <p class="btn-row"><a class="btn btn-secondary" href="${ROOT}use-cases/about/">Read how it was built</a><a class="btn btn-secondary" href="${ROOT}use-cases/classification/">The classification schema</a></p>
  </div>
</section>

<section class="cta">
  <div class="wrap">
    <h2 class="section-title">Know a workflow that isn’t here?</h2>
    <p class="lede">Each row is one distinct workflow, with its tools, human checkpoints and the way it fails. A row template and guidelines are in the inventory.</p>
    <p class="btn-row"><a class="btn btn-primary" href="${ROOT}use-cases/about/#how-to-contribute">Add a use case</a><a class="btn btn-secondary" href="${gh.blob(config.useCasesPath)}" target="_blank" rel="noopener">Open the inventory on GitHub</a></p>
  </div>
</section>`;

  return page({
    ctx,
    root: '../',
    title: 'Use cases · AAIF Workflows & Process Integration',
    description: `${useCases.length} real agentic workflows across ${categories.length} categories, classified by trigger, human checkpoint, agent count, coordination and workflow pattern.`,
    active: 'use-cases',
    body,
  });
}

/* ------------------------------------------------------------- one case */

export function renderUseCase(ctx, u, { prev, next }) {
  const { inventory, config, gh } = ctx;
  const resolveUrl = ctx.resolveInventoryUrl;
  const inline = (t) => renderInline(t, { resolveUrl });
  const siblings = u.category.useCases.filter((x) => x !== u);
  const hasFootnote = [...DIMENSIONS.map(([k]) => u[k]), u.duration].some((v) => v.footnote);

  const issue = gh.issue({
    title: `Use cases: correction to “${u.name}”`,
    body: `**Use case:** ${u.name}\n**Category:** ${u.category.name}\n**Source:** ${gh.blob(config.useCasesPath, u.line)}\n\n### What is wrong or missing\n<!-- A classification you disagree with, a better source, a missing tool or failure mode… -->\n\n### Evidence\n<!-- Link a reference deployment, spec or write-up. -->\n`,
    labels: 'use-cases',
  });

  const rows = DIMENSIONS.map(([k, label]) => `<div><dt>${esc(label)}</dt><dd>${value(u[k])}</dd></div>`).join('\n');

  const body = `<article class="term-page uc-page" style="--h:${hue(u.category)}">
  <div class="wrap narrow">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="${ROOT}use-cases/">Use cases</a><span aria-hidden="true">/</span><a href="${ROOT}use-cases/#cat-${u.category.slug}">${esc(u.category.name)}</a></nav>
    <p class="eyebrow"><span class="dot"></span>${esc(u.category.name)}</p>
    <h1>${esc(u.name)}</h1>
    <p class="definition">${inline(u.description)}</p>
    <p class="uc-tags big">${['hitl', 'agents', 'pattern'].map((k) => `<span class="tag-chip" data-dim="${k}">${value(u[k])}</span>`).join('')}</p>
  </div>

  <div class="band">
    <div class="wrap narrow">
      <section class="card" aria-labelledby="class-h">
        <h2 id="class-h">How it’s classified</h2>
        <dl class="facts">
${rows}
          <div><dt>Duration</dt><dd>${value(u.duration)}</dd></div>
        </dl>
        ${hasFootnote ? `<p class="fine fn-note"><sup class="fn">¹</sup> ${esc(FOOTNOTE_TEXT)}</p>` : ''}
        <p class="fine"><a href="${ROOT}use-cases/classification/">How each dimension is defined</a></p>
      </section>

      <div class="two">
        <section class="card" aria-labelledby="tools-h">
          <h2 id="tools-h">Tools &amp; systems</h2>
          ${u.tools.length ? `<ul class="plain">${u.tools.map((t) => `<li>${inline(t)}</li>`).join('')}</ul>` : '<p class="muted">None listed.</p>'}
        </section>
        <section class="card risk" aria-labelledby="risk-h">
          <h2 id="risk-h">Key failure mode</h2>
          <p>${inline(u.failureRaw.replace(/^_(.*)_$/, '$1'))}</p>
          <h3>Preconditions</h3>
          <p>${u.preconditions ? inline(u.preconditions) : '<span class="muted">None recorded.</span>'}</p>
        </section>
      </div>

      ${
        u.notes
          ? `<section class="card" aria-labelledby="notes-h">
        <h2 id="notes-h">Notes &amp; sources</h2>
        <p>${inline(u.notes)}</p>
      </section>`
          : ''
      }

      <section class="card" aria-labelledby="imp-h">
        <h2 id="imp-h">Improve this use case</h2>
        <ul class="actions">
          <li><a href="${issue}" target="_blank" rel="noopener"><strong>Suggest a correction</strong><span>Opens a GitHub issue with the row already referenced</span></a></li>
          <li><a href="${gh.edit(config.useCasesPath)}" target="_blank" rel="noopener"><strong>Edit on GitHub</strong><span>Change the row and open a pull request</span></a></li>
          <li><a href="${gh.blob(config.useCasesPath, u.line)}" target="_blank" rel="noopener"><strong>View source</strong><span>Inventory, line ${u.line}</span></a></li>
        </ul>
        <button class="btn btn-secondary" type="button" data-copy-url>Copy link to this use case</button>
      </section>

      ${
        siblings.length
          ? `<section class="card" aria-labelledby="more-h">
        <h2 id="more-h">More in ${esc(u.category.name)}</h2>
        <div class="chips">${siblings.map((s) => `<a class="chip" href="${ROOT}use-cases/${s.slug}/">${esc(s.name)}</a>`).join('')}</div>
      </section>`
          : ''
      }

      <nav class="pager" aria-label="Neighbouring use cases">
        ${prev ? `<a class="prev" href="${ROOT}use-cases/${prev.slug}/"><span>Previous</span><strong>${esc(prev.name)}</strong></a>` : '<span></span>'}
        ${next ? `<a class="next" href="${ROOT}use-cases/${next.slug}/"><span>Next</span><strong>${esc(next.name)}</strong></a>` : '<span></span>'}
      </nav>
    </div>
  </div>
</article>`;

  return page({
    ctx,
    root: '../../',
    title: `${u.name} · Use cases · AAIF Workflows & Process Integration`,
    description: stripInline(u.description).slice(0, 200),
    active: 'use-cases',
    body,
  });
}
