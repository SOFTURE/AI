# Plan: blog-writing-skill

Change: [`change.md`](change.md). Research: [`research.md`](research.md).

## Goal

`softure-blog skill install [--dir <path>] [--command <cmd>] [--check]` writes a writing skill,
generated from the app's config, into `.claude/skills/blog-write/`. The skill names exactly the
rules the app's gate enforces, with their severity. A two-way sync test keeps the shipped templates
and the gate's catalog in step.

## Approach

Templates in `modules/blog/skill/` (`SKILL.md`, `references/structure.md`, `template.md`,
`rules.md`, `reviewer.md`), English, adapted from FIRE's `blog-pisz` without its domain.
`src/cli/skill.ts` renders them: placeholders and boolean sections from a values object built from
`getBlogOptions` and `getQualitySettings`, then the rules table filled from `listQualityRules`.
`run.ts` gains the `skill install` command; it writes files, refuses a folder it did not generate,
and with `--check` only compares.

## Phase 1: Templates and renderer

1. `skill/` templates. `SKILL.md` frontmatter (`name: blog-write`, a description with triggers),
   the generated marker, the procedure (question, sources, draft by structure, rewrite by rules,
   `check`, reviewer agent, `check --external`, `publish` dry run then `--commit`), refreshing a
   text, what never to do. `rules.md`: one row per built-in rule
   (`` | `id` | | guidance | ``) under group headings, a `{{appRules}}` slot, and what the gate
   cannot catch. YMYL and first-person passages in sections.
2. `src/cli/skill.ts`: `getSkillValues(config, options)`, `renderSkillTemplate(text, values)`
   (unknown name or unclosed section throws, naming it), `fillRulesTable(text, rules)` (drop rows of
   rules not in the catalog, fill the severity, append app rules), `renderBlogSkill(config, options)`
   returning `{ path, text }[]`, `findSkillTemplateRules()` for the sync test.
3. Tests: renderer cases (value, section on and off, inverted section, unknown name, unclosed
   section); rendered skill for the `en` defaults and a FIRE-like `pl` config (YMYL with a mark,
   first person, a voice phrase, a plugin, a severity override to "off"): no `{{` left, every
   catalog rule named once with its severity, no other rule row, the YMYL passages present only
   with YMYL.
4. Sync test: template rows equal the union of `listQualityRules` for `en` and `pl` with every
   switch on, minus voice phrases and plugin-declared rules; every ``rule `id` `` mention in any
   template is in that union.

### Phase 1 checks

- `npm run typecheck`, `npm run lint`, `npm test` green.

## Phase 2: Command and docs

1. `run.ts`: `BlogCommand` gains `{ kind: "skill-install", dir, command, check }`; parse
   `skill install`, refuse another subcommand; `runSkillInstall` reads options (refuses
   `quality: false`), renders, then either compares (`--check`: exit 1 listing differing or missing
   files) or writes (refuses a folder whose `SKILL.md` lacks the marker; creates folders). No
   database. Usage text updated.
2. `package.json` `files` gains `skill`; description mentions the skill.
3. README: a "Writing skill" section (command, options, commit the folder, `--check` in CI,
   what fills it); limitations line for the app sections gap.
4. Tests in `tests/skill-cli.test.ts`: install into a temp folder writes the five files; a second
   install overwrites; a folder with a foreign `SKILL.md` is refused and untouched; `--check` green
   after install, red after a config change and on a missing folder; `quality: false` refused;
   usage errors exit 2.
5. Gap BF-9 in `roadmap-blog-followups` (app sections in the generated skill).

### Phase 2 checks

- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` green.
- Manual: the built bin installs the skill into a throwaway app with the example app's blog config.

## Risks and rollback

- Low: a new command and static files; nothing in the publish path changes. Rollback: revert the
  merge commit.

## Decisions (auto)

- Skill folder `blog-write`, no `softure-` prefix (research 4).
- `--command` default `npx softure-blog`.
- The example app is verified by a test with its blog options (BL-4 adds `blog()` to it in
  parallel); the installed folder is not committed to the example in this change.

## Progress

### Phase 1: Templates and renderer

#### Automated
- [x] 1.1 Renderer, rendered skill and sync tests pass — d3b333c
- [x] 1.2 Gates green (typecheck, lint, test) — d3b333c

### Phase 2: Command and docs

#### Automated
- [x] 2.1 Skill CLI tests pass — d3b333c
- [x] 2.2 Gates green (typecheck, lint, test, build) — d3b333c

#### Manual
- [x] 2.3 `softure-blog skill install` from the built bin in a throwaway app — d3b333c (verified by agent: built `dist/cli/bin.js` in a throwaway app with `softure.config.mjs` and `blog()`; install wrote the five files, `--check` was green, then red with exit 1 after a file was edited; `skill nope` exits 2 with the usage; `npm pack --dry-run` ships `skill/`)
