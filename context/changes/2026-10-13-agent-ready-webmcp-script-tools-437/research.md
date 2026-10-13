---
change_id: agent-ready-webmcp-script-tools-437
---

# Research: agent-ready-webmcp-script-tools-437

Sources: `modules/agent-ready/src/webmcp/index.ts`, `tests/webmcp.test.ts`, `tests/webmcp-search.test.ts`,
`tests/architecture.test.ts`, `README.md`, `CHANGELOG.md`, issue #437, issue #415's archive.

- `buildWebMcpBootScript` wraps each `execute` source as `(\n<source>\n)` in an array and calls it as
  `X[i](args, h)`; it rejects sources containing `</script` or `<!--`. An IIFE that returns the function is a valid
  source and runs once per page load, which gives the script tool a page-lifetime cache like the JS tools.
- `h.fetchMarkdown` strips the frontmatter, but `searchSite` needs the frontmatter `title`; the script source does its
  own `fetch` with the same headers (`Accept`, `credentials: "omit"`).
- `architecture.test.ts` requires every file under `src/webmcp/` to import nothing, relative imports included: the
  script sources live in `index.ts` next to the JS tools.
- Sharing one implementation through `Function.prototype.toString()` is fragile: the function would run in the
  consumer's bundle (Next server build, coverage instrumentation, minifiers inject helpers or rename). Evaluating
  source in the JS tool needs `unsafe-eval` under CSP. So the logic exists twice (TypeScript and script source) and the
  test suite runs every behaviour test against both forms.
- The JS tools' answer texts: `No page matches "<q>" (<scope>).`, `<n> page(s) match(es) "<q>" (<scope>).`,
  `<n> page(s) searched` / `<r> of <t> pages searched`, `; <f> failed`, `no page could be read (<err>)`,
  `query must be a non-empty string`, `The glossary has no terms.`, `No glossary term matches "<t>".`,
  `No glossary term is exactly "<t>". Close terms:`, `term must be a non-empty string`. Input descriptions are in the
  two `*_INPUT_SCHEMA` constants.
- `Intl.PluralRules` is available in every browser that ships WebMCP and in Node 22; `Intl.LDMLPluralRule` types the
  categories (TS lib ES2018+, the base config targets ES2023).
