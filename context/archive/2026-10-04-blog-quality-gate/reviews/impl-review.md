# Implementation review: blog-quality-gate

Reviewed: commit `66932dc` and the follow-up test commit on `claude/bl-6-dj6zv0` against plan.md,
plan-review.md and FIRE_TRACKER `src/lib/blog/quality/**` (commit `15ec77e`). Verdict: **approved**.
Two gaps go to the blog-followups roadmap (R1, R2); nothing blocks the merge.

## Plan conformance

| Plan item | Delivered |
| --- | --- |
| 1.1 engine | `src/quality/`: `finding.ts`, `blocks.ts`, `text.ts`, `rulesets/{en,pl}/`, `rules/{structure,links,ymyl,style}.ts`, `settings.ts`, `catalog.ts`, `plugin.ts`, `check-article.ts` |
| 1.2 rule ids | the plan's FIRE map, plus `summary-missing`, `heading-order`, `section-answer-length` and `dashes-paragraph` (FIRE's two-severity rules split into one id per severity, so an override means one thing) |
| 1.4 language gate | `scripts/check-language.mjs` exempts folders named `pl`; `tests/repo/language.test.ts` shows both sides (plan-review F3); AGENTS.md says so |
| 2.1 options | `blog({ quality })`, `false` turns it off; a typed transform instead of a union so issues name the option |
| 2.2 links, gate | `link-targets.ts` (routes, content kinds, published only), `external-links.ts`, `gate.ts`, `check-files.ts` |
| 2.3 CLI | `softure-blog check [path…] [--external] [--today]`, no database (plan-review F4: a test fails if it opens one); `publish` builds the gate from the config unless `gate` is passed |
| 2.4 workflow | `.github/workflows/blog-links.yml` (`workflow_call`, `contents: read`, command through the environment) |
| 2.5 README | the gate section, rules table, plugin example, `check` output, FIRE adoption notes |
| Baseline | `tests/quality/pl/fire-baseline.test.ts`: FIRE's fixtures (English frontmatter) give FIRE's error set through the `pl` ruleset, FIRE's options and two stand-in plugins; the model text has no finding at all |

## Checks

| Check | Result |
| --- | --- |
| `npm run typecheck` | green |
| `npm run lint` (ESLint zero warnings + language gate) | green |
| `npm test` | green (the full run before the fixture rename failed only on the repository link check; see R1) |
| `npm run build` | green |
| Manual 2.3 | the built bin over a throwaway app: red folder exits 1 with `file:line` findings, a dead glossary link named, usage errors exit 2 |
| FIRE literals in `src/` | none: domain, engine mark, routes, voice and finance phrases are options or test data |
| Plan-review findings | F1 (gate reuses the run's parsed article), F2 (`plugin-failed`), F3, F4, F5 (every pattern of both rulesets has a sample test) all in |

## Findings

- R1 (gap, BF-3): `tests/repo/markdown-links.ts` reads a footnote definition (`[^id]: text`) as a
  reference link and reports its first word as a broken link; it also reads an article's site paths
  as file links. The article fixtures are `.txt` files here; the footnote half is a real gap of the
  repository check. Not fixed (owner's rule on gaps).
- R2 (gap, BF-4): an app config with `blog()` must carry a database URL even for `check`, which never
  connects. The reusable workflow passes a placeholder `DATABASE_URL`; a command-level opt-out belongs
  in core or the bin loader (next to BF-1).
- R3 (fixed before commit): the `length` message said "a article"; it names the kind with its article.
- R4 (fixed before commit): `status: "published"` (quoted YAML) was not seen as published by the link
  resolver; the regex takes quotes now and the links test uses a quoted status.
- R5 (accepted): the publish gate passes every internal link (FIRE's choice: the publishing container
  may have no app folder). `check` in CI resolves them; the README says so.
- R6 (accepted): FIRE's three chart cases that run its real chart engine stay in FIRE; the stand-in
  plugin covers the same rule shape with fixed tables.
