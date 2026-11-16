// Builds the static site into site/dist from the Markdown in this repository:
// the taxonomy, the reference architectures and the use-case inventory.
// Zero dependencies: Node's standard library only.
//
//   node site/build.mjs            one-off build
//   node site/serve.mjs            build, serve and rebuild on change

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, posix, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { buildLinker } from './lib/autolink.mjs';
import { parseCharterScope } from './lib/charter.mjs';
import { collectDocs, makeResolver, renderDocs } from './lib/docs.mjs';
import { githubLinks } from './lib/github.mjs';
import { renderDocument } from './lib/markdown-doc.mjs';
import { renderInline, stripInline } from './lib/markdown.mjs';
import { parseDoc } from './lib/parse-docs.mjs';
import { parseTerms } from './lib/parse-terms.mjs';
import { parseUseCases } from './lib/parse-usecases.mjs';
import { renderArchitectures, renderDoc } from './lib/render-docs.mjs';
import { renderUseCase, renderUseCases } from './lib/render-usecases.mjs';
import { renderContribute, renderLanding, renderTerm, renderTerms } from './lib/render.mjs';

const siteDir = dirname(fileURLToPath(import.meta.url));
export const paths = {
  siteDir,
  repoRoot: resolve(siteDir, '..'),
  dist: join(siteDir, 'dist'),
};

export const config = {
  repo: process.env.SITE_REPO ?? 'aaif/wg-workflows-and-process-integration',
  branch: process.env.SITE_BRANCH ?? 'main',
  termsPath: 'workstreams/taxonomy/terms.md',
  charterPath: 'charter/charter.md',
  useCasesPath: 'workstreams/critical-use-cases/use-case-inventory.md',
  schemaPath: 'workstreams/critical-use-cases/schema-agentic-use-cases.md',
  archPath: 'workstreams/reference-architectures/README.md',
  readmePath: 'README.md',
  sourceDirs: ['workstreams/taxonomy', 'workstreams/reference-architectures', 'workstreams/critical-use-cases'],
  // From README.md → Communication.
  community: {
    mailingList: 'https://lists.aaif.io/g/wg-workflows-process-integration',
    email: 'wg-workflows-process-integration@lists.aaif.io',
    discord: 'https://discord.com/invite/9zTwngHAMy',
  },
  // terms.md writes "State" for Workflow State in running text; link it.
  aliases: { State: 'workflow-state' },
};

