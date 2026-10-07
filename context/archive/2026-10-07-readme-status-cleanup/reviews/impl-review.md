# Implementation review: readme-status-cleanup

Reviewed: 777fbdf against plan.md. Verdict: approved, no open findings.

- **Plan drift:** none. Thirteen READMEs edited, `tools/marketing-kit/README.md`, `docs/` and `context/` untouched.
- **Done-when:** the grep for `Status:`, `wave N`, `first release` and `implementation starting` over the edited
  READMEs returns only substantive hits (`tools/deploy`'s release-report `Status` section and its "first release"
  count rule, a code sample in mailing), none of them a status note.
- **Nothing lost:** `Depends on` kept for analytics, billing (with the optional mailing part), ops and seo; core,
  db, ui and mailing carried no dependency in their status lines. Sister repositories, provenance lines and every
  usage section stay. Auth's "engagement roadmap" now names `@softure-ai/privacy`; waitlist's limitation says
  what is missing instead of which roadmap owns it.
- **Gates:** `npx vitest run tests/repo` 358 passed, 9 skipped (relative links in every `*.md`); `npm run
  lint:language` green. Documentation only, so typecheck, ESLint and the package suites are not affected.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Suggestion | `docs/01-module-assessment.md` is still linked from the root Documents table and describes the original plan; it is history, not status, and the change leaves `docs/` alone. | no change |
