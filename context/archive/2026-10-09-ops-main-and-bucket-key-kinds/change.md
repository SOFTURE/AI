---
change_id: ops-main-and-bucket-key-kinds
title: "ops + security: runOpsMain for non-ESM apps, rate-limit buckets that declare their key kind (issue #328)"
status: archived
roadmap_item: null
issue: 328
branch: claude/project-thread-i8st82
created: 2026-10-09
updated: 2026-10-09
archived_at: 2026-10-09
---

## Intent

Close [issue #328](https://github.com/SOFTURE/AI/issues/328), two adoption gaps:

1. **ops entry boilerplate.** In an app without `"type": "module"`, `tsx` loads `softure.config.ts` as CommonJS, so
   the default import arrives wrapped (`{ default: config }`), and top-level `await` is not available. Every ops
   entry repeats an unwrap cast and a `runOpsScript(...).then(...)` block. `runOpsMain(script, configModule)` in
   `@softure-ai/ops/scripts` unwraps the config module, runs the script with `process.argv.slice(2)` and sets
   `process.exitCode`, in one call that works in both module systems.
2. **Buckets that say what they are keyed by.** A bucket definition takes an optional `key: "ip" | "account" |
   "subject"`; `listRateLimitBuckets(config)` lists the configured buckets with it, so an app derives the list of
   IP-keyed processing for its privacy policy instead of maintaining it by hand. Every bucket constant a package
   exports (`AUTH_RATE_LIMIT_BUCKETS` and the five others) declares its kind. `overrideBuckets(defaults, overrides)`
   changes one threshold of a package's defaults and keeps the rest of the bucket (its kind included), so an app no
   longer re-declares `login`, `register` or `login-account`.

A reviewer checks `modules/ops/tests/ops-main.test.ts`, `modules/security/tests/bucket-keys.test.ts`, the bucket
kinds asserted in each package's module test, the READMEs and the CHANGELOGs.

## Context

Issue #328, filed by an adopting app (8 ops entries, ~60 lines of boilerplate; a hand-kept IP-keyed list). Work is
tracked in GitHub Issues: no roadmap item; the PR closes the issue. Every touched package's current version is on
npm, so each ships a patch bump.

## Constraints

- No breaking change: `key` is optional, an existing config parses unchanged, `runOpsScript` is unchanged.
- English-only code and docs; no copy changes.
- The bucket constants keep their names and values; only `key` is added.

## Process notes

- Research: skipped as a separate file. The issue names the functions and the files; reading
  `ops/src/scripts/ops-script.ts`, `core/src/cli/load-config.ts`, `security/src/options.ts`,
  `security/src/server/options.ts` and every `consumeRateLimit` call answered every unknown; findings are in
  plan.md's "Today" section.
- Framing: skipped. Both gaps are observed with their workaround and a proposed API in the issue.