const git = (...args) => {
  try {
    return execFileSync('git', args, { cwd: paths.repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
};

export function build({ quiet = false } = {}) {
  const read = (p) => readFileSync(join(paths.repoRoot, p), 'utf8');
  const gh = githubLinks(config);

  const doc = parseTerms(read(config.termsPath), { file: config.termsPath });
  const scope = existsSync(join(paths.repoRoot, config.charterPath))
    ? parseCharterScope(read(config.charterPath))
    : { inScope: [], outOfScope: [] };

  // Relative links in terms.md resolve against the file's own folder on GitHub.
  const termsDir = posix.dirname(config.termsPath);
  const resolveUrl = (u) => (/^([a-z][a-z0-9+.-]*:|#)/i.test(u) ? u : gh.blob(posix.join(termsDir, u)));

  // Pass 1: render text and find which terms mention which.
  const link = buildLinker(doc.terms, config.aliases);
  const bySlug = new Map(doc.terms.map((t) => [t.slug, t]));
  for (const t of doc.terms) {
    const refs = new Set();
    const run = (text) => {
      const r = link(renderInline(text, { resolveUrl }), t.slug);
      r.refs.forEach((s) => refs.add(s));
      return r.html;
    };
    t.defHtml = run(t.definition);
    t.notesHtml = t.notes.map(run);
    t.fields.forEach((f) => (f.html = run(f.value)));
    t.refs = [...refs];
    t.referencedBy = [];
  }
  // Pass 2: invert the references.
  for (const t of doc.terms) for (const s of t.refs) bySlug.get(s).referencedBy.push(t.slug);

  /* ---- reference architectures and use cases ---- */

  const readmeText = existsSync(join(paths.repoRoot, config.archPath)) ? read(config.archPath) : '';
  const docs = collectDocs({ repoRoot: paths.repoRoot, readmeText });

  const inventoryText = read(config.useCasesPath);
  const inventory = parseUseCases(inventoryText, { file: config.useCasesPath });

  // Which repo file each page replaces, so links between documents stay on the site.
  const pageMap = new Map([
    [config.termsPath, 'terms/'],
    [config.archPath, 'architectures/'],
    [config.useCasesPath, 'use-cases/'],
    [config.schemaPath, 'use-cases/classification/'],
    ...docs.map((d) => [d.path, d.url]),
  ]);
  const env = { repoRoot: paths.repoRoot, pageMap, gh, config };
  renderDocs(docs, env);

  // The inventory's front matter (everything before the table) and the schema
  // become ordinary document pages under /use-cases/.
  const categoryAnchors = new Map(inventory.categories.map((c) => [c.slug, `@@ROOT@@use-cases/#cat-${c.slug}`]));
  const useCaseDocs = [];
  {
    const cut = inventoryText.search(/^##\s+Use Case Inventory\s*$/m);
    const about = parseDoc(inventoryText.slice(0, cut), { file: config.useCasesPath });
    const aboutDoc = {
      ...about,
      title: 'About the use case inventory',
      eyebrow: 'Use cases',
      kind: 'about',
      section: { href: '@@ROOT@@use-cases/', label: 'Use cases' },
      issueLabel: 'use-cases',
      issuePrefix: 'Use cases',
      path: config.useCasesPath,
      slug: 'about',
      url: 'use-cases/about/',
      active: 'use-cases',
    };
    aboutDoc.resolveUrl = makeResolver(config.useCasesPath, { ...env, anchors: categoryAnchors });
    Object.assign(aboutDoc, renderDocument(aboutDoc.body, { resolveUrl: aboutDoc.resolveUrl }));
    // The H1 and byline are covered by the page header.
    useCaseDocs.push(aboutDoc);

    const schema = parseDoc(read(config.schemaPath), { file: config.schemaPath });
    const schemaDoc = {
      ...schema,
      title: 'Classification schema',
      eyebrow: 'Use cases',
      statusLabel: 'Draft',
      statusNote: 'Not yet aligned with the reference architecture workstream.',
      kind: 'about',
      section: { href: '@@ROOT@@use-cases/', label: 'Use cases' },
      issueLabel: 'use-cases',
      issuePrefix: 'Use cases',
      path: config.schemaPath,
      slug: 'classification',
      url: 'use-cases/classification/',
      active: 'use-cases',
    };
    schemaDoc.resolveUrl = makeResolver(config.schemaPath, env);
    Object.assign(schemaDoc, renderDocument(schemaDoc.body, { resolveUrl: schemaDoc.resolveUrl }));
    useCaseDocs.push(schemaDoc);
  }

  const readme = (() => {
    if (!existsSync(join(paths.repoRoot, config.readmePath))) return {};
    const text = read(config.readmePath);
    const para = (heading) => {
      const m = text.match(new RegExp(`^##\\s+${heading}\\s*\\n+([^\\n#][^\\n]*)`, 'mi'));
      return m ? m[1].trim() : '';
    };
    return { mission: para('Mission'), meetings: para('Meetings').replace(/\s*\(\[Convert[^)]*\)\)?/, '') };
  })();

  const updated = git('log', '-1', '--format=%cs', '--', ...config.sourceDirs);
  const ctx = {
    doc,
    scope,
    config,
    gh,
    docs,
    inventory,
    readme,
    resolveInventoryUrl: makeResolver(config.useCasesPath, env),
    meta: { updated, sha: git('rev-parse', '--short', 'HEAD') },
  };

  rmSync(paths.dist, { recursive: true, force: true });
  const write = (rel, content) => {
    const file = join(paths.dist, rel);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
  };

  write('index.html', renderLanding(ctx));
  write('terms/index.html', renderTerms(ctx));
  write('contribute/index.html', renderContribute(ctx));
  for (const t of doc.terms) write(`terms/${t.slug}/index.html`, renderTerm(ctx, t));

  write('architectures/index.html', renderArchitectures(ctx));
  for (const d of docs) {
    const siblings = docs.filter((x) => x.kind === d.kind);
    write(`${d.url}index.html`, renderDoc(ctx, d, { siblings }));
  }

  write('use-cases/index.html', renderUseCases(ctx));
  inventory.useCases.forEach((u, i) =>
    write(`use-cases/${u.slug}/index.html`, renderUseCase(ctx, u, { prev: inventory.useCases[i - 1], next: inventory.useCases[i + 1] })),
  );
  for (const d of useCaseDocs) write(`${d.url}index.html`, renderDoc(ctx, d));

  write(
    'terms.json',
    `${JSON.stringify(
      {
        title: doc.title,
        status: doc.status,
        source: gh.blob(config.termsPath),
        categories: doc.categories.map((c) => ({ name: c.name, slug: c.slug, terms: c.terms.map((t) => t.slug) })),
        terms: doc.terms.map((t) => ({
          name: t.name,
          slug: t.slug,
          category: t.category.name,
          definition: stripInline(t.definition),
          ...Object.fromEntries(t.fields.map((f) => [f.label, stripInline(f.value)])),
          related: t.refs,
          url: `terms/${t.slug}/`,
        })),
      },
      null,
      2,
    )}\n`,
  );
  write('.nojekyll', '');
  cpSync(join(siteDir, 'assets'), join(paths.dist, 'assets'), { recursive: true });

  if (!quiet) {
    console.log(
      `Built ${doc.terms.length} terms, ${docs.length} architecture documents (${docs.reduce((n, d) => n + d.diagrams, 0)} diagrams) and ${inventory.useCases.length} use cases → ${paths.dist}`,
    );
  }
  return doc;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    build();
  } catch (err) {
    console.error(`Build failed: ${err.message}`);
    process.exit(1);
  }
}
