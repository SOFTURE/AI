# Plan: blog-glossary-form-conflicts

Input: change.md, research.md. Complexity: low (one pure function, one publish-run check, one gate rule).

## Goal

A form claimed by two published terms is refused by `softure-blog publish` (naming the form and both slugs)
and reported by `softure-blog check` as `term-form-conflict`; the renderer keeps "first term wins".

**Out of scope:** changing the matcher, conflicts between a term form and an article title, forms that
overlap without being equal ("IKZE" inside "IKZE relief"; the longest form already wins).

## Approach

**Chosen:** `findTermFormConflicts(terms)` in `src/render/glossary.ts`, next to the matcher whose
collision rule it mirrors; the publish run calls it on the published terms read inside its transaction
after the writes; `check` calls it on the terms of the content folder and the checked files. Rejected:
a per-file gate rule (it sees one file) and a check over the run's inputs only (misses stored terms, U3).

**Key decisions:**
| Decision | Choice | Why |
| --- | --- | --- |
| Conflict key | `capitalize(form.trim())`; forms listed twice by one term count once | U2 |
| Result | `TermFormConflict { form, slugs }`: the form as the first term wrote it, slugs sorted, at least two | deterministic messages |
| Publish run | after the writes, inside the transaction: `listArticles(tx, { kind: "term" })` → `toGlossary` → conflicts; one touching a run's term slug → problem `{ subject: "glossary", message: "form \"X\" is claimed by terms a, b; a form belongs to one term" }`, rolled back; others → warnings | U3, U4 |
| Refusal shape | `PublishRefused` carries a list of problems | several conflicts at once |
| Check | `CheckArticleFilesOptions.glossary?: GlossaryTerm[]`; `runCheck` builds it with `readGlossaryTerms(files)` (parse, `kind: term`, `status: published`, later file wins by slug) | U5 |
| Finding | `term-form-conflict`, error, no line, on each checked term file in a conflict: `form "X" is also a form of term b; a form belongs to one term, so remove it from one of them` | U6 |
| Catalog | group `links`; `rules.md` row; README table | skill sync test |

## Steps

### Phase 1: the conflict function
1. `glossary.ts`: `TermFormConflict`, `findTermFormConflicts`; fix the matcher comment (the publish run
   and `check` report it); export from `src/render/index.ts` and `src/server/index.ts`.

### Phase 2: publish run and check
1. `publish-run.ts`: `PublishRefused` with problems; `findGlossaryConflicts(tx, inputs)` after the writes.
2. `quality/link-targets.ts`: `readGlossaryTerms(files, parse)`; `check-files.ts`: `glossary` option and the
   finding (severity through `getEffectiveSeverity`); `run.ts` passes it; catalog rule.
3. `skill/references/rules.md`: a `term-form-conflict` row under Links.

### Phase 3: tests and docs
1. `render-glossary.test.ts`: conflicts for equal forms, capital-first variants, no conflict for "IKE"/"Ike"
   or a form repeated in one term, three terms on one form, empty forms ignored.
2. `publish-run.test.ts`: two run terms sharing a form are refused with both slugs and nothing written; a
   run term against a stored term is refused; a withdrawn stored term frees the form; a stored conflict
   outside the run is a warning, not a refusal.
3. `check-cli.test.ts`: a checked term whose form a folder term holds reports `term-form-conflict` naming it.
4. README: the rule in the links row, the publish refusal in the commands list, §12 if it mentions it.

## Gates

`npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.

## Progress

- [x] change.md, research.md, plan.md
- [x] plan review (approved, F1–F4 folded in)
- [x] phase 1
- [x] phase 2
- [x] phase 3
- [x] gates (typecheck, lint, test, build green)
- [x] impl review (approved, no gaps)
- [x] archive
