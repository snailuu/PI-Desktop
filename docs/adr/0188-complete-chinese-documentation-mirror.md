# ADR 0188: Complete the Chinese documentation mirror

- **Status:** Accepted
- **Date:** 2026-09-09
- **Amends:** ADR 0079

## Context

ADR 0079 scoped the Chinese site to a translated orientation layer plus a
path-for-path companion for `docs/spec/`. VitePress builds the alternate-locale
URL by prefixing the locale to the current path and never checks whether the
target page exists, so every page without a Chinese counterpart — ADRs, project
records, and the docs README — produced a 404 from the language switcher.
Navigation pages that existed only in Chinese produced the same 404 in the
other direction. The locale gate also covered only the specification tree, so
ADR and project coverage gaps were invisible.

## Decision

1. Mirror every documentation tree path for path: `spec/`, `adr/`, `project/`,
   `guide/`, `plugin-development.md`, and the docs `README.md` all have
   Simplified Chinese counterparts under `docs/zh-CN/` with the same relative
   paths and routes.
2. Keep English canonical. Every Chinese page carries a translation notice that
   links to its English route; code, protocol fields, identifiers, and link
   targets stay unchanged.
3. Add the English counterparts of the navigation pages that existed only in
   Chinese: the specification map, its eight topic landings, and the curated ADR
   entry.
4. Extend `pnpm docs:check` from the specification tree to every mirrored tree
   in both directions, with structural fidelity checks (headings, code blocks,
   table rows and cells) and dangling `/zh-CN/` link detection.

## Consequences

- The language switcher resolves on every page in both locales; no mirrored
  route is missing on either side.
- A documentation change must update the Chinese companion in the same logical
  change, and the gate fails while a page, a table row, or a code block is
  missing.
- Machine-assisted translations now cover the ADR and project records; reviewers
  remain responsible for terminology when a decision changes.
- The Chinese mirror is a full maintenance surface rather than an orientation
  layer, so translation work is part of every documentation change.

## Alternatives

- Hide or redirect the language switcher on untranslated pages: rejected because
  it leaves the Chinese site incomplete and keeps English-only pages reachable
  only by accident.
- Translate only the ADR index and keep the records English: rejected because
  Chinese navigation still lands on English pages.
- Keep the gate scoped to specifications: rejected because ADR and project
  mirrors would keep drifting without detection.
