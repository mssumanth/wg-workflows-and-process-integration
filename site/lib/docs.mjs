// Collects the documents the site renders as pages, works out where each one
// lives, and rewrites the relative links inside them so that links between
// documents stay on the site and everything else falls back to GitHub.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, posix } from 'node:path';

import { ROOT_TOKEN } from './markdown.mjs';
import { renderDocument } from './markdown-doc.mjs';
import { parseDoc } from './parse-docs.mjs';

const RA = 'workstreams/reference-architectures';

// Folder layout of the reference-architectures workstream → page kind and URL.
const SOURCES = [
  { kind: 'architecture', dir: `${RA}/architectures`, url: (s) => `architectures/${s}/` },
  { kind: 'pattern', dir: `${RA}/patterns`, url: (s) => `architectures/patterns/${s}/` },
  { kind: 'decision', dir: `${RA}/decisions`, url: (s) => `architectures/decisions/${s}/` },
  { kind: 'principles', file: `${RA}/principles.md`, url: () => 'architectures/principles/' },
  { kind: 'background', dir: `${RA}/docs`, url: (s) => `architectures/background/${s}/` },
];
const SKIP = /^(TEMPLATE|README|AGENTS|CONTRIBUTING)\.md$/i;
const RESERVED = new Set(['patterns', 'decisions', 'principles', 'background']);

// Links the source documents get wrong; point them at the file that exists.
const LINK_ALIASES = {
  'workstreams/critical-use-cases/classification-schema.md': 'workstreams/critical-use-cases/schema-agentic-use-cases.md',
};

export function collectDocs({ repoRoot, readmeText = '' }) {
  const docs = [];
  for (const src of SOURCES) {
    const files = src.file
      ? [src.file]
      : readdirSync(join(repoRoot, src.dir))
          .filter((f) => f.endsWith('.md') && !SKIP.test(f))
          .map((f) => `${src.dir}/${f}`);
    for (const path of files) {
      const slug = posix.basename(path, '.md');
      if (src.kind === 'architecture' && RESERVED.has(slug)) throw new Error(`${path}: "${slug}" is reserved for a site section`);
      const parsed = parseDoc(readFileSync(join(repoRoot, path), 'utf8'), { file: path });
      docs.push({ ...parsed, kind: src.kind, path, slug, url: src.url(slug) });
    }
  }
  // Order within a kind follows how the workstream README introduces them.
  const rank = (d) => {
    const at = readmeText.indexOf(posix.basename(d.path));
    return at === -1 ? Infinity : at;
  };
  docs.sort((a, b) => (a.kind === b.kind ? rank(a) - rank(b) || a.path.localeCompare(b.path) : 0));
  return docs;
}

/**
 * Builds a link rewriter for one source file.
 * @param {string} fromPath repo-relative path of the file the link appears in
 * @param {{repoRoot:string, pageMap:Map<string,string>, gh:object, config:object, anchors?:Map<string,string>}} env
 */
export function makeResolver(fromPath, { repoRoot, pageMap, gh, config, anchors = new Map() }) {
  return (url) => {
    if (/^([a-z][a-z0-9+.-]*:)/i.test(url)) return url;
    if (url.startsWith('#')) return anchors.get(url.slice(1)) ?? url;

    const [rel, frag] = url.split('#');
    const hash = frag ? `#${frag}` : '';
    if (!rel) return url;
    let path = posix.normalize(posix.join(posix.dirname(fromPath), rel)).replace(/\/$/, '');
    if (path.startsWith('..')) return gh.base;
    path = LINK_ALIASES[path] ?? path;

    if (pageMap.has(path)) return `${ROOT_TOKEN}${pageMap.get(path)}${hash}`;
    const abs = join(repoRoot, path);
    if (!existsSync(abs)) return gh.base; // a link that is already broken in the source
    return statSync(abs).isDirectory() ? `${gh.base}/tree/${config.branch}/${path}` : `${gh.blob(path)}${hash}`;
  };
}

export function renderDocs(docs, env) {
  for (const d of docs) {
    d.resolveUrl = makeResolver(d.path, env);
    Object.assign(d, renderDocument(d.body, { resolveUrl: d.resolveUrl }));
  }
}
