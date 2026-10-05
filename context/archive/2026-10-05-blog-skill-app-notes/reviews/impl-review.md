# Implementation review: blog-skill-app-notes

Reviewed: commit 7246434 against plan.md. Verdict: **approved**; no new gaps.

## Checks

| Check | Result |
| --- | --- |
| Outcome | `blog({ skill: { sections: [{ title, body }] } })` puts the app's own sections into the generated skill: `references/app.md` (`## <title>` and the body verbatim) and a section of `SKILL.md` that names them; a reinstall keeps them because they come from the config. |
| Roadmap test | FIRE_TRACKER's three passages (engine numbers, calculator scenario with a `###` subheading, chart block with a `{{…}}` in its text) render verbatim in `tests/skill.test.ts`; `--check` is green after an install, red naming `references/app.md` after a body change, and red naming it as not part of the skill once the sections are gone (`tests/skill-cli.test.ts`). |
| Without sections | The five template files, byte for byte as before (`renderBlogSkill` with no sections equals the one with `sections: []`, and the existing skill tests pass unchanged). |
| Validation | One-line unique titles up to 80 characters; a body with a `#` or `##` heading (CRLF and up to three spaces of indent included) is refused outside fenced code (`tests/module.test.ts`). |
| Removal | Install removes only `.md` files of its own marked folder that the config no longer gives, logs `removed <path>`, and keeps other files (`notes.txt` case); a folder without the marker is still refused before anything is written or removed. |
| Gates | `npm run typecheck`, `lint`, `test` and `build` green. |
| Docs | Blog README: the option in the configuration block and in "The writing skill", the folder ownership sentence, FIRE's adoption note; the BF-9 limitation removed. |
| Language | English code and docs; the language gate is green. |

## Findings

- R1 (accepted): a setext heading (`Text` over `===`) in a body is not refused; it renders as an `h1`/`h2` inside
  the section but breaks nothing the install or `--check` depend on, and the README asks for `###`.
- R2 (accepted): the app's text is not filled like the templates, so it cannot name `{{command}}`; an app writes its
  own command, which it knows. Filling it would make an app's literal `{{…}}` (the chart block's attribute) fail.
