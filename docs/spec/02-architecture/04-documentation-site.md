# Documentation site

## Status

Accepted. See [ADR 0079](../../adr/0079-vitepress-documentation-site.md).

## Decision

The `docs/` directory is a standalone VitePress project inside the pnpm
workspace. Markdown remains the source of truth; VitePress supplies the local
development server, static build, local search index, code highlighting, and
versioned navigation shell.

The site exposes two locale entry points:

- `/` — English-first complete documentation navigation.
- `/zh-CN/` — a Simplified Chinese mirror of every documented page at the same
  relative path.

For Vercel deployments whose Root Directory is `docs`, `docs/vercel.json`
declares the VitePress build output as `.vitepress/dist` and enables Vercel's
`cleanUrls` routing. This keeps extensionless links such as `/spec/README` and
`/adr/README` working after a direct page refresh instead of becoming static
hosting 404s.

Existing `spec/`, `adr/`, `project/`, and guide Markdown files remain in place
so repository links and review history stay stable. Chinese pages live under
`docs/zh-CN/` with the same relative paths as their English sources. Every
translated page links to the canonical English page and keeps code, protocol
fields, and identifiers unchanged. Both locale trees expose the same routes, so
the VitePress language switcher resolves on every page; the English counterparts
of the Chinese-only navigation pages (the spec map, its topic landings, and the
curated ADR entry) live at the same relative paths.

## Local commands

```bash
pnpm docs:dev
pnpm docs:build
pnpm docs:preview
pnpm docs:check
```

The production build is static and does not require a runtime service. The
site may load Google Fonts during development or deployment, but the content
and search index are generated locally by VitePress.

`pnpm docs:check` verifies that every mirrored English page has a matching
Chinese Markdown file at the same relative path, that every Chinese page has an
English source, and that the companion satisfies all of:

1. a top-level heading,
2. Chinese characters somewhere in the body,
3. a link to its canonical English route,
4. no leftover untranslated-placeholder token (the gate greps for it as a
   bare substring, so this page cannot quote it verbatim),
5. the same number of fenced code blocks as the English page,
6. the same table shape as the English page — the same number of table rows and
   the same count of `|` cells per row.

Conditions 5 and 6 make the gate structural rather than cosmetic: a Chinese page
that drops a table row or a code block is reported even when its prose reads
complete. The gate also reports links under `/zh-CN/` that do not resolve to a
mirrored page, and it exits non-zero on any coverage, fidelity, or link failure.
The VitePress production build separately validates the rendered routes and
internal links.

## Content rules

1. English remains the canonical source language for specs, ADRs, code
   identifiers, and protocol terms.
2. Every English page under the mirrored trees (`spec/`, `adr/`, `project/`,
   `guide/`, `plugin-development.md`, and this docs README) has a Simplified
   Chinese companion at the same relative path under `docs/zh-CN/`; both locales
   expose the same sections, routes, and reading order.
3. Chinese pages translate the complete prose, link back to the English source,
   and preserve code, protocol fields, and identifiers verbatim. When wording
   differs, the English contract remains authoritative.
4. The sidebar is derived from the Markdown tree so a new specification cannot
   be omitted from deep navigation by accident.
5. User-visible or protocol-visible documentation behavior belongs in the E2E
   test plan.
6. Navigation should expose the shortest useful path; deep files remain
   searchable and directly linkable.
7. A new page must land in both locales in the same logical change; the locale
   gate fails while a mirror or a mirrored table row is missing.
