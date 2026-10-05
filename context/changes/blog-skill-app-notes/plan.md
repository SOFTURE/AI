# Plan: blog-skill-app-notes

Input: change.md, research.md. Complexity: small.

## Goal
`blog({ skill: { sections: [{ title, body }] } })` puts the app's own Markdown sections into the generated
writing skill: `skill install` writes them to `references/app.md` and `SKILL.md` points the agent to them;
a reinstall with the same config changes nothing, `--check` reports a section that changed, and a skill
that no longer has sections loses the file (install removes it, `--check` reports it).

**Out of scope:** templating inside the app's text (bodies are verbatim); a second skill or a second
folder; any change to the gate's rules or their tables.

## Approach
**Starting point:** `renderBlogSkill` returns the template files; `runSkillInstall` writes and checks that
list (research §Findings).

**Chosen:** research option 1, a config option rendered into one extra reference file.
Rejected: a preserved local file (half-generated folder, `--check` blind to it); a path option (the config
names a file only the CLI reads).

**Key decisions:**
| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Option | `skill: { sections: { title, body }[] }`, default `[]` | room for later skill options; the roadmap's "an option such as" | research §Options |
| Validation | title: one line, 1-80 chars, unique; body: non-empty, no `#` or `##` heading line | the file's own `##` headings carry the titles | research §Risks |
| File | `references/app.md`: a heading, one line on precedence, `## <title>` + body per section | the references pattern of the skill; `SKILL.md` stays short | plan |
| `SKILL.md` | an `{{#appSections}}` section after the procedure naming the titles and the file; the sections add to the skill, never switch off a rule of the gate | the agent reads the file at the right step | plan |
| Bodies | inserted verbatim after the template render | `{{…}}` in the app's text never fails the render | research §Risks |
| Stale files | install removes `.md` files in the folder it does not render; `--check` reports them | the folder belongs to the command (marker) | research §Risks |

## Phase 1: Sections in the config, the skill and the install
**Discipline:** TDD. **Files:** `modules/blog/src/options.ts`, `modules/blog/src/cli/skill.ts`,
`modules/blog/src/cli/run.ts`, `modules/blog/skill/SKILL.md`, `modules/blog/tests/skill.test.ts`,
`modules/blog/tests/skill-cli.test.ts`, `modules/blog/tests/module.test.ts` (the schema and its defaults,
plan review W1), `modules/blog/README.md`, `context/foundation/roadmap.md`.

1. Tests (red first): the schema refuses an empty title, a title with a newline, two equal titles, an empty
   body and a body with a `## ` line, and accepts a `### ` line; `renderBlogSkill` without sections returns the
   five files and a `SKILL.md` without the app's part; with FIRE-like sections (engine numbers, calculator
   scenario, chart block) it adds `references/app.md` with each title as `##` and the body verbatim (a `{{x}}`
   included) and `SKILL.md` names the titles; the CLI: install writes `references/app.md`, `--check` is green
   after it, red naming `references/app.md` after a body change, red naming it as not part of the skill after
   the sections are removed, and a reinstall without sections removes it.
2. `options.ts`: `skillSchema` with `sections`, the refinements, a doc comment.
3. `skill.ts`: `appSections` and `appSectionTitles` values, `renderAppSections`, the extra file; a helper
   that lists the `.md` files of an installed folder.
4. `run.ts`: `--check` reports extra files; install removes them and logs `removed <path>`.
5. `SKILL.md` template: the conditional section.
6. README: the option in the writing-skill section; the limitation line on BF-9 removed.

**Tests:** step 1; the shipped-skill tests stay (five template files, rule ids).

**Done when:**
- Automated: the schema refuses the bad sections and keeps the good ones.
- Automated: the rendered skill carries the sections in `references/app.md` and names them in `SKILL.md`; without sections it is byte for byte as before.
- Automated: install, reinstall and `--check` cover the sections, including a removed file.
- Automated: Gates green (typecheck, lint, test, build).

## Risks and rollback
- An app had put its own `.md` file into the generated folder: install now removes it. The marker says
  "Do not edit", and the README says the folder belongs to the command; the log names every removed file.
- Rollback: revert the phase commit; the option disappears and the skill renders as before.

## Decisions (auto)
- Complexity → small (one phase).
- Plan review W1 (module defaults test) and S1 (log and README on removal) applied.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Sections in the config, the skill and the install

#### Automated
- [x] 1.1 the schema refuses the bad sections and keeps the good ones
- [x] 1.2 the rendered skill carries the sections in `references/app.md` and names them in `SKILL.md`; without sections it is byte for byte as before
- [x] 1.3 install, reinstall and `--check` cover the sections, including a removed file
- [x] 1.4 Gates green (typecheck, lint, test, build)
