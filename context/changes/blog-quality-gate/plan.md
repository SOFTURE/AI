# Plan: blog-quality-gate

Input: change.md, research.md. Complexity: medium (a port of 1.6k lines of rules into a configurable
engine, a second ruleset, two CLI touch points and a workflow; each part has its FIRE original).

## Goal

`@softure-ai/blog` checks article files before every publish and on demand: `softure-blog check
[path…] [--external] [--today YYYY-MM-DD]` prints `file:line: severity [rule] message` and exits 1 on
any error; `softure-blog publish` refuses a file going public with an error. The app configures the
gate in `blog({ quality })`: language ruleset (`pl`, `en`), YMYL switch, voice, paths, limits, rule
severities and rule plugins. FIRE's fixtures, converted to the English frontmatter, give FIRE's
findings through the `pl` ruleset plus two test plugins standing in for FIRE's facts and chart rules.

**Out of scope:** the writing skill and its sync test (BL-7; this change exports the rule catalog it
needs), rendering and block plugins (BL-3), pages (BL-4), FIRE's adoption (FIRE's own roadmap).

## Approach

**Starting point:** BL-2's `PublishGate` hook, unused; FIRE's gate is Polish-only, with FIRE literals
(domain, engine mark, routes, voice) inside the rules.

**Chosen:** an engine in `modules/blog/src/quality/` that takes a resolved settings object (ruleset,
switches, limits, link resolver, plugins) and runs rule groups over parsed blocks. Language data
lives in `src/quality/rulesets/<lang>/`; everything FIRE-specific becomes an option or a test plugin.
Rejected: a Markdown AST library (BL-3 picks the renderer in parallel; FIRE's block splitter is enough
for line-level rules and adds no dependency); Polish messages in dictionaries (research U2).

**Key decisions:**
| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Frontmatter | reuse `parseArticleFile`; its errors become `file` findings | one schema | research |
| Messages | English, rule ids English and stable | developer and agent output | research U2 |
| Voice | `voice.forbidFirstPersonSingular`, `voice.phrases[{ id, pattern, message, severity? }]` | FIRE's voice is config | research U1 |
| YMYL | `ymyl: false` (default) or `{ ownCalculationMark? }`; true turns on sources, number sources, profit promises | switch per app | roadmap |
| Severity | `severity: { <rule>: "error" \| "warning" \| "off" }`, also for plugin rules | a generic app can relax a rule | research Risks |
| Limits | `limits` with FIRE's values as defaults | generic | research |
| Paths | `paths.articles` `/blog`, `paths.terms` `/blog/glossary`; `ownOrigins` (absolute URLs read as internal) | BL-4 reuses them | research |
| App routes | `appDir` (default `src/app`, else `app`), `privateRouteSegments` (default `["api"]`) | FIRE's scan without FIRE literals | research |
| Plugins | `{ name, rules: [{ id, severity, description }], check(context) => findings }`; an undeclared rule id is an error finding | the catalog stays complete for BL-7 | roadmap |
| Catalog | `listQualityRules(settings)` → every rule id with group, severity, description | BL-7 sync test | roadmap |
| Off switch | `quality: false`; `runBlogCli({ gate })` still wins | BL-2 tests, special apps | research |
| Today | `quality.timeZone` (default `UTC`) on the run's `Clock`; `--today` for `check` | module contract | research |
| Polish data | language gate exempts folders named `pl` | locale data, not code | research |

**Rule id map (FIRE → package):** parse→`file`; frontmatter-title-length→`title-length`;
frontmatter-description-length→`description-length`; frontmatter-as-of→`as-of-future`; stale;
sources-missing; sources-url→`source-https`; lead; lead-length; lead-number; heading-h1;
sections; sections-question→`section-question`; sections-answer→`section-answer`; length;
number-source; footnote-undefined; footnote-unused; footnote-source; footnote-not-in-sources;
internal-links; internal-link-target; external-link-https; external-link-dead;
warto-zauwazyc→`announcement`; dzisiejsze-czasy→`these-days`; nie-tylko-ale→`not-only-but-also`;
to-nie-x-to-y→`not-x-but-y`; metakomentarz→`meta-commentary`; otwieracze→`throat-clearing`;
podsumowujac→`empty-conclusion`; kluczowy→`crucial`; odgrywa-role→`plays-a-role`;
nadete-znaczenie→`puffery`; formulki-czatu→`chatbot-phrases`; pierwsza-osoba→`first-person-singular`;
obietnice-zysku→`profit-promise`; emoji; slowa-wypelniacze→`filler-words`; wykrzykniki→`exclamation`;
cudzyslow-angielski→`straight-quotes`; myslniki→`dashes`; pogrubienia→`bold-density`;
pogrubione-etykiety→`bold-labels`; trojki→`triads`; dlugie-zdania→`long-sentences`;
monotonny-rytm→`monotone-rhythm`; powtorzone-poczatki→`repeated-openings`;
naglowek-wielkie-litery→`title-case-heading`. New: `summary-missing` (roadmap "summary present"),
`heading-order` (a heading skips a level). FIRE's fakt-* and wykres-zgodnosc: test plugins.

