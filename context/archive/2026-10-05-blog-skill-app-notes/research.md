# Research: blog-skill-app-notes

Depth: quick. Question: how does the app put its own sections into the generated writing skill, so that
a reinstall keeps them and `--check` covers them?

## Findings

- `renderBlogSkill(config, { command })` (`modules/blog/src/cli/skill.ts`) returns the list of files;
  `runSkillInstall` (`src/cli/run.ts`) writes exactly that list and `--check` compares exactly that list.
  Anything the list carries is installed and checked for free.
- The folder is owned by the command: install refuses a folder whose `SKILL.md` lacks the marker, and the
  marker line says "Do not edit". A file left in the folder that the list does not carry is neither
  checked nor removed today.
- `references/rules.md` already has a slot for the app's rules (`{{appRules}}`, filled by the gate's
  catalog); `references/structure.md` names the app's `fields` keys, but not what they mean.
- FIRE_TRACKER's `blog-pisz` keeps three passages that are the app's own: where engine numbers come from,
  the calculator scenario (`scenariusz` field) and the chart block (`::chart` plugin). Each is a heading
  and a few paragraphs of Markdown.

## Options

1. **A config option** `blog({ skill: { sections: [{ title, body }] } })`, rendered into a reference file
   of the skill and linked from `SKILL.md`. The text lives in the app's repository (the config, or a
   string the app builds), is validated with the rest of the options, and `--check` sees it because it is
   part of the rendered list. Cost: Markdown inside a config file; an app can keep it in its own module
   and import it.
2. **A preserved local file** in the skill folder (e.g. `app.md`), which install skips and `SKILL.md`
   links to when present. Breaks the "the folder is generated" rule (part hand-written, part generated),
   `--check` cannot say whether the file is right, and the rendered `SKILL.md` would depend on the disk,
   not on the config.
3. **A path option** (`skill: { sectionsFile }`) read by the CLI. Same result as option 1, but the
   config then names a file the Next runtime never reads, and a missing file is a CLI-only error.

**Chosen: option 1.** One source of truth (the config), deterministic output, `--check` for free.
The rendered file is `references/app.md`, written only when the app has sections.

## Risks

- Removing all sections leaves a stale `references/app.md`: install must remove generated files it no
  longer renders, and `--check` must report them. Scope it to `.md` files (the only kind the skill holds).
- A body with a `#`/`##` heading would break the file's structure: refuse it in the schema (`###` and
  deeper are fine).
- Bodies are inserted verbatim, never run through the template engine, so `{{…}}` in an app's text is
  left alone and cannot fail the render.
