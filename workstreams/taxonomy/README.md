# Taxonomy

This workstream establishes a shared vocabulary for the Workflows and Process Integration Working Group. Common terminology reduces ambiguity across specifications, reference architectures, and use case documentation produced by the WG.

> **Status:** The initial set of terms is in review. Definitions, scope, and term names are subject to change as WG discussions progress.

## Contents

- [terms.md](terms.md) — Core workflow terms proposed for the WG taxonomy
- [site/](../../site/README.md) — Static website generated from this workstream and the others, for browsing, searching, and contributing

## Contributing

1. Open a pull request with proposed additions, edits, or deletions.
2. Reference the term by name in the PR description and link to any relevant WG discussion or issue.
3. Substantive changes to existing terms should be discussed in a WG meeting or on the mailing list before merging.

The website's term pages and contribute page produce prefilled issues and ready-to-paste Markdown, so you can start there if you prefer.

### Term format

Each term is a `###` heading under a `##` category, followed by its definition paragraph. A paragraph that starts with a bold label adds optional detail that the website displays:

```md
### Term Name

One or two sentences defining it.

**Scope:** What it includes, what it leaves out, and what it is not to be confused with.

**Also known as:** Alias, Another alias
```

Capitalise other defined terms (for example "Workflow", "Activity") wherever a definition refers to them; the website turns those mentions into links.

## Related Workstreams

- [Reference Architectures](../reference-architectures/README.md) — Architecture patterns that apply these terms
- [Critical Use Cases](../critical-use-cases/) — Use cases that apply these terms
