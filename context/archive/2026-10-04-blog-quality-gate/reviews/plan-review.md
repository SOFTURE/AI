# Plan review: blog-quality-gate

Reviewed: plan.md and research.md against FIRE's `src/lib/blog/quality/**` and its tests,
`scripts/blog-check.mts`, `.github/workflows/blog-links.yml`, and SOFTURE's `modules/blog/src/`
(`content/article-file.ts`, `db/publish-run.ts`, `cli/run.ts`, `options.ts`),
`scripts/check-language.mjs` and `tests/repo/language.test.ts`. Verdict: **approved** with five
findings folded into the steps (none blocking).

## Checks

| Check | Result |
| --- | --- |
| Outcome covered | Structure (answer first, heading order, length, summary), links (internal targets, glossary terms by kind, `--external`), style (two rulesets, AI patterns, voice from config), YMYL switch, plugin API, findings with severity and line, `check` exit code, publish refusal and the reusable workflow each have a step and a test. |
| Baseline | FIRE's `check-article.test.ts`, `parse.test.ts`, `links.test.ts` and `publish-gate.test.ts` map to package tests; `content.test.ts` (FIRE's own content folder) becomes the CLI `check` test over a fixture folder; `skill-sync.test.ts` is BL-7. |
| FIRE literals | Domain (`planmajatku.pl`), engine mark, routes (`/kalkulator`, `(app)`), voice and finance phrases all become options or test data; none stays in `src/`. |
| Contract for later items | BL-4 reads `quality.paths`; BL-7 reads `listQualityRules`; BL-3 is untouched (directives stay opaque blocks). |
| Scope | Only `src/quality/`, the gate wiring in `options.ts` and `cli/run.ts`, exports, README, tests, the workflow and the language gate exemption. |
| Language | English code and messages; Polish only under `pl/` folders (ruleset data, fixtures). |

## Findings

- F1 (into phase 2 step 2): the publish run has already parsed the file when it calls the gate. The
  gate must take the parsed `article` for frontmatter data and split only `file.text` into blocks,
  so the gate never disagrees with the run about the frontmatter (the app's `fields` and reserved
  slugs are applied once). `check` parses with the same options from the config.
- F2 (into phase 1 step 3): a plugin that throws must not crash a publish with a stack trace: catch it
  per plugin and report an error finding `plugin-failed` naming the plugin and the message.
- F3 (into phase 1 step 4): the language test must show both sides: `src/quality/rulesets/pl/x.ts` is
  exempt, a file named `pl.ts` outside `messages/` and a folder like `plan/` are not.
- F4 (into phase 2 step 3): `check` must not open the database or require `database.url`; a config
  without a database is valid for it.
- F5 (into phase 1 step 2): every pattern of both rulesets needs a test hit, or a typo in a regex
  silently disables a rule. Add a table test: each pattern id with one sample sentence that trips it.
