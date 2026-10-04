# Research: blog-quality-gate

Sources read: FIRE_TRACKER (read only, commit `15ec77e`) `src/lib/blog/quality/**` (15 files, 2.2k
lines with tests and two fixtures), `scripts/blog-check.mts`, `.github/workflows/blog-links.yml`;
SOFTURE `modules/blog/` (BL-2: `content/article-file.ts`, `db/publish-run.ts`, `cli/*`, `options.ts`),
`scripts/check-language.mjs`, [`docs/06-fire-extraction-2.md`](../../../docs/06-fire-extraction-2.md).

## What FIRE does

| Part | FIRE file | Behaviour |
| --- | --- | --- |
| Finding | `finding.ts` | `{ rule, severity: "error" \| "warning", message, line? }`; errors block a publish |
| Parse | `parse.ts` | own YAML subset for the Polish frontmatter; `splitBlocks` cuts the body into headings, paragraphs, list items, tables, quotes, footnote definitions and `::` directives with file lines; fenced code and HTML comments skipped |
| Text | `text.ts` | prose without markup, word count, sentence split (not before a digit), Markdown links, footnote refs, "significant numbers" (amounts, percents, ≥ 1000, not years, not legal references) in Polish notation |
| Structure | `rules-structure.ts` | required keys, slug = file name, title ≤ 70 and description 50–160 (warnings), `aktualne_na` not in the future, stale after 365 days (warning), sources required with https, lead is a paragraph (≤ 90 words, a number in the first two paragraphs), no H1, ≥ 2 H2, one H2 is a question with a paragraph answer (≤ 70 words), length 600–4000 (article) / 60–700 (term), every significant number carries a footnote whose URL is in `zrodla` or names the engine, internal links (≥ 2 for an article) resolve, `http://` warned |
| Style | `rules-style.ts` | 16 Polish regex patterns (13 errors, 3 warnings, warnings aggregated per rule) incl. AI tics, first person singular (FIRE's "editorial we" voice), profit promises (YMYL), emoji; rhythm: dashes (error over 1 per 150 words), bold density, bold labels, triads, long sentences, monotone rhythm, repeated openings, Title Case headings |
| Facts | `rules-facts.ts` | FIRE domain: IKE/IKZE limits, PIT, Belka equal the engine's tables |
| Chart | `rules-chart.ts` | FIRE domain: numbers next to `::wykres{…}` stand in the chart's table |
| Links | `link-targets.ts`, `external-links.ts` | routes from `src/app` (route groups dropped, `(app)` and `api` private), articles and terms by file under fixed paths; external: HEAD, GET retry on 400/403/404/405/501, 15 s timeout, user agent, 2xx after redirects |
| Entry points | `check-article.ts`, `check-file.ts`, `publish-gate.ts`, `scripts/blog-check.mts` | one pure `checkArticle`; the script prints `file:line: severity [rule] message`, exit 0/1/2; the publish gate skips internal targets (FIRE's container has no `src/app`) |
| CI | `blog-links.yml` | weekly Monday cron + manual, `permissions: contents: read`, `npm ci`, gate with `--external` |

## Unknowns answered

**U1. Generic Polish versus FIRE's voice.** Split by "would any careful Polish editor flag it":

- **Generic `pl` style (ruleset):** announcements ("it is worth noting"), "these days" openers,
  "not only… but also", "it is not X, it is Y", meta commentary, throat-clearing openers, empty
  conclusions, the Polish "crucial" tic, "plays a role", puffery (minus the finance phrases), chatbot
  leftovers, emoji, filler words, exclamation marks, straight quotes (Polish typesetting uses its own
  low-high quotes), Title Case headings; all rhythm measures. (The Polish phrases themselves live in
  the ruleset; the plan maps FIRE's rule ids.)
- **Voice (config):** first person singular is FIRE's choice ("texts are signed by the editors"), not
  Polish. The ruleset provides the pattern; `voice.forbidFirstPersonSingular` turns it on. FIRE's
  finance puffery ("in the world of finance") moves to `voice.phrases`, which takes any app phrase
  with a message; the generic Polish idiom "in the thicket of" stays in the ruleset.
- **YMYL (switch):** profit promises and buy orders, sources required, https sources, every significant
  number footnoted to a listed source or the app's own calculation mark (FIRE's "Plan Majatku
  calculation" footnote, now `ymyl.ownCalculationMark`). `current_as_of` is already required by BL-2's
  parser for every file; its checks (not in the future: error, older than a year: warning) apply to
  every app.
- **Domain (plugins):** facts and charts stay in FIRE; the test writes them as plugins with fixed
  tables to prove the API.

**U2. English messages or dictionaries.** English only. Findings are developer and agent output, like
the publish command's lines (BL-2 decided the same), and the writing skill (BL-7) names rules by id.
Rule ids are English and stable (`announcement`, `crucial`, `dashes`…); FIRE's Polish ids map one to
one (table in the plan). A Polish message dictionary would double every message for no reader: the
editors are agents following the skill.

## Fit to SOFTURE contracts

- **Parsing:** the gate reuses BL-2's `parseArticleFile` for the frontmatter (one schema, no second
  YAML reader); its errors become `file` findings. Only `splitBlocks` is ported, with line numbers from
  the closing `---`. FIRE's frontmatter checks that BL-2 already enforces (required keys, kind, slug
  shape, slug = file name, date format) disappear from the gate.
- **Configuration:** `blog({ quality })` in `options.ts`, parsed by zod at startup like `fields`;
  `quality: false` turns the gate off. Plugins are objects with functions (`z.custom`, as `fields`).
- **Publish hook:** `runBlogCli` builds the gate from the config unless the caller passes `gate`.
  BL-2's CLI tests publish a short fixture as `published`; they pass `quality: false`.
- **Paths:** BL-4 owns the pages. The gate needs the article and glossary paths to resolve internal
  links, so they are options (`paths.articles`, default `/blog`; `paths.terms`, default
  `/blog/glossary`); BL-4 reads the same options.
- **Routes:** an app route exists when the Next app folder (`appDir`, default `src/app` then `app`)
  has a `page.*` or `route.*` for it; route groups vanish from the path, private segments (default
  `api`) and `_folders` are skipped.
- **Clock:** "today" comes from `Clock` (publish: the run's clock; check: `systemClock`, `--today`
  overrides) in `quality.timeZone` (default `UTC`).
- **Language gate:** the `pl` ruleset spells Polish words and FIRE's fixtures are Polish texts; both are
  language data, not code. `scripts/check-language.mjs` exempts `messages/` folders only. Extending
  the exemption to folders named `pl` (locale data: a ruleset, its fixtures) keeps the rule narrow and
  meaningful: everything under a `pl/` folder is Polish by name.
- **Reusable workflow:** `.github/workflows/blog-links.yml` with `on: workflow_call` (inputs: Node
  version, working directory, command) plus a README snippet with the weekly schedule an app adds.

## Risks

- **Regex cost:** some FIRE patterns use lazy `{1,120}?` spans over prose; prose is a paragraph at a
  time, so there is no catastrophic backtracking (no nested quantifiers). Keep it that way.
- **Number notation:** the `en` ruleset needs "28,260.50", "$1,000", "5%"; the number reader becomes
  part of the ruleset (thousands and decimal separators, units before and after, legal references).
- **A gate too strict for a generic app:** severities can be overridden per rule (`severity: { id:
  "off" | "warning" | "error" }`), limits are options with FIRE's values as defaults.
- **BL-3 in parallel:** it may define block directives; the gate keeps FIRE's `::name{…}` directive
  blocks (skipped by prose rules, offered to plugins).
