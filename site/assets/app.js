// Progressive enhancement. Every page works without this file; it adds
// search, copy buttons and the live "propose a term" form. No network calls.
(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  /* ----- Copy helpers ----- */
  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = Object.assign(document.createElement('textarea'), { value: text });
      document.body.append(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
  }
  function flash(btn, label) {
    const original = btn.dataset.label ?? (btn.dataset.label = btn.textContent);
    btn.textContent = label;
    clearTimeout(btn._t);
    btn._t = setTimeout(() => (btn.textContent = original), 1600);
  }
  $$('[data-copy-url]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      await copy(location.href.split('#')[0]);
      flash(btn, 'Link copied');
    }),
  );

  /* ----- Search & filter lists (taxonomy, use cases) ----- */
  // Wraps every query token found in an element's text in <mark>. The original
  // markup is kept so clearing the search restores it exactly.
  const unmark = (el) => {
    if (el.dataset.html !== undefined) el.innerHTML = el.dataset.html;
  };
  const mark = (el, re) => {
    if (el.dataset.html === undefined) el.dataset.html = el.innerHTML;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      re.lastIndex = 0;
      if (!re.test(node.data)) return;
      re.lastIndex = 0;
      const frag = document.createDocumentFragment();
      let last = 0;
      for (const m of node.data.matchAll(re)) {
        frag.append(node.data.slice(last, m.index), Object.assign(document.createElement('mark'), { textContent: m[0] }));
        last = m.index + m[0].length;
      }
      frag.append(node.data.slice(last));
      node.replaceWith(frag);
    });
  };
  // "activity" should also find "Activities", and "agents" should find "agent".
  const variants = (t) => {
    const v = new Set([t]);
    if (t.length > 3) {
      if (t.endsWith('y')) v.add(`${t.slice(0, -1)}ies`);
      if (t.endsWith('ies')) v.add(`${t.slice(0, -3)}y`);
      if (t.endsWith('s') && !t.endsWith('ss')) v.add(t.slice(0, -1));
      else v.add(`${t}s`);
    }
    return [...v];
  };
  const tokenRegex = (tokens) => {
    const all = [...new Set(tokens.flatMap(variants))].sort((a, b) => b.length - a.length);
    return all.length ? new RegExp(all.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'gi') : null;
  };

  // opts: { input, rows, count, empty, emptyQ, emptyLink, noun, parts(row), filters }
  function listSearch(opts) {
    const { input, rows, count, empty, noun, parts, filters = {} } = opts;
    const cats = $$('[data-cat]');
    const total = rows.length;
    const active = {}; // dimension → Set of selected values

    const apply = () => {
      const raw = input.value.trim();
      const tokens = raw.toLowerCase().split(/\s+/).filter(Boolean);
      const re = tokenRegex(tokens);
      let shown = 0;
      rows.forEach((row) => {
        const textHit = tokens.every((t) => variants(t).some((v) => row.dataset.search.includes(v)));
        const filterHit = Object.entries(active).every(([dim, set]) => !set.size || set.has(row.dataset[dim]));
        const hit = textHit && filterHit;
        row.hidden = !hit;
        shown += hit;
        const els = parts(row);
        els.forEach(unmark);
        opts.onRow?.(row, hit && Boolean(re));
        if (hit && re) els.forEach((el) => mark(el, re));
      });
      cats.forEach((c) => (c.hidden = !$$('.term:not([hidden])', c).length));
      empty.hidden = shown > 0;
      if (opts.emptyQ) opts.emptyQ.textContent = raw;
      if (opts.emptyLink) {
        const base = opts.emptyLink.getAttribute('href').split(/[?#]/)[0];
        opts.emptyLink.href = `${base}?term=${encodeURIComponent(raw)}#propose`;
      }
      const nFilters = Object.values(active).reduce((n, set) => n + set.size, 0);
      count.textContent = raw || nFilters ? `${shown} of ${total} ${noun} match` : '';
      opts.onFilterCount?.(nFilters);
      const url = new URL(location.href);
      raw ? url.searchParams.set('q', raw) : url.searchParams.delete('q');
      for (const dim of Object.keys(filters)) {
        url.searchParams.delete(dim);
        (active[dim] ?? []).forEach((v) => url.searchParams.append(dim, v));
      }
      history.replaceState(null, '', url);
    };

    // Filter chips: OR within a dimension, AND across dimensions.
    Object.entries(filters).forEach(([dim, group]) => {
      active[dim] = new Set(new URLSearchParams(location.search).getAll(dim));
      $$('.chip.toggle', group).forEach((btn) => {
        btn.setAttribute('aria-pressed', String(active[dim].has(btn.dataset.value)));
        btn.addEventListener('click', () => {
          const on = btn.getAttribute('aria-pressed') !== 'true';
          btn.setAttribute('aria-pressed', String(on));
          on ? active[dim].add(btn.dataset.value) : active[dim].delete(btn.dataset.value);
          apply();
        });
      });
    });
    opts.clearButton?.addEventListener('click', () => {
      Object.values(active).forEach((set) => set.clear());
      $$('.chip.toggle').forEach((b) => b.setAttribute('aria-pressed', 'false'));
      apply();
    });

    input.value = new URLSearchParams(location.search).get('q') ?? '';
    input.addEventListener('input', apply);
    apply();

    document.addEventListener('keydown', (e) => {
      const typing = /^(input|textarea|select)$/i.test(document.activeElement?.tagName ?? '');
      if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        input.focus();
        input.select();
      } else if (e.key === 'Escape' && document.activeElement === input && input.value) {
        input.value = '';
        apply();
      }
    });
  }

  const q = $('#q');
  if (q) {
    listSearch({
      input: q,
      rows: $$('.term'),
      count: $('#count'),
      empty: $('#empty'),
      emptyQ: $('#empty-q'),
      emptyLink: $('#empty-link'),
      noun: 'terms',
      parts: (row) => [$('.term-name a', row), $('.term-def', row), $('.term-detail', row)],
      // While searching, each match expands to show everything the site knows about it.
      onRow: (row, searching) => ($('.term-detail', row).hidden = !searching),
    });
  }

  const uq = $('#uq');
  if (uq) {
    const panel = $('#filters');
    panel.hidden = false; // the filter panel needs JavaScript, so it only appears with it
    const filters = Object.fromEntries($$('[data-filter]', panel).map((g) => [g.dataset.filter, g]));
    const badge = $('#filters-n');
    const params = new URLSearchParams(location.search);
    if (Object.keys(filters).some((d) => params.has(d))) panel.open = true;
    listSearch({
      input: uq,
      rows: $$('.uc'),
      count: $('#uc-count'),
      empty: $('#uc-empty'),
      noun: 'use cases',
      filters,
      clearButton: $('#filters-clear'),
      parts: (row) => [$('.term-name a', row), $('.term-def', row)],
      onFilterCount: (n) => (badge.textContent = n ? String(n) : ''),
    });
  }

  /* ----- Contribute: propose a term ----- */
  const form = $('#propose-form');
  if (form) {
    const existing = JSON.parse(form.dataset.terms);
    const root = form.dataset.root;
    const el = {
      name: $('#f-name'), cat: $('#f-category'), newCat: $('#f-newcat'), def: $('#f-def'), scope: $('#f-scope'), why: $('#f-why'),
      dup: $('#dup'), pvName: $('#pv-name'), pvDef: $('#pv-def'), pvScope: $('#pv-scope'), pvCat: $('#pv-cat'), pvMd: $('#pv-md'),
      issue: $('#open-issue'), mail: $('#send-mail'), copyMd: $('#copy-md'),
    };

    const prefill = new URLSearchParams(location.search).get('term');
    if (prefill) el.name.value = prefill;

    const disable = (node, off) => {
      node.setAttribute('aria-disabled', String(off));
      if (off) node.setAttribute('href', '#');
    };

    const update = () => {
      const name = el.name.value.trim();
      const def = el.def.value.trim().replace(/\s*\n\s*/g, ' ');
      const scope = el.scope.value.trim().replace(/\s*\n\s*/g, ' ');
      const why = el.why.value.trim();
      const isNew = el.cat.value === '__new';
      el.newCat.hidden = !isNew;
      const category = (isNew ? el.newCat.value.trim() : el.cat.value) || '';

      const match = existing.find(([n]) => n.toLowerCase() === name.toLowerCase());
      el.dup.hidden = !match;
      if (match) {
        el.dup.innerHTML = '';
        el.dup.append(`“${match[0]}” is already defined. `);
        el.dup.append(Object.assign(document.createElement('a'), { href: `${root}terms/${match[1]}/`, textContent: 'Suggest a change to it instead.' }));
      }

      el.pvName.textContent = name || 'Your term';
      el.pvCat.textContent = category;
      el.pvDef.textContent = def || 'Its definition will appear here.';
      el.pvDef.toggleAttribute('data-empty', !def);
      el.pvScope.hidden = !scope;
      el.pvScope.textContent = scope ? `Scope: ${scope}` : '';

      const md = `### ${name || 'Term name'}\n\n${def || 'Definition.'}${scope ? `\n\n**Scope:** ${scope}` : ''}`;
      el.pvMd.textContent = `${category ? `## ${category}\n\n` : ''}${md}`;

      const ready = Boolean(name && def);
      const body = [
        `**Term:** ${name}`,
        `**Category:** ${category || '_(suggest one)_'}`,
        '',
        '### Proposed entry for `terms.md`',
        '```md',
        md,
        '```',
        '',
        '### Why this term is needed',
        why || '_(add context, or link a spec, architecture, use case or discussion)_',
      ].join('\n');
      const title = `Taxonomy: propose term “${name}”`;

      if (ready) {
        const params = new URLSearchParams({ title, body, labels: 'taxonomy' });
        el.issue.href = `${form.dataset.issues}?${params}`;
        el.mail.href = `mailto:${form.dataset.mail}?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
      }
      [el.issue, el.mail, el.copyMd].forEach((n) => (ready ? n.setAttribute('aria-disabled', 'false') : disable(n, true)));
      el.mdText = md;
      el.ready = ready;
    };

    form.addEventListener('input', update);
    form.addEventListener('change', update);
    form.addEventListener('submit', (e) => e.preventDefault());
    el.copyMd.addEventListener('click', async () => {
      if (!el.ready) return;
      await copy(el.mdText);
      flash(el.copyMd, 'Copied');
    });
    update();
  }

  /* ----- Diagrams (Mermaid is loaded only on pages that have one) ----- */
  const diagrams = $$('pre.mermaid[data-diagram]');
  if (diagrams.length && window.mermaid) {
    diagrams.forEach((el) => (el.dataset.source = el.textContent));
    const dark = matchMedia('(prefers-color-scheme: dark)');
    const render = async () => {
      const isDark = dark.matches;
      window.mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: 'base',
        fontFamily: getComputedStyle(document.body).fontFamily,
        flowchart: { curve: 'basis', htmlLabels: true, padding: 14 },
        themeVariables: isDark
          ? { background: '#111113', primaryColor: '#1c1c1e', primaryTextColor: '#f5f5f7', primaryBorderColor: '#6e6e73', lineColor: '#a1a1a6', secondaryColor: '#1c1c1e', tertiaryColor: '#111113', clusterBkg: '#17171a', clusterBorder: '#3a3a3c', edgeLabelBackground: '#111113', textColor: '#f5f5f7' }
          : { background: '#f5f5f7', primaryColor: '#ffffff', primaryTextColor: '#1d1d1f', primaryBorderColor: '#c7c7cc', lineColor: '#6e6e73', secondaryColor: '#ffffff', tertiaryColor: '#f5f5f7', clusterBkg: '#fbfbfd', clusterBorder: '#d2d2d7', edgeLabelBackground: '#f5f5f7', textColor: '#1d1d1f' },
      });
      for (const el of diagrams) {
        el.removeAttribute('data-processed');
        el.textContent = el.dataset.source;
      }
      try {
        await window.mermaid.run({ nodes: diagrams });
      } catch (err) {
        console.warn('Diagram could not be rendered; showing its source.', err);
      }
    };
    render();
    dark.addEventListener?.('change', render);

    // Click to view a diagram at full width.
    const box = Object.assign(document.createElement('dialog'), { className: 'lightbox' });
    box.innerHTML = '<button type="button" class="btn btn-secondary lb-close">Close</button><div class="lb-body"></div>';
    document.body.append(box);
    $('.lb-close', box).addEventListener('click', () => box.close());
    box.addEventListener('click', (e) => e.target === box && box.close());
    $$('.diagram').forEach((fig) => {
      const btn = Object.assign(document.createElement('button'), { type: 'button', className: 'btn btn-secondary expand', textContent: 'Expand' });
      btn.addEventListener('click', () => {
        const svg = $('svg', fig);
        if (!svg) return;
        const body = $('.lb-body', box);
        body.replaceChildren(svg.cloneNode(true));
        box.showModal();
      });
      fig.append(btn);
    });
  }

  /* ----- Table of contents: mark the section being read ----- */
  const tocLinks = $$('.toc a');
  if (tocLinks.length && 'IntersectionObserver' in window) {
    const byId = new Map(tocLinks.map((a) => [decodeURIComponent(a.hash.slice(1)), a]));
    const heads = [...byId.keys()].map((id) => document.getElementById(id)).filter(Boolean);
    const seen = new Set();
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => (e.isIntersecting ? seen.add(e.target.id) : seen.delete(e.target.id)));
        const current = heads.find((h) => seen.has(h.id));
        if (!current) return;
        tocLinks.forEach((a) => a.removeAttribute('aria-current'));
        byId.get(current.id)?.setAttribute('aria-current', 'true');
      },
      { rootMargin: '-72px 0px -65% 0px' },
    );
    heads.forEach((h) => io.observe(h));
  }
})();