**Critical details:**
- Findings sort errors first, then by line, as FIRE. Warnings of a pattern aggregate to one finding
  with a count. Title and description run through the error patterns, prefixed `title or description:`.
- Significant numbers follow the ruleset's notation (thousands and decimal separators, units before
  and after, legal reference prefixes); years 1900–2100 and numbers glued to letters are skipped.
- The publish gate passes every internal link (FIRE: the container may have no app folder; `check`
  in CI resolves them). `check` resolves articles and terms from the content folder by `kind`.
- External links only with `--external`, through an injected `fetch` (HEAD, GET retry on
  400/403/404/405/501, 15 s timeout, a generic user agent), each URL once.

## Phase 1: Engine, rulesets and rules

1. `src/quality/finding.ts`, `blocks.ts` (ported `splitBlocks` + body start line), `text.ts` (prose,
   words, sentences, links, footnotes, numbers by notation).
2. `src/quality/rulesets/{types.ts,pl/ruleset.ts,en/ruleset.ts,index.ts}`: patterns, voice and YMYL
   patterns, notation, triad conjunctions, Title Case rule.
3. `src/quality/rules/{structure,links,ymyl,style,rhythm}.ts`, `settings.ts` (options → settings,
   catalog), `check-article.ts` (`checkArticleText(text, fileName, settings)`), `plugin.ts` types.
4. `scripts/check-language.mjs`: exempt `pl` folders; `tests/repo/language.test.ts` case; AGENTS.md line.

### Phase 1 checks
- Automated: `tests/quality/check-article.test.ts` (FIRE `check-article.test.ts` and
  `parse.test.ts` cases on the converted fixtures, with the facts and chart test plugins),
  `tests/quality/en.test.ts` (an English model text passes, an AI-sounding one names its rules),
  `tests/quality/settings.test.ts` (severity override, `off`, undeclared plugin rule, catalog); gates green.

## Phase 2: Options, CLI, links and workflow

1. `options.ts`: `quality` schema (zod, plugins by shape); `server/index.ts` exports the gate API.
2. `src/quality/{link-targets,external-links,gate,check-files}.ts`: route scan, content kinds,
   network check, `createQualityGate(settings, clock)` for `PublishGate`.
3. `cli/run.ts`: `check` command (no database), `publish` builds the gate from the config unless
   `gate` is passed or `quality: false`; usage text; `command.ts` unchanged except usage.
4. `.github/workflows/blog-links.yml` (`workflow_call`, `permissions: contents: read`).
5. README: section on the gate (options, rules table, plugins, workflow snippet), FIRE adoption notes.

### Phase 2 checks
- Automated: `tests/quality/links.test.ts` (FIRE `links.test.ts` cases with generic paths),
  `tests/quality/gate.test.ts` (FIRE `publish-gate.test.ts`), `tests/cli.test.ts` (check: green,
  red exit 1, `--external` with a fake fetch, `--today`, usage; publish refuses a gated file with the
  default gate); `npm run build`; gates green.
- Manual: `softure-blog check` over the fixtures from the built bin.

## Risks and rollback

- Risk: a rule too strict for apps → severity override per rule; defaults documented.
- Risk: the `pl` folder exemption hides English code put there → the folder holds ruleset data and
  fixtures only; review checks it.
- Rollback: revert the merge; no migration, no data.

## Decisions (auto)

- `summary-missing` is an error for articles (roadmap: "summary present"); FIRE's model fixture gains
  a `summary` in the conversion.
- `current_as_of` required: BL-2's parser already requires it for every file; the YMYL switch does
  not repeat it.

## Progress

### Phase 1: Engine, rulesets and rules

#### Automated
- [ ] 1.1 Article check, English ruleset and settings tests pass
- [ ] 1.2 Gates green (typecheck, lint, test)

### Phase 2: Options, CLI, links and workflow

#### Automated
- [ ] 2.1 Link, gate and CLI tests pass
- [ ] 2.2 Gates green (typecheck, lint, test, build)

#### Manual
- [ ] 2.3 `softure-blog check` over the fixtures from the built bin
