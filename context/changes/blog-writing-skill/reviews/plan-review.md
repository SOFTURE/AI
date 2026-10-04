# Plan review: blog-writing-skill

Reviewed: plan.md and research.md against FIRE's `.claude/skills/blog-pisz/` and
`skill-sync.test.ts`, and SOFTURE's `modules/blog/src/quality/catalog.ts`, `settings.ts`,
`options.ts`, `src/cli/run.ts`, `command.ts`, `src/options.ts` and `tests/repo/links.test.ts`.
Verdict: **approved** with five findings folded into the steps (none blocking).

## Checks

| Check | Result |
| --- | --- |
| Outcome covered | The skill (procedure: brief, sources, structure, frontmatter, gate, publish), the install command filled from ruleset and voice, and the two-way sync test each have a step and a test. |
| Baseline | FIRE's sync test (one direction, by grepping source) becomes a two-way test against `listQualityRules`; "installs into the example app" is a test with the example's blog options plus a manual run of the built bin. |
| FIRE literals | Brand, engine, calculator, scenario, charts and legal fact rules stay out; an app's own rules arrive through the catalog. |
| Scope | `skill/`, `src/cli/skill.ts`, the command in `run.ts`, `package.json` `files`, README, tests. BL-4's files untouched. |
| Language | Templates and generated text are English; the skill states the article language. |

## Findings

- F1 (into phase 1 step 1 and 2): the rules table carries two texts per rule: what the gate looks
  for (the catalog's description, which for style and voice rules is the ruleset's or the app's own
  message) and what to write instead (the template's guidance). Columns: rule, severity, what the
  gate looks for, what to write instead. App rules get the description only.
- F2 (into phase 1 step 1): a severity override can switch a rule off while prose in `SKILL.md` or
  `structure.md` still mentions it. `SKILL.md` says `references/rules.md` is the app's list and wins;
  prose mentions stay few and name core rules.
- F3 (into phase 2 step 1): `--check` compares the exact text, and the marker line must be identical
  between runs: no date or version in it, so a reinstall with the same config is a no-op.
- F4 (into phase 2 step 1): `--dir` resolves against `cwd`; the command reports the folder it wrote
  relative to `cwd`, and creates parent folders.
- F5 (into phase 1 step 2): limits with term and article variants (words, lead words, internal
  links) are filled per kind, so a term's numbers in the template are the term's.
