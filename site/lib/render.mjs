import { escapeHtml as esc, renderInline, stripInline } from './markdown.mjs';
import { ROOT } from './autolink.mjs';
import { findField } from './parse-terms.mjs';
import { aliasesOf, hasScope, hue, page, searchIcon, searchText } from './layout.mjs';

/* ------------------------------------------------------------ scope band */

// The charter's in-scope and out-of-scope lists, parsed at build time so the
// site cannot drift from them.
function scopeBand({ scope, config, gh }, { title, lede }) {
  if (!scope.inScope.length) return '';
  return `<section class="band" id="scope" aria-labelledby="scope-h">
  <div class="wrap">
    <p class="eyebrow">Scope</p>
    <h2 id="scope-h" class="section-title">${esc(title)}</h2>
    <p class="lede">${esc(lede)}</p>
    <div class="scope-grid">
      <div class="card">
        <h3>In scope</h3>
        <ol class="scope-list">
${scope.inScope.map((s) => `          <li><span class="badge" aria-hidden="true">${esc(s.id)}</span>${esc(s.title)}</li>`).join('\n')}
        </ol>
      </div>
      <div class="card">
        <h3>Handled elsewhere</h3>
        <ul class="plain">
${scope.outOfScope.map((s) => `          <li>${renderInline(s)}</li>`).join('\n')}
        </ul>
      </div>
    </div>
    <p class="more-row"><a class="more" href="${gh.blob(config.charterPath)}#3-scope">Read the full charter</a></p>
  </div>
</section>`;
}

/* --------------------------------------------------------------- landing */

export function renderLanding(ctx) {
  const { doc, docs, inventory, readme, config } = ctx;
  const archs = docs.filter((d) => d.kind === 'architecture');
  const patterns = docs.filter((d) => d.kind === 'pattern');
  const names = (list, n) => list.slice(0, n).map((x) => x.name ?? x.title);

  const cards = [
    {
      key: 'terms',
      href: `${ROOT}terms/`,
      n: doc.terms.length,
      unit: 'terms',
      title: 'Taxonomy',
      text: `Shared definitions for the words the group keeps using, such as ${names(doc.terms, 3).join(', ')}.`,
      sub: `${doc.categories.length} categories`,
      action: 'Browse the taxonomy',
      hue: 212,
    },
    {
      key: 'arch',
      href: `${ROOT}architectures/`,
      n: archs.length,
      unit: archs.length === 1 ? 'reference architecture' : 'reference architectures',
      title: 'Reference architectures',
      text: `How the pieces fit together, drawn at component level: ${names(archs, 2).join(' and ').toLowerCase()}.`,
      sub: `${patterns.length} reusable patterns`,
      action: 'See the architectures',
      hue: 262,
    },
    {
      key: 'uc',
      href: `${ROOT}use-cases/`,
      n: inventory.useCases.length,
      unit: 'use cases',
      title: 'Critical use cases',
      text: 'Real agentic workflows, each classified by trigger, human checkpoint, agent count, coordination and shape.',
      sub: `${inventory.categories.length} industries and functions`,
      action: 'Explore the use cases',
      hue: 28,
    },
  ];

  const body = `<section class="hero">
  <div class="wrap">
    <p class="eyebrow">Agentic AI Foundation · Working Group</p>
    <h1>Workflows &amp; Process Integration.</h1>
    <p class="lede">A shared vocabulary, reference architectures and a catalogue of real use cases for agentic AI workflows.</p>
    <p class="btn-row"><a class="btn btn-primary" href="${ROOT}terms/">Start with the taxonomy</a><a class="btn btn-secondary" href="${ROOT}contribute/">Contribute</a></p>
    <p class="status"><span class="status-label">In review</span>Work in progress. Definitions and designs are drafts for working group discussion.</p>
  </div>
</section>

<div class="wrap">
  <ul class="workstreams">
${cards
  .map(
    (c) => `    <li class="card ws" style="--h:${c.hue}">
      <p class="ws-stat"><strong>${c.n}</strong> ${esc(c.unit)}</p>
      <h2><a href="${c.href}">${esc(c.title)}</a></h2>
      <p>${esc(c.text)}</p>
      <p class="fine">${esc(c.sub)}</p>
      <p class="way-action"><a class="more" href="${c.href}">${esc(c.action)}</a></p>
    </li>`,
  )
  .join('\n')}
  </ul>
</div>

${
  readme.mission
    ? `<section class="band" aria-labelledby="mission-h">
  <div class="wrap">
    <p class="eyebrow">Mission</p>
    <h2 id="mission-h" class="section-title">Why the group exists.</h2>
    <p class="lede">${renderInline(readme.mission)}</p>
  </div>
</section>`
    : ''
}

${scopeBand(ctx, {
  title: 'What the charter covers.',
  lede: 'The areas the Working Group works on, and the ones that belong to other groups.',
})}

<section class="cta">
  <div class="wrap">
    <h2 class="section-title">Join in. It’s open.</h2>
    <p class="lede">${renderInline(readme.meetings || 'The group meets every other week and is open to the public.')} Nothing here is final until the group says so.</p>
    <p class="btn-row"><a class="btn btn-primary" href="${ROOT}contribute/">Ways to contribute</a><a class="btn btn-secondary" href="${config.community.discord}" target="_blank" rel="noopener">Discord</a><a class="btn btn-secondary" href="${config.community.mailingList}" target="_blank" rel="noopener">Mailing list</a></p>
  </div>
</section>`;

  return page({
    ctx,
    root: './',
    title: 'Workflows & Process Integration · Agentic AI Foundation',
    description: 'Taxonomy, reference architectures and critical use cases for agentic AI workflows, from the AAIF Workflows and Process Integration Working Group.',
    active: 'home',
    body,
  });
}

