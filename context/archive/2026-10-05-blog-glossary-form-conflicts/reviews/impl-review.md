# Implementation review: blog-glossary-form-conflicts

Reviewed: commit `6f55c16` against plan.md and the plan review's findings. Gates on the branch:
`npm run typecheck`, `npm run lint`, `npm run build` green; `npm test` 3275 passed, 35 skipped.
Verdict: **approved**, no blocking findings, no gaps.

## Checks

| Check | Result |
| --- | --- |
| Outcome | `runBlogPublish` refuses a run that leaves a form with two published terms, one of them in the run, with `form "X" is claimed by terms a, b; …` (subject `glossary`), nothing written (dry run and commit tested); `check` reports `term-form-conflict` on each checked term naming the other slug; `createTermMatcher` unchanged ("first term wins" stays). |
| Matcher agreement | `findTermFormConflicts` keys on `capitalize(trim(form))`; a test pins that the conflicting pair it reports is the pair the matcher resolves to the first term, and that "IKE"/"Ike" is no conflict. |
| Plan review | F1: `readGlossaryTerms` uses the check's own parse options and skips unparsable files. F2: slugs sorted, the form spelled as the first sorted slug writes it, conflicts sorted by form. F3: both messages say what to do. F4: a run that drops the stored form passes (the read is after the writes). |
| All or nothing | The refusal throws `PublishRefused` (now a list of problems) inside the transaction, so the rollback covers it; the slug refusal keeps its old shape (existing tests pass unchanged). |
| Withdrawal | A withdrawn or draft term claims no form; `--withdraw` of a term with a taken form passes (tested). |
| Severity | `check` applies the `severity` map to `term-form-conflict` (`off` tested); `publish` ignores it, as for duplicate ids; README and the catalog description say so. |
| Skill | `rules.md` has the row; `tests/skill.test.ts` green. |
| Scope | No tables, migrations, content hash or `src/content/`; `publish-run.ts` change is one function and the refusal class (lane B: BF-2 in flight, merged against master). No version bump (BL-8). |
| Language | English only; no dictionary copy. |

## Findings

- R1 (accepted, not a gap): a conflict only between stored terms is a warning on every run until a
  publish of those terms fixes it; the renderer meanwhile links the form to the newest term
  (`listArticles` order). That is the documented fallback for rows stored before this check.
