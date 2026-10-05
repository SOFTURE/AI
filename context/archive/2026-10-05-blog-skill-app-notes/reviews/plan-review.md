# Plan review: blog-skill-app-notes

Reviewed: plan.md @ 2026-10-05. Mode: standard. Verdict: ready after fixes.
Findings: 0 critical, 1 warning, 1 suggestion.
Grounding: 9/9 paths, 6/6 symbols (`renderBlogSkill`, `getSkillValues`, `renderSkillTemplate`, `runSkillInstall`,
`blogOptionsSchema`, `SKILL_MARKER`), 1/1 commands (gates from `workflow.json`).

## Lenses
| Lens | Result |
| --- | --- |
| Coverage and end state | PASS (option, render, install, `--check`; FIRE's three passages as the test case) |
| Slicing | PASS (one phase: the option is useless without the render and the install) |
| Verifiability | PASS (each Done-when item has a named test) |
| Data and migrations | PASS (none) |
| Tests | PASS after W1 |
| Security | PASS (the text comes from the app's own config; the install writes only inside the marked folder, and removes only `.md` files there) |
| Lean | PASS (one option, one extra file, one flag in the template) |
| Fit | PASS (the references pattern of the skill; zod `strictObject` like the other options) |
| Cost and defaults | PASS (without sections the output is byte for byte as before) |
| Scope | PASS (no template engine for the app's text; no new command) |
| Reuse | PASS (`renderSkillTemplate` flags, `readText` in the CLI) |
| Lessons | PASS (no lazy regular expressions over Markdown: the heading check is a per-line prefix test) |
| Progress format | PASS |

## Findings

### W1 [WARNING] The module's default options change shape
**Effort:** low. **Lens:** Tests. **Where:** Phase 1, Files (plan.md)
**Problem:** `modules/blog/tests/module.test.ts` asserts the exact parsed defaults; a `skill` default adds a key,
so the test fails for a reason the plan does not list, and a reader could take it for a regression.
**Fix:** list `tests/module.test.ts` in the files and update the expected defaults with `skill: { sections: [] }`.
**Decision:** Fix now (applied in the implementation; the file list in plan.md is extended).

### S1 [SUGGESTION] Removing files the app put into the folder deserves a log line and a README sentence
**Effort:** low. **Lens:** Security. **Where:** Phase 1, step 4 (plan.md)
**Problem:** removal is the one new destructive step. It is bounded (the marked folder, `.md` only), but silent
removal would surprise.
**Fix:** log `removed <path>` for each file and say in the README that the folder belongs to the command.
**Decision:** Fix now (already in steps 4 and 6).