/* ------------------------------------------------------------------ home */

// Everything else the page knows about a term. Hidden in the list until a
// search is active, then shown (with matches highlighted) by app.js.
function termDetail(t) {
  const rows = [
    `<div><dt>Category</dt><dd>${esc(t.category.name)}</dd></div>`,
    ...t.fields.map((f) => `<div><dt>${esc(f.label)}</dt><dd>${f.html}</dd></div>`),
  ].join('\n');
  const notes = t.notesHtml.map((h) => `<p class="note">${h}</p>`).join('\n');
  const gap = hasScope(t) ? '' : `<p class="detail-gap">No scope note yet.</p>`;
  return `${notes}\n<dl class="facts">\n${rows}\n</dl>\n${gap}`;
}

export function renderTerms(ctx) {
  const { doc, scope, config, gh } = ctx;
  const n = doc.terms.length;
  const c = doc.categories.length;

  const chips = doc.categories
    .map(
      (cat) =>
        `<a class="chip" href="#cat-${cat.slug}" style="--h:${hue(cat)}"><span class="dot"></span>${esc(cat.name)}<span class="n">${cat.terms.length}</span></a>`,
    )
    .join('\n');

  const sections = doc.categories
    .map(
      (cat) => `<section class="cat" id="cat-${cat.slug}" style="--h:${hue(cat)}" data-cat>
  <div class="cat-head"><span class="dot"></span><h2>${esc(cat.name)}</h2><span class="count">${cat.terms.length}</span></div>
  <ul class="terms">
${cat.terms
  .map(
    (t) => `    <li class="term" data-search="${esc(searchText(t))}">
      <h3 class="term-name"><a href="${ROOT}terms/${t.slug}/">${esc(t.name)}</a></h3>
      <p class="term-def">${t.defHtml}</p>
      <div class="term-detail" hidden>
${termDetail(t)}
      </div>
    </li>`,
  )
  .join('\n')}
  </ul>
</section>`,
    )
    .join('\n');

  const scopeBlock = scopeBand(ctx, {
    title: 'Where this vocabulary applies',
    lede: 'These terms serve the areas the Working Group’s charter covers. Anything outside them belongs to another group, so a term here never claims it.',
  });

  const body = `<section class="hero">
  <div class="wrap">
    <p class="eyebrow">Workflows &amp; Process Integration · AAIF</p>
    <h1>A shared language for agentic&nbsp;workflows.</h1>
    <form class="search" role="search" onsubmit="return false">
      ${searchIcon}
      <label class="sr" for="q">Search terms and definitions</label>
      <input id="q" type="search" placeholder="Search ${n} terms" autocomplete="off" spellcheck="false">
      <kbd aria-hidden="true">/</kbd>
    </form>
    <p class="status"><span class="status-label">${esc(doc.status.label || 'Draft')}</span>${esc(doc.status.note)}</p>
  </div>
</section>

<div class="wrap" id="terms">
  <nav class="chips" aria-label="Jump to a category">
${chips}
  </nav>
  <p id="count" class="result-count" role="status" aria-live="polite"></p>
${sections}
  <div id="empty" class="empty" hidden>
    <p class="empty-title">No term matches “<span id="empty-q"></span>”.</p>
    <p>Missing a word your team keeps having to explain? <a id="empty-link" class="more" href="${ROOT}contribute/#propose">Propose it</a></p>
  </div>
</div>

${scopeBlock}

<section class="cta">
  <div class="wrap">
    <h2 class="section-title">Spot a gap? Help shape the vocabulary.</h2>
    <p class="lede">Anyone can propose a term, challenge a definition or write a scope note. It takes a few minutes and no setup beyond a GitHub account or an email.</p>
    <p class="btn-row"><a class="btn btn-primary" href="${ROOT}contribute/#propose">Propose a term</a><a class="btn btn-secondary" href="${ROOT}contribute/">Ways to contribute</a></p>
  </div>
</section>`;

  return page({
    ctx,
    root: '../',
    title: 'Taxonomy · AAIF Workflows & Process Integration',
    description: `${n} shared terms for agentic AI workflows, defined by the AAIF Workflows and Process Integration Working Group. Browse, search and contribute.`,
    active: 'terms',
    body,
  });
}

