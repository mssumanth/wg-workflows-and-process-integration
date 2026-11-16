# Working group website

A small static website for the Workflows & Process Integration Working Group. It presents the three workstreams and makes it easy to contribute to each:

| Section | What it shows | Source of truth |
|---|---|---|
| **Taxonomy** (`/terms/`) | Every term with its definition and scope, how terms relate, live search | [`workstreams/taxonomy/terms.md`](../workstreams/taxonomy/terms.md) |
| **Architectures** (`/architectures/`) | Reference architectures, patterns, decision notes and principles, with their diagrams, tables and cross-links | [`workstreams/reference-architectures/`](../workstreams/reference-architectures/) |
| **Use cases** (`/use-cases/`) | The inventory as a searchable, filterable list with one page per use case, plus the classification schema | [`workstreams/critical-use-cases/`](../workstreams/critical-use-cases/) |
| **Contribute** (`/contribute/`) | Eight ways in, and a proposal form for new terms | this site |

**The Markdown is the source of truth.** The site is generated from it, so a merged pull request is the only way anything changes. The site never stores edits.

## Run it

Requires Node 20 or later. There are **no packages to install**: no `npm install`, no package registry, no CDN or web fonts.

```bash
node site/serve.mjs          # build, serve on http://127.0.0.1:4173, rebuild on change
node site/build.mjs          # one-off build into site/dist
node --test site/test/*.test.mjs
```

A malformed source file fails the build with a file and line number (a term with no definition, a duplicate term name, a use-case row with the wrong number of cells, a missing column). CI runs the same build on every pull request.

## What gets generated

| Output | Source |
|---|---|
| `index.html` | Landing page: the three workstreams with live counts, the mission and charter scope from `README.md` and `charter/charter.md` |
| `terms/` and `terms/<slug>/` | Taxonomy index and one page per term |
| `architectures/` | Index of architectures, patterns, decisions, principles and background reading |
| `architectures/<name>/`, `architectures/patterns/<name>/`, … | One page per document, with an outline, its facts block and status, and diagrams |
| `use-cases/` and `use-cases/<slug>/` | Filterable index and one page per use case |
| `use-cases/about/`, `use-cases/classification/` | The inventory's introduction and the classification schema |
| `contribute/` | Ways to contribute and the proposal form |
| `terms.json` | Machine-readable copy of the taxonomy |

Documents are rendered from their Markdown, including tables, nested lists and code. Links between documents are rewritten to stay on the site; links to anything else (the charter, a file the site does not render) go to GitHub. A link to a heading that does not exist is shown as plain text instead of a dead link.

## Diagrams

`mermaid` code blocks render in the browser using a pinned copy of [Mermaid](assets/vendor/mermaid/README.md) that is committed to the repository (MIT licence, checksums recorded), so the build needs no package registry. Only pages that contain a diagram load it. With JavaScript off, or if rendering fails, the diagram shows as its Mermaid source. Every diagram has an **Expand** button for full width.

## Search and filters

- **Taxonomy:** matches the name, category, aliases, definition, notes and scope (`activity` also finds `Activities`). While searching, each result expands to show everything known about it, with matches highlighted.
- **Use cases:** the same search, plus filters for human-in-the-loop, agent count, workflow pattern and trigger. The URL keeps the search and filters, so a filtered view can be shared.

## How people contribute from the site

There is no backend. Every action hands the contributor to a place where the group already works:

- **Term pages:** *Suggest a change* and *Add a scope note* open a GitHub issue with the term, category, source line and current wording already filled in.
- **Propose a term** (contribute page): a form with a live preview that produces the exact Markdown for `terms.md`, a prefilled GitHub issue, or a prefilled email to the working group mailing list.
- **Architecture, pattern and decision pages:** *Comment on it*, *It didn't fit my workflow* and *Edit on GitHub*.
- **Use case pages:** *Suggest a correction* opens an issue with the row referenced; the about page carries the row template for adding a new use case.
- **Everywhere:** *Edit on GitHub* opens the editor on the source file for a direct pull request.

Opening a pull request automatically from a proposal is deliberately left for later; it needs a small service or a GitHub App.

## Optional per-term fields

A term is a `###` heading followed by its definition paragraph. Any further paragraph that starts with a bold label is shown on the term page as a fact:

```md
### Workflow Execution

A runtime instance of a Workflow definition. …

**Scope:** Covers one run, not the definition it came from.

**Also known as:** Run, Instance
```

`Scope` fills the Scope panel and removes the "No scope note yet" prompt. `Also known as` is added to search. Other labels are displayed as written.

## What the parsers expect

- **Architecture documents:** a `# Title`, optionally followed by `**Label:** value` lines (shown as a facts block; the first one becomes the page's lead sentence) and a `## Status` section (shown as a pill). Files named `TEMPLATE.md`, `README.md`, `AGENTS.md` and `CONTRIBUTING.md` are not turned into pages. New files in `architectures/`, `patterns/`, `decisions/` and `docs/` appear automatically, ordered as the workstream README mentions them.
- **Use-case inventory:** one `### Category` heading per table under `## Use Case Inventory`. Columns are found by header name, so they can be reordered. Classification values are written as `` `Value` `` with an optional `(qualifier)` and footnote marker.

## Publishing

`.github/workflows/site.yml` tests and builds on every pull request that touches the site or its sources, and publishes `site/dist` to GitHub Pages on pushes to `main`. A repository admin enables it once under **Settings → Pages → Source: GitHub Actions**. All internal links are relative, so the site works under a project path such as `/wg-workflows-and-process-integration/`.

To try it before it is merged, enable Pages on a fork and merge the branch into the fork's `main`; the site then appears at `https://<your-user>.github.io/wg-workflows-and-process-integration/`. Links that point back at GitHub (issues, edit links) always target the working group's repository. To point them somewhere else, set `SITE_REPO` and `SITE_BRANCH` when building.

## Layout

```text
site/
  build.mjs        entry point: parse → render → write dist
  serve.mjs        local preview with rebuild on change
  lib/             parsers (terms, docs, use cases, charter), markdown, autolink,
                   link rewriting, github links, page templates
  assets/          styles.css, app.js, vendor/mermaid (pinned, see its README)
  test/            node:test unit tests
```
