// Local preview: builds, serves site/dist on 127.0.0.1, and rebuilds when
// terms.md, the charter or anything under site/ changes.
//
//   node site/serve.mjs [port]      (default 4173)

import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { watch } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

import { config, paths } from './build.mjs';

const port = Number(process.argv[2] ?? process.env.PORT ?? 4173);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

// A child process per build, so edits to site/lib/*.mjs are picked up too
// (an in-process import would be cached by the module loader).
const build = () => execFileSync(process.execPath, [join(paths.siteDir, 'build.mjs')], { stdio: 'inherit' });

try {
  build();
} catch {
  process.exit(1);
}

let timer;
const rebuild = () => {
  clearTimeout(timer);
  timer = setTimeout(() => {
    try {
      build();
    } catch {
      /* build.mjs already printed the error; keep serving the last good build */
    }
  }, 100);
};
watch(paths.siteDir, { recursive: true }, (_, file) => {
  if (file && !String(file).startsWith('dist')) rebuild();
});
for (const p of [config.termsPath, config.charterPath]) watch(join(paths.repoRoot, p), rebuild);

createServer(async (req, res) => {
  try {
    const { pathname } = new URL(req.url, 'http://localhost');
    let file = join(paths.dist, normalize(decodeURIComponent(pathname)));
    if (!file.startsWith(paths.dist)) throw new Error('outside dist');
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
    res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
}).listen(port, '127.0.0.1', () => console.log(`Taxonomy site → http://127.0.0.1:${port}/`));
