# Mermaid (vendored)

Renders the `mermaid` code blocks in the reference-architecture documents as diagrams, in the browser.

| | |
|---|---|
| Package | `mermaid@11.17.2` (MIT, see `LICENSE`) |
| File | `dist/mermaid.min.js`, unmodified |
| Registry | `https://nexus.equinix.com/repository/Equinix-NPM-Release/` |
| npm integrity | `sha512-V6K3C8EBdEsPFZXSKMJe6ppQOENxuHARr9GvHX4hh47lAbhMRD9qf4oEK7LoaRQxULMa80/qt5gHO73aCleBBg==` (of the `.tgz`) |
| SHA-256 of `mermaid.min.js` | `581ed7d74bd9048d0e3a91363927d72ef22942d7722546b27f7cc29e35390eb8` |

It is committed rather than installed so the GitHub Pages build needs no package registry. Only pages that contain a diagram load it. Without it (or without JavaScript) a diagram falls back to its readable Mermaid source.

## Update it

```bash
npm pack mermaid@<version> --registry https://nexus.equinix.com/repository/Equinix-NPM-Release/
tar -xzf mermaid-<version>.tgz package/dist/mermaid.min.js package/LICENSE
cp package/dist/mermaid.min.js site/assets/vendor/mermaid/
shasum -a 256 site/assets/vendor/mermaid/mermaid.min.js
```

Then update the version and both checksums above.