/* ------------------------------------------------------------------ term */

const termIssue = (ctx, t, kind) => {
  const { gh, config } = ctx;
  const src = gh.blob(config.termsPath, t.line);
  const head = `**Term:** ${t.name}\n**Category:** ${t.category.name}\n**Source:** ${src}\n`;
  if (kind === 'scope') {
    return gh.issue({
      title: `Taxonomy: add scope for “${t.name}”`,
      body: `${head}\n### Proposed scope note\n<!-- What does this term include? What does it deliberately leave out? Which term is it most often confused with? -->\n\n\n### Evidence\n<!-- Link a WG discussion, spec, reference architecture or use case that supports this. -->\n`,
    });
  }
  return gh.issue({
    title: `Taxonomy: change “${t.name}”`,
    body: `${head}\n### Current definition\n> ${t.definition}\n\n### Suggested change\n<!-- Replace this line with your suggested wording. -->\n\n\n### Why\n<!-- What is unclear, missing or inconsistent? Link any WG discussion or spec. -->\n`,
  });
};

export function renderTerm(ctx, t) {
  const { doc, config, gh } = ctx;
  const refName = (slug) => doc.terms.find((x) => x.slug === slug).name;
  const chip = (slug) => `<a class="chip" href="${ROOT}terms/${slug}/">${esc(refName(slug))}</a>`;
  const prev = doc.terms[t.index - 1];
  const next = doc.terms[t.index + 1];
  const scoped = hasScope(t);

  const facts = [
    `<div><dt>Category</dt><dd><a href="${ROOT}terms/#cat-${t.category.slug}">${esc(t.category.name)}</a></dd></div>`,
    ...t.fields.map((f) => `<div><dt>${esc(f.label)}</dt><dd>${f.html}</dd></div>`),
  ].join('\n');

  const gap = scoped
    ? ''
    : `<div class="gap">
        <p><strong>No scope note yet.</strong> Nothing here says what “${esc(t.name)}” includes, what it leaves out, or what it gets confused with. If you know, tell us.</p>
        <a class="btn btn-secondary" href="${termIssue(ctx, t, 'scope')}" target="_blank" rel="noopener">Add a scope note</a>
      </div>`;

  const related = [
    t.refs.length ? `<h3>This definition builds on</h3><div class="chips">${t.refs.map(chip).join('')}</div>` : '',
    t.referencedBy.length ? `<h3>Used in the definition of</h3><div class="chips">${t.referencedBy.map(chip).join('')}</div>` : '',
  ].join('');

  const body = `<article class="term-page" style="--h:${hue(t.category)}">
  <div class="wrap narrow">
    <nav class="crumbs" aria-label="Breadcrumb"><a href="${ROOT}terms/">Taxonomy</a><span aria-hidden="true">/</span><a href="${ROOT}terms/#cat-${t.category.slug}">${esc(t.category.name)}</a></nav>
    <p class="eyebrow"><span class="dot"></span>${esc(t.category.name)}</p>
    <h1>${esc(t.name)}</h1>
    <p class="definition">${t.defHtml}</p>
    ${t.notesHtml.map((h) => `<p class="note">${h}</p>`).join('\n')}
    <p class="status"><span class="status-label">${esc(doc.status.label || 'Draft')}</span>${esc(doc.status.note)}</p>
  </div>

  <div class="band">
    <div class="wrap narrow">
      <section class="card" aria-labelledby="scope-h">
        <h2 id="scope-h">Scope</h2>
        <dl class="facts">
${facts}
        </dl>
        ${gap}
      </section>
      <div class="two">
        <section class="card" aria-labelledby="rel-h">
          <h2 id="rel-h">Related terms</h2>
          ${related || '<p class="muted">No other term references this one yet, and its definition references none.</p>'}
        </section>
        <section class="card" aria-labelledby="imp-h">
          <h2 id="imp-h">Improve this term</h2>
          <ul class="actions">
            <li><a href="${termIssue(ctx, t, 'change')}" target="_blank" rel="noopener"><strong>Suggest a change</strong><span>Opens a GitHub issue with the current wording quoted</span></a></li>
            <li><a href="${gh.edit(config.termsPath)}" target="_blank" rel="noopener"><strong>Edit on GitHub</strong><span>Propose the exact wording as a pull request</span></a></li>
            <li><a href="${gh.search(t.name)}" target="_blank" rel="noopener"><strong>Find it in the repo</strong><span>See where the group's documents use it</span></a></li>
            <li><a href="${gh.blob(config.termsPath, t.line)}" target="_blank" rel="noopener"><strong>View source</strong><span><code>terms.md</code>, line ${t.line}</span></a></li>
          </ul>
          <button class="btn btn-secondary" type="button" data-copy-url>Copy link to this term</button>
        </section>
      </div>
      <nav class="pager" aria-label="Neighbouring terms">
        ${prev ? `<a class="prev" href="${ROOT}terms/${prev.slug}/"><span>Previous</span><strong>${esc(prev.name)}</strong></a>` : '<span></span>'}
        ${next ? `<a class="next" href="${ROOT}terms/${next.slug}/"><span>Next</span><strong>${esc(next.name)}</strong></a>` : '<span></span>'}
      </nav>
    </div>
  </div>
</article>`;

  return page({
    ctx,
    root: '../../',
    title: `${t.name} · Taxonomy · AAIF Workflows & Process Integration`,
    description: `${t.name}: ${stripInline(t.definition)}`.slice(0, 200),
    active: 'terms',
    body,
  });
}

