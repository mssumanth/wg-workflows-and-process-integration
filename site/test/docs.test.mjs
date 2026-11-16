import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { collectDocs, makeResolver, renderDocs } from '../lib/docs.mjs';
import { githubLinks } from '../lib/github.mjs';
import { headingSlug, renderDocument } from '../lib/markdown-doc.mjs';
import { parseDoc } from '../lib/parse-docs.mjs';
import { parseUseCases, parseValue } from '../lib/parse-usecases.mjs';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const repo = (p) => readFileSync(`${repoRoot}${p}`, 'utf8');
const config = { branch: 'main' };
const gh = githubLinks({ repo: 'o/r', branch: 'main' });

test('headings get GitHub-style anchors, and a dead in-page link becomes plain text', () => {
  assert.equal(headingSlug('5.1 Foundations'), '51-foundations');
  assert.equal(headingSlug('Is this your architecture? (checklist)'), 'is-this-your-architecture-checklist');
  const { html, headings } = renderDocument('## Real\n\n[ok](#real) and [dead](#nope)\n\n## Real\n');
  assert.deepEqual(headings.map((h) => h.id), ['real', 'real-1']);
  assert.ok(html.includes('<a href="#real">ok</a>'));
  assert.ok(html.includes('and dead') && !html.includes('href="#nope"'));
});

test('blocks: nested lists, tables with escaped pipes, quotes, rules, hard breaks', () => {
  const { html } = renderDocument(
    '- a\n  - b\n- c\n\n1. one\n2. two\n\n| H | I |\n|---|:-:|\n| `x\\|y` | <br>z |\n\n> **Note:** q\n\n---\n\nline one \\\nline two\n',
  );
  assert.ok(html.includes('<ul><li>a<ul><li>b</li></ul></li><li>c</li></ul>'));
  assert.ok(html.includes('<ol><li>one</li><li>two</li></ol>'));
  assert.ok(html.includes('<td><code>x|y</code></td><td style="text-align:center"><br>z</td>'));
  assert.ok(html.includes('<blockquote><p><strong>Note:</strong> q</p></blockquote>'));
  assert.ok(html.includes('<hr>'));
  assert.ok(html.includes('line one<br>line two'));
});

test('code is escaped, and mermaid blocks are marked for the diagram renderer', () => {
  const { html, diagrams } = renderDocument('```text\n<b>&</b>\n```\n\n```mermaid\nflowchart TB\n A-->B\n```\n');
  assert.equal(diagrams, 1);
  assert.ok(html.includes('&lt;b&gt;&amp;&lt;/b&gt;'));
  assert.ok(html.includes('class="mermaid" data-diagram'));
  assert.ok(html.includes('A--&gt;B'));
});

test('parseDoc reads the title, the fact block and the status', () => {
  const d = parseDoc('# T\n\n**Solves:** a thing \\\n**Used in:** [x](y.md)\n\n## Status\n\nDraft for review. Not final.\n\n## Problem\n\nIt hurts.\n', { file: 'x.md' });
  assert.equal(d.title, 'T');
  assert.deepEqual(d.facts, [{ label: 'Solves', value: 'a thing' }, { label: 'Used in', value: '[x](y.md)' }]);
  assert.equal(d.status, 'Draft for review. Not final.');
  assert.equal(d.summary, 'It hurts.');
  assert.throws(() => parseDoc('no heading'), /no "# Title"/);
});

test('links between documents stay on the site; others go to GitHub', () => {
  const pageMap = new Map([['a/one.md', 'architectures/one/']]);
  const resolve = makeResolver('a/two.md', { repoRoot, pageMap, gh, config });
  assert.equal(resolve('one.md#frag'), '@@ROOT@@architectures/one/#frag');
  assert.equal(resolve('https://example.com/x'), 'https://example.com/x');
  assert.equal(resolve('#local'), '#local');
  assert.equal(resolve('../README.md'), 'https://github.com/o/r/blob/main/README.md');
  assert.equal(resolve('../does/not/exist.md'), 'https://github.com/o/r');
  assert.equal(resolve('../../../../outside.md'), 'https://github.com/o/r');
});

test('every reference-architecture document renders, and in-site links point at real pages', () => {
  const docs = collectDocs({ repoRoot, readmeText: repo('workstreams/reference-architectures/README.md') });
  assert.ok(docs.filter((d) => d.kind === 'architecture').length >= 2);
  assert.ok(docs.filter((d) => d.kind === 'pattern').length >= 5);
  const pageMap = new Map(docs.map((d) => [d.path, d.url]));
  renderDocs(docs, { repoRoot, pageMap, gh, config });
  const urls = new Set(docs.map((d) => d.url));
  for (const d of docs) {
    assert.ok(d.html.length > 200, d.path);
    for (const [, target] of d.html.matchAll(/href="@@ROOT@@([^"#]+)/g)) assert.ok(urls.has(target), `${d.path} links to missing page ${target}`);
  }
  assert.ok(docs.reduce((n, d) => n + d.diagrams, 0) >= 1, 'expected at least one diagram');
});

test('use-case values keep their qualifier and footnote', () => {
  assert.deepEqual(parseValue('`Approval gate` (content)'), { label: 'Approval gate', full: 'Approval gate', qualifier: 'content', footnote: '' });
  assert.equal(parseValue('`Better as multi-agent`¹').footnote, '¹');
  assert.equal(parseValue('`Unspecified: insufficient source detail`').label, 'Unspecified');
});

const TABLE = (rows) => `## Use Case Inventory\n\n### Sales\n\n| Use Case | Description | Tools & Systems | Trigger | HITL Pattern | Agent Count | Coordination | Workflow Pattern | Duration | Key Failure Mode | Preconditions | Notes |\n|---|---|---|---|---|---|---|---|---|---|---|---|\n${rows}\n`;
const ROW = (name) => `| **${name}** | Does a thing. | • A<br>• B | \`Event\` | \`None\` | \`Single-agent sufficient\` | \`Fixed/scripted\` | \`Sequential pipeline\` | \`Short\` | _Bad thing_ | — | A note. |`;

test('use-case parsing: columns by header, duplicate names get distinct slugs, errors point at a line', () => {
  const inv = parseUseCases(TABLE(`${ROW('Same')}\n${ROW('Same')}`), { file: 'inv.md' });
  assert.deepEqual(inv.useCases.map((u) => u.slug), ['same', 'same-2']);
  assert.deepEqual(inv.useCases[0].tools, ['A', 'B']);
  assert.equal(inv.useCases[0].preconditions, '');
  assert.equal(inv.useCases[0].hitl.label, 'None');
  assert.throws(() => parseUseCases(TABLE('| **Short** | row |'), { file: 'inv.md' }), /inv\.md:\d+: row has 2 cells/);
  assert.throws(() => parseUseCases('# nothing'), /no "## Use Case Inventory"/);
});

test('the real inventory parses; every use case is classified on all five dimensions', () => {
  const inv = parseUseCases(repo('workstreams/critical-use-cases/use-case-inventory.md'));
  assert.ok(inv.useCases.length > 50);
  for (const u of inv.useCases) {
    for (const k of ['trigger', 'hitl', 'agents', 'coordination', 'pattern']) assert.ok(u[k].label, `${u.name}: ${k}`);
    assert.ok(u.description.length > 20, u.name);
  }
});
