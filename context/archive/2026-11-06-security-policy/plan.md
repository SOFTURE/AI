# Plan: security-policy

## Phases

1. `SECURITY.md` at the root: supported versions (latest minor of each published `@softure-ai/*` package; older
   minors, unpublished workspaces and `master` before a release are out of scope), how to report (GitHub private
   vulnerability reporting, what to include, never a public issue), response times, disclosure and credit, how fixes
   ship (patch release, npm provenance), automated checks (Dependabot, the hourly alert sync), and scope.
2. README: a `## Security` section linking the policy. Gates: lint (language), the repository link test.

## Acceptance

- `SECURITY.md` renders in GitHub's Security tab; every relative link resolves (evidence: `tests/repo/links.test.ts`).
- Language gate and ESLint green.

## Decisions (auto)

- Policy per version line, not a table of 34 versions that every release would have to edit.
- Response times sized for a small team: acknowledgement in 3 business days, assessment in 7 days, fix for critical
  and high within 14 days, others with the next release; 90 days as the outer disclosure limit.
- Enabling private vulnerability reporting is a repository setting the session cannot reach; the owner turns it on.

## Progress

- [x] p1 SECURITY.md at the root: versions, private reporting, response times, disclosure, shipping, automated checks, scope
- [x] p2 README `## Security` section; `npx vitest run tests/repo/links.test.ts tests/repo/readme-layout.test.ts tests/repo/language.test.ts` 3 files, 14 tests passed; `npm run lint:language` green
