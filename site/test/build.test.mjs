import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { buildLinker } from '../lib/autolink.mjs';
import { parseCharterScope } from '../lib/charter.mjs';
import { renderInline, stripInline } from '../lib/markdown.mjs';
import { findField, parseTerms } from '../lib/parse-terms.mjs';

const repo = (p) => readFileSync(fileURLToPath(new URL(`../../${p}`, import.meta.url)), 'utf8');

const SAMPLE = `# Sample

> **Status:** In Review — subject to change.

## First

### Alpha

Alpha is the first thing. It relates to Betas.

**Scope:** Covers one thing.

**Also known as:** A, Ay

### Beta

Beta follows [Alpha](https://example.com).

---

## Second

### Gamma

Gamma has \`code\` and **bold**.
`;

test('parses categories, terms, fields and status', () => {
  const doc = parseTerms(SAMPLE);
  assert.equal(doc.title, 'Sample');
  assert.deepEqual(doc.status, { label: 'In Review', note: 'Subject to change.' });
  assert.deepEqual(doc.categories.map((c) => [c.name, c.terms.length]), [['First', 2], ['Second', 1]]);
  const alpha = doc.terms[0];
  assert.equal(alpha.slug, 'alpha');
  assert.equal(alpha.definition, 'Alpha is the first thing. It relates to Betas.');
  assert.equal(findField(alpha, 'scope').value, 'Covers one thing.');
  assert.equal(findField(alpha, 'Also known as').value, 'A, Ay');
  assert.equal(doc.terms[2].category.name, 'Second');
});

test('rejects a term with no definition, a duplicate, and a term outside a category', () => {
  assert.throws(() => parseTerms('## C\n\n### Empty\n\n**Scope:** x\n'), /terms\.md:3: term "Empty" has no definition/);
  assert.throws(() => parseTerms('## C\n\n### A\n\nOne.\n\n### a\n\nTwo.\n'), /duplicate term "a"/);
  assert.throws(() => parseTerms('### Orphan\n\nText.\n'), /before any ## category/);
  assert.throws(() => parseTerms('# Only a title\n'), /no terms found/);
});

test('the real terms.md parses and every term has a definition', () => {
  const doc = parseTerms(repo('workstreams/taxonomy/terms.md'));
  assert.ok(doc.terms.length > 0);
  for (const t of doc.terms) assert.ok(t.definition.length > 10, t.name);
});

test('inline markdown escapes HTML and blocks unsafe links', () => {
  assert.equal(renderInline('<b>x</b> & `<i>`'), '&lt;b&gt;x&lt;/b&gt; &amp; <code>&lt;i&gt;</code>');
  assert.equal(renderInline('**a** *b*'), '<strong>a</strong> <em>b</em>');
  assert.equal(renderInline('[ok](https://e.com/a?x=1&y=2)'), '<a href="https://e.com/a?x=1&amp;y=2">ok</a>');
  assert.equal(renderInline('[bad](javascript:alert)'), 'bad');
  assert.equal(renderInline('[bad](data:text/html,x)'), 'bad');
  assert.equal(renderInline('[rel](x.md)', { resolveUrl: (u) => `https://gh/${u}` }), '<a href="https://gh/x.md">rel</a>');
  assert.equal(stripInline('**a** [b](http://x) `c`'), 'a b c');
});

test('autolink links capitalised terms and plurals, never itself, never inside links or code', () => {
  const terms = [
    { name: 'Activity', slug: 'activity' },
    { name: 'Workflow', slug: 'workflow' },
    { name: 'Workflow State', slug: 'workflow-state' },
  ];
  const link = buildLinker(terms, { State: 'workflow-state' });
  const r = link('Many Activities in a Workflow State; <a href="#">Workflow</a> <code>Activity</code> workflow.', 'activity');
  assert.deepEqual(r.refs, ['workflow-state']);
  assert.ok(r.html.includes('href="@@ROOT@@terms/workflow-state/">Workflow State</a>'));
  assert.ok(!r.html.includes('terms/activity/'), 'self link');
  assert.equal((r.html.match(/xref/g) ?? []).length, 1, 'only the bare text mention is linked');

  const alias = link('based on execution State', 'workflow');
  assert.deepEqual(alias.refs, ['workflow-state']);
});

test('charter scope extraction', () => {
  const { inScope, outOfScope } = parseCharterScope(
    '#### In Scope\n\n**A. First area**\n- x\n\n**B. Second area**\n\n#### Out of Scope (nope)\n\n- Not this.\n- Nor that.\n\n#### Next\n- ignored\n',
  );
  assert.deepEqual(inScope, [{ id: 'A', title: 'First area' }, { id: 'B', title: 'Second area' }]);
  assert.deepEqual(outOfScope, ['Not this.', 'Nor that.']);
  const real = parseCharterScope(repo('charter/charter.md'));
  assert.ok(real.inScope.length > 0 && real.outOfScope.length > 0, 'charter shape changed; update site/lib/charter.mjs');
});