/* ------------------------------------------------------------ contribute */

export function renderContribute(ctx) {
  const { doc, config, gh } = ctx;
  const needScope = doc.terms.filter((t) => !hasScope(t));
  const SHOWN = 8;
  const missing =
    needScope.length === doc.terms.length
      ? ` None of the ${doc.terms.length} terms has one yet.`
      : needScope.length
        ? ` ${needScope.length} of ${doc.terms.length} terms don’t have one yet.`
        : '';
  const { community } = config;

  const flagIssue = gh.issue({
    title: 'Taxonomy: inconsistent use of a term',
    body: `**Term:** \n**Where I saw it:** <!-- link to the spec, architecture, use case or discussion -->\n\n### How it is used there\n\n\n### How the taxonomy defines it\n<!-- Quote or link the definition. -->\n\n\n### Suggested resolution\n<!-- Change the document, change the definition, or add a new term? -->\n`,
  });

  const ways = [
    ['2 min', 'Challenge a definition', 'Unclear, too narrow, or just wrong? Every term page has a one-click way to say so, with the current wording already quoted.', `<a class="more" href="${ROOT}terms/">Browse terms</a>`],
    ['5 min', 'Propose a new term', 'Missing a word your team keeps having to explain? Draft it below and send it as a GitHub issue, an email, or ready-to-paste Markdown.', `<a class="more" href="#propose">Draft a term</a>`],
    ['10 min', 'Write a scope note', `A definition says what a term is. A scope note says what it includes, what it leaves out, and what it is confused with.${missing}`, `<a class="more" href="#needs-scope">Pick a term</a>`],
    ['10 min', 'Review an architecture or pattern', 'Read one, then say where it is unclear, where it contradicts another document, or where it did not fit a workflow you know. Every page links straight to a prefilled issue.', `<a class="more" href="${ROOT}architectures/">Browse architectures</a>`],
    ['5 min', 'Flag inconsistent use', 'Seen a term used differently in a spec, reference architecture or use case? That is exactly the ambiguity this taxonomy exists to remove.', `<a class="more" href="${flagIssue}" target="_blank" rel="noopener">Report it</a>`],
    ['5 min', 'Correct a use case', 'Disagree with how a workflow is classified, or know a better source? Each use case page opens an issue with the row already referenced.', `<a class="more" href="${ROOT}use-cases/">Browse use cases</a>`],
    ['30 min', 'Add a use case', 'Real workflows test a vocabulary better than debate does. Add yours to the inventory using the row template and see which terms it strains.', `<a class="more" href="${ROOT}use-cases/about/#how-to-contribute">Row template and guidelines</a>`],
    ['Biweekly', 'Join the conversation', 'The group meets every other Thursday at 8:00 AM PT and is open to the public. Substantive changes to existing terms are discussed there first.', `<a class="more" href="${community.discord}" target="_blank" rel="noopener">Discord</a> &nbsp; <a class="more" href="${community.mailingList}" target="_blank" rel="noopener">Mailing list</a>`],
  ];

  const steps = [
    ['Propose', 'Open an issue or pull request with the addition, edit or deletion you have in mind.'],
    ['Discuss', 'Name the term, document or use case and link any relevant WG discussion. Substantive changes are discussed in a WG meeting or on the mailing list before merging.'],
    ['Merge', `Once agreed, the change lands in the Markdown in the repository and this site rebuilds from it.`],
  ];

  const termData = doc.terms.map((t) => [t.name, t.slug]);

  const body = `<section class="hero compact">
  <div class="wrap">
    <p class="eyebrow">Contribute</p>
    <h1>Help shape the work.</h1>
    <p class="lede">The taxonomy, architectures and use cases are built in the open by people from many organisations. Pick the smallest way in that fits your time.</p>
  </div>
</section>

<div class="wrap">
  <ul class="ways">
${ways
  .map(
    ([time, title, text, action]) => `    <li class="card way"><span class="tag">${esc(time)}</span><h2>${esc(title)}</h2><p>${text}</p><p class="way-action">${action}</p></li>`,
  )
  .join('\n')}
  </ul>
</div>

${
  needScope.length
    ? `<section class="wrap needs" id="needs-scope" aria-labelledby="needs-h">
  <h2 id="needs-h" class="section-title small">Terms that still need a scope note</h2>
  <div class="chips">${needScope
    .slice(0, SHOWN)
    .map((t) => `<a class="chip" href="${ROOT}terms/${t.slug}/">${esc(t.name)}</a>`)
    .join('')}${
    needScope.length > SHOWN ? `<a class="chip" href="${ROOT}terms/">${needScope.length - SHOWN} more…</a>` : ''
  }</div>
</section>`
    : ''
}

<section class="wrap process" aria-labelledby="process-h">
  <h2 id="process-h" class="section-title">How a change gets in</h2>
  <ol class="steps">
${steps.map(([h, p], i) => `    <li><span class="step-n" aria-hidden="true">${i + 1}</span><h3>${h}</h3><p>${p}</p></li>`).join('\n')}
  </ol>
</section>

<section class="band" id="propose" aria-labelledby="propose-h">
  <div class="wrap">
    <p class="eyebrow">Draft a term</p>
    <h2 id="propose-h" class="section-title">Propose a new term</h2>
    <p class="lede">Fill in what you know. The preview shows how it will read, and you choose where to send it.</p>
    <div class="propose">
      <form id="propose-form" class="form" novalidate
        data-issues="${esc(gh.issues)}" data-edit="${esc(gh.edit(config.termsPath))}"
        data-mail="${esc(community.email)}" data-root="${ROOT}"
        data-terms="${esc(JSON.stringify(termData))}">
        <div class="field-row">
          <label for="f-name">Term <span class="req">Required</span></label>
          <input id="f-name" name="name" autocomplete="off" placeholder="e.g. Compensation" required>
          <p class="hint warn" id="dup" hidden></p>
        </div>
        <div class="field-row">
          <label for="f-category">Category</label>
          <select id="f-category" name="category">
${doc.categories.map((c) => `            <option>${esc(c.name)}</option>`).join('\n')}
            <option value="__new">New category…</option>
          </select>
          <input id="f-newcat" name="newcategory" placeholder="Name the new category" autocomplete="off" hidden>
        </div>
        <div class="field-row">
          <label for="f-def">Definition <span class="req">Required</span></label>
          <textarea id="f-def" name="definition" rows="4" placeholder="A single, bounded task with defined inputs and outputs…" required></textarea>
          <p class="hint">One or two sentences. Say what it is, not how any product does it. Capitalise other defined terms (Workflow, Activity) so they link up.</p>
        </div>
        <div class="field-row">
          <label for="f-scope">Scope <span class="opt">Optional</span></label>
          <textarea id="f-scope" name="scope" rows="3" placeholder="What it includes, what it deliberately leaves out, and what it is not to be confused with."></textarea>
        </div>
        <div class="field-row">
          <label for="f-why">Why it is needed <span class="opt">Optional</span></label>
          <textarea id="f-why" name="why" rows="3" placeholder="Where did the gap show up? Link a spec, architecture, use case or discussion."></textarea>
        </div>
      </form>
      <aside class="preview" aria-label="Preview">
        <p class="eyebrow">Preview</p>
        <div class="card pv">
          <p class="pv-cat" id="pv-cat"></p>
          <h3 id="pv-name">Your term</h3>
          <p id="pv-def" class="term-def">Its definition will appear here.</p>
          <p id="pv-scope" class="pv-scope" hidden></p>
        </div>
        <details open>
          <summary>Markdown for <code>terms.md</code></summary>
          <pre><code id="pv-md"></code></pre>
        </details>
        <div class="btn-col">
          <a id="open-issue" class="btn btn-primary" href="#" target="_blank" rel="noopener" aria-disabled="true">Open as GitHub issue</a>
          <button id="copy-md" class="btn btn-secondary" type="button" aria-disabled="true">Copy Markdown</button>
          <a id="send-mail" class="btn btn-secondary" href="#" aria-disabled="true">Send by email</a>
        </div>
        <p class="fine">Nothing is sent or stored until you pick a destination. No GitHub account? Email goes to the working group's public mailing list. Prefer a pull request? <a id="edit-link" href="${gh.edit(config.termsPath)}" target="_blank" rel="noopener">Edit <code>terms.md</code> directly</a>.</p>
      </aside>
    </div>
  </div>
</section>

<section class="wrap ground" aria-labelledby="ground-h">
  <h2 id="ground-h" class="section-title small">Ground rules</h2>
  <ul class="plain">
    <li><strong>Contribute as an individual.</strong> Members take part in service of the foundation's mission, not as representatives of their employers.</li>
    <li><strong>Stay vendor-neutral.</strong> Define the concept, not one product's implementation of it.</li>
    <li><strong>Be kind.</strong> The group follows the Linux Foundation Project's Code of Conduct and antitrust guidelines.</li>
  </ul>
</section>`;

  return page({
    ctx,
    root: '../',
    title: 'Contribute · AAIF Workflows & Process Integration',
    description: 'Propose a term, challenge a definition or write a scope note for the AAIF Workflows and Process Integration taxonomy.',
    active: 'contribute',
    body,
  });
}
