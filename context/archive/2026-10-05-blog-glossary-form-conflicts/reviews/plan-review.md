# Plan review: blog-glossary-form-conflicts

Reviewed: plan.md and research.md against `modules/blog/src/render/glossary.ts`, `src/next/pages.tsx`,
`src/db/publish-run.ts`, `src/db/articles.ts`, `src/cli/run.ts`, `src/quality/` (`check-files.ts`,
`link-targets.ts`, `catalog.ts`), `src/server/index.ts`, `skill/references/rules.md` and the tests named in
phase 3. Verdict: **approved** with four findings folded into the steps (none blocking).

## Checks

| Check | Result |
| --- | --- |
| Outcome covered | A form claimed by two terms is refused by the publish run naming both slugs (phase 2 step 1) and reported by the gate over the content folder (`check`, phase 2 step 2); the matcher keeps "first term wins" (phase 1 changes only its comment). Each has a test in phase 3. |
| Correct key | `capitalize(trim)` reproduces the matcher's collision exactly (research U2); tested both ways ("ike"/"Ike" collide, "IKE"/"Ike" do not). |
| All or nothing | The conflict read runs inside the run's transaction after its writes, and a refusal throws inside it, so a refused run writes nothing; a dry run sees the same state as a commit. |
| Withdrawal always passes | A withdrawn term is not published, so it is in no conflict; conflicts outside the run are warnings (U4). |
| Lane | `publish-run.ts` is lane B (BF-2 in flight): the change is a new function and the refusal class; conflicts resolved against master. |
| Gate and skill | New catalog rule → `rules.md` row (phase 2 step 3), enforced by `tests/skill.test.ts`. |
| Scope | No tables, migrations, content hash or `src/content/`; no version bump (BL-8). |
| Language | English only; messages are developer- and agent-facing, no dictionary copy. |

## Findings

- F1 (into phase 2 step 2): `readGlossaryTerms` parses with the same `reservedSlugs` and `fields` as the
  check itself, so a file that fails to parse is skipped here and reported once by `file`, not twice.
- F2 (into phase 2 step 1): `listArticles` orders by date; the conflict's slugs are sorted so a message
  never depends on publish dates. The form shown is the first term's (by sorted slug) spelling.
- F3 (into phase 2 step 1): the problem message carries what to do ("remove it from one of the terms"),
  like the existing pillar and id messages.
- F4 (into phase 3 step 2): add a case where a run fixes a stored conflict (the stored term's file in the
  run drops the form): the run passes, proving the read happens after the writes.
