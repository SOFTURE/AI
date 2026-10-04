# Implementation review: seo-crawler-access

Scope: full · Date: 2026-10-04 · Commits: 2f4184a..edde1ec · Gates: typecheck ✓ lint ✓ test ✓ (50 seo tests, `tests/repo` 201) · build ✓ · e2e ✓ (106 passed, 4 in `e2e/seo.spec.ts`)

## Verdict

Ready after fixes. Both phases deliver what the plan asked: the module with its builders, adapter and
IndexNow submit, and the example app serving the three files under an e2e. One real defect was found
and fixed (a blank `htmlLimitedBots` token matched every user agent); the rest are recorded drift with
reasons.

## Dimensions

| Dimension | Verdict | Findings |
| --- | --- | --- |
| Plan coverage | PASS | F2 (recorded drift) |
| Correctness | PASS after fix | F1 |
| Tests | PASS | mutation checks below |
| Security | PASS | — |
| Patterns | PASS | F3 |
| Progress honesty | PASS | — |

## Plan coverage

| Phase | Commit | Delivered | Notes |
| --- | --- | --- | --- |
| 1. The package | 2f4184a | yes | builders, options, adapter, `/server` submit, README, root README line |
| 2. Example app and e2e | af58b19 | yes | config, three mounted files, `htmlLimitedBots`, `e2e/seo.spec.ts`, README |

Files: planned and changed 31 · unplanned 0 · planned, not changed 0.

## Findings

### F1 [WARNING] A blank extra token made `htmlLimitedBots` match every user agent
**Impact:** LOW · **Dimension:** Correctness · **Where:** `modules/seo/src/crawlers.ts:69`
**What:** `buildHtmlLimitedBots([""])` joined an empty alternative into the pattern, which matches any
string. **Why it matters:** every browser would get blocking metadata (slower first byte) without any
test noticing. The options schema guards `crawlers.*.extra`, but `buildHtmlLimitedBots` is called
directly from `next.config.ts`. **Evidence:** reasoning on `RegExp("a||b")`; new test.
**Fix:** trim tokens and drop blank ones; test "ignores blank tokens, which would catch every browser".
**Decision:** fix now (edde1ec)

### F2 [SUGGESTION] No `next` peer dependency, unlike the plan's step 1
**Impact:** LOW · **Dimension:** Plan coverage · **Where:** `modules/seo/package.json`, `src/next/routes.ts`
**What:** the plan listed `next ^16.0.0` as a peer. Importing `MetadataRoute` from `next` pulled Next's
global types into the root type check, which made `process.env.NODE_ENV` read-only and broke
`vitest.config.mts:12`. The adapter returns structural copies of `MetadataRoute.Robots` and
`MetadataRoute.Sitemap` instead, and the e2e shows Next accepts them.
**Decision:** accept (auto): better than the plan; README §2 says so.

### F3 [SUGGESTION] Empty message dictionaries
**Impact:** LOW · **Dimension:** Patterns · **Where:** `modules/seo/src/messages/{en,pl}.ts`
**What:** the module has no visible copy; the dictionaries are empty to keep the standard's shape
(`defineModule` requires `messages`). `tests/repo/packages.test.ts` passes (same keys: none).
**Decision:** accept (auto).

## Mutation checks

- Writing `/` instead of `/$` when the root is disallowed: 2 tests red (`robots.test.ts`, `next.test.ts`).
- Dropping `disallow` from the named group: 4 tests red.
Both files restored from a copy; the suite is green again.

## Security

Every route is an input-free GET serving configuration; the key is public by protocol. The submit
refuses URLs off the site host before any request, never throws, and is a dry run unless
`commit: true`. No secrets, no SQL, no session needed (public files by design).

## Progress audit

1.1-1.3 (2f4184a): `npx vitest run modules/seo tests/repo` re-run green; gates re-run before commit
(lefthook pre-commit). 2.1-2.2 (af58b19): `npm run e2e` 106 passed, `npx eslint examples` clean.
2.3 is this file.

## Triage summary

Fixed: F1. Accepted: F2, F3. Deferred: -. Withdrawn: -.

## Lessons proposed

None: `context/foundation/lessons.md` does not exist; F2 is recorded here and in the README.

## Decisions (auto)

- F1 fixed (clear local fix); F2 and F3 accepted as recorded drift.
