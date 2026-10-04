# Implementation review: blog-writing-skill

Reviewed: the diff of `claude/bl-7-0rg37c` against `master` (`modules/blog/skill/`,
`src/cli/skill.ts`, `src/cli/run.ts`, `src/cli/index.ts`, `package.json`, README, both new test
files, the followups entry) against plan.md, plan-review.md and FIRE's `blog-pisz`.
Verdict: **approved**; no blocking findings, two recorded below.

## Plan conformance

| Step | Result |
| --- | --- |
| 1.1 templates | `SKILL.md` (procedure, refreshing, what we never do, generated marker) and four references; FIRE's domain left out. |
| 1.2 renderer | `renderSkillTemplate` (values, sections, inverted sections, standalone lines, errors naming the tag), `fillRulesTables` (severity, description, dropped rows and empty tables, app rules), `renderBlogSkill`. |
| 1.3 tests | Renderer cases; defaults and a FIRE-like `pl` config; no `{{` left; exact catalog in the rules file. |
| 1.4 sync | Template rows equal the built-in rules of both languages with every switch on; prose mentions are catalog ids. |
| 2.1 command | `skill install [--dir] [--command] [--check]`, no database, refuses `quality: false` and a foreign `SKILL.md`. |
| 2.2-2.3 | `files` ships `skill/`; README section and limitation; BF-9. |
| Plan review F1-F5 | Four-column rules table (F1); `rules.md` declared authoritative in `SKILL.md` (F2); marker without date or version, render is deterministic (F3, test); `--dir` relative to `cwd`, parents created, folder shown relative (F4); term and article limits filled separately (F5). |

## Checks

| Check | Result |
| --- | --- |
| Gates | `npm run typecheck`, `npm run lint` (ESLint, language), `npm test` (3089 passed), `npm run build` green. |
| Two-way sync | A rule added to the catalog without a template row fails "names every built-in rule"; a stale row fails "names no rule the gate lacks". |
| Generated text | Every rendered file is checked for leftover tags under both configs; a reinstall with the same config is byte-identical. |
| Safety | Install writes only under the chosen folder and never replaces a `SKILL.md` without the marker; `--check` writes nothing. |
| Language | Templates and messages English; the Polish quotation marks of the `pl` ruleset's message reach only the app's generated file. |

## Findings

- R1 (accepted): a folder without `SKILL.md` but with other files is written into; a folder without
  `SKILL.md` is not a skill, so nothing of the app's is replaced by name except files the skill owns.
- R2 (accepted): the `SKILL.md` description is a plain YAML scalar with the content folder and the
  command in it; a value with `: ` or ` #` would break the frontmatter. Neither appears in a folder
  path or the documented commands.
