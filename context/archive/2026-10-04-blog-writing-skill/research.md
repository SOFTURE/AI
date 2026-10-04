# Research: blog-writing-skill

Sources read: FIRE_TRACKER (read only, commit `15ec77e`) `.claude/skills/blog-pisz/` (`SKILL.md` and
`references/struktura.md`, `szablon.md`, `wzorce.md`, `recenzent.md`; 379 lines, Polish) and
`src/lib/blog/quality/skill-sync.test.ts`; SOFTURE `modules/blog/src/quality/` (`catalog.ts`,
`settings.ts`, `options.ts`, both rulesets), `src/cli/` (`run.ts`, `command.ts`), `src/options.ts`,
`content/article-file.ts`, the module README, `docs/04-skills.md` and the root `.gitignore`.

## What FIRE does

- `SKILL.md`: eight steps. A question in one sentence; numbers first (legal constants from FIRE's
  engine tables, primary sources, the engine's own numbers for a sample person); a draft by the
  structure reference; a rewrite by the patterns reference (rewrite the paragraph, never patch a
  phrase, add no fact without a source); the gate (`npm run blog:sprawdz`, fix every error in the
  text, read every warning); a sceptical reviewer agent started without the author's context (below
  35/50 or any blocking item: rewrite); the gate with `--external`; publish, which runs the gate
  again. Plus "refreshing numbers" and "what we never do".
- `struktura.md`: lead with the answer and a number (≤ 90 words), question headings with a
  quotable first sentence, the engine's number for a sample person, "when it does not work",
  footnotes, metadata, links, the disclaimer is the page's.
- `szablon.md`: a full file template for an article and for a glossary term.
- `wzorce.md`: one table row per rule id (red rules and warnings) with the pattern and what to write
  instead, plus what the gate cannot catch.
- `recenzent.md`: the reviewer's prompt (seven answers, a score out of 50, a blocking list).
- `skill-sync.test.ts`: greps rule ids out of the gate's source and checks each one stands in
  backticks in `wzorce.md`. One direction only: a stale id in the doc passes.

## Generic and FIRE-specific

Generic (goes into the package): the procedure, answer-first structure, footnotes and sources, the
template (with SOFTURE's English frontmatter keys), the rewrite principle, the reviewer, the
"what the gate cannot catch" list, never working around the gate.

FIRE's own (stays out): the engine and calculator numbers, the scenario field, charts, legal fact
rules (`fakt-*`), the brand's name and tone. In SOFTURE they are the app's: `fields`, block plugins
and rule plugins. Plugin and voice rules reach the skill through the catalog with their own
descriptions. FIRE's procedure step "numbers from our engine" has no generic form; an app section
in the generated skill would carry it (gap, below).

## Unknown answered

**Where the skill lives.** In `@softure-ai/blog`, not `@softure-ai/skills`. The skill is useless
without the module, its content depends on the app's config (language, voice, YMYL, limits,
plugins), and `@softure-ai/skills` installs fixed workflow skills with the `softure-` prefix into a
managed `.gitignore` block. A generated, app-specific skill does not fit there.

## Design choices

1. **A generated skill, not a copy.** The package ships templates in `modules/blog/skill/`; the
   command renders them with the app's settings. Placeholders `{{name}}` and sections
   `{{#flag}}…{{/flag}}` / `{{^flag}}…{{/flag}}`; an unknown name is an error, so a template typo
   cannot ship an empty value.
2. **Rules from the catalog.** `references/rules.md` holds one table row per built-in rule with
   guidance for the writer. On install, rows of rules the app's settings leave out (YMYL off,
   `title-case-heading` under `en`, a rule set to "off") are dropped, the effective severity is
   filled in, and the app's voice phrases and plugin rules are appended from the catalog. The
   installed skill names exactly the catalog's rules, in both directions.
3. **Sync test in both directions.** The template rows equal the union of `listQualityRules` for
   both languages with every switch on (YMYL, first person, blocks, plugins), minus app-defined ids.
   Rule mentions in prose (``rule `id` ``) must be catalog ids. This is stricter than FIRE's test.
4. **Name and place.** `.claude/skills/blog-write/` by default (`--dir` to change): no `softure-`
   prefix, so it never collides with the managed block of `@softure-ai/skills`. The app commits it,
   so agents in fresh clones have it.
5. **Ownership.** The installed `SKILL.md` carries a generated marker. Install refuses a folder whose
   `SKILL.md` lacks it (a skill the app wrote itself) and overwrites one that has it.
6. **Drift.** `--check` renders in memory and compares with the folder: exit 1 naming the files that
   differ or are missing, so CI catches a config change without a reinstall.
7. **Command in the text.** The skill names the command an agent runs. Default `npx softure-blog`;
   `--command "npm run blog --"` for apps that wrap `runBlogCli` in a script.

## Fit to SOFTURE contracts

- `runBlogCli` takes the config already; `skill install` needs no database and reads
  `getBlogOptions` and `getQualitySettings`. With `quality: false` the command refuses: the skill
  is built on the gate.
- Templates are found relative to the module: `new URL("../../skill/", import.meta.url)` resolves
  to `modules/blog/skill/` from both `src/cli/` and `dist/cli/`. `package.json` `files` gains
  `skill`.
- Repository gates: the templates are English (language gate) and their relative links resolve
  (links test).

## Risks

- A template that drifts from the gate: covered by the two-way sync test.
- Generated text with an unfilled or wrong value: the renderer refuses unknown names, and a test
  renders the skill for the `en` defaults and for a FIRE-like `pl` config.

## Gaps for roadmap-blog-followups

- App sections in the generated skill (FIRE's engine numbers, calculator scenario, chart block):
  an option such as `blog({ skill: { notes } })` or a preserved local file.
