---
change_id: ops-main-and-bucket-key-kinds
status: archived
---

# Plan: runOpsMain and bucket key kinds (issue #328)

Input: change.md (research and framing skipped, reasons there). Complexity: medium (two phases plus docs, eight
packages bumped).

## Today (master `e13ae0c`)

- `runOpsScript({ script, argv, config })` returns an exit code; the README entry uses
  `import config from "../softure.config"` and top-level `await`. Under `tsx` in a CommonJS app the default import of
  an ESM-syntax config is the module namespace (`{ default: config }`), sometimes nested once more, and top-level
  `await` is a syntax error. `loadConfig` in core already accepts `default` or `config` exports.
- `securityOptionsSchema.buckets` is a record of `z.strictObject({ limit, windowMinutes })`: an unknown field such as
  `key` is rejected today.
- Six packages export bucket defaults `as const`: auth (7), mcp-access (2), blog (1), waitlist (2), billing (1),
  privacy (2). Their `consumeRateLimit` calls key them by: client address (`register`, `login`, `password-reset`,
  `password-reset-confirm`, `mcp`, `mcp-oauth` (address, plus client id for token requests), the blog refresh
  bucket, `waitlist`), account (`login-account` and `password-reset-account` by the account email,
  `change-password`, `privacy-export`, `privacy-delete` by user id, `billing-payment` by account id), and another
  subject (`waitlist-email`, an address that is not an account).
- Overriding one threshold today means `login: { ...AUTH_RATE_LIMIT_BUCKETS.login, limit: 200 }`; apps write
  `login: { limit: 200, windowMinutes: 15 }` instead, which would drop a `key` once buckets carry one.

## Decisions (auto)

1. **`runOpsMain(script, configModule, options?)`** returns `Promise<number>` and sets `process.exitCode`; it never
   calls `process.exit`, so output is flushed and the pool closes first. `configModule` is `unknown`: the config
   itself, `{ default }`, `{ default: { default } }` or `{ config }` are accepted (the first object with a
   `database` key and a `modules` array). A module without one is a setup failure: one line, exit 1, nothing run.
   `options` takes `argv` (default `process.argv.slice(2)`), `output`, `database` and `readInput` for tests, the
   same as `RunOpsScriptOptions`. An unexpected throw is printed as one line and exits 1, never an unhandled
   rejection.
2. **`key` is optional**, values `"ip" | "account" | "subject"` (`RATE_LIMIT_KEY_KINDS`, `RateLimitKeyKind`).
   Required would break every existing config for a field the limiter does not use. `"ip"`: the client address
   (`identifyClient`), also when combined with another value; `"account"`: one account (its user id or its login
   email); `"subject"`: any other value passed through `subjectKey`.
3. **`listRateLimitBuckets(config)`** in `@softure-ai/security/server`: `{ name, limit, windowMinutes, key }[]` in
   configuration order, `key` `undefined` when not declared. No grouping helper: a `filter` is one line.
4. **`overrideBuckets(defaults, overrides)`** in `@softure-ai/security`: a new object, each named bucket merged field
   by field; a name the defaults lack is a type error and throws at run time (a typo would otherwise add a bucket
   nothing counts in). Pure, so it is usable in `softure.config.ts`.
5. Every package bucket constant declares `key` and `satisfies` the security bucket input type.

## Phase 1: runOpsMain (TDD)

Files: `modules/ops/src/scripts/ops-script.ts`, `modules/ops/src/scripts/index.ts`,
`modules/ops/tests/ops-main.test.ts`.

1. Tests first (red: the export does not exist): a wrapped `{ default: config }` and a doubly wrapped module run the
   script and set `process.exitCode` to 0; the plain config and `{ config }` work; `--commit` from `argv` writes; a
   module with no config prints one line and exits 1 without opening a database; a usage error exits 2.
2. Implement decision 1.

## Phase 2: bucket key kinds (TDD)

Files: `modules/security/src/options.ts`, `src/index.ts`, `src/server/options.ts`, `src/server/index.ts`, new
`modules/security/tests/bucket-keys.test.ts`; the six bucket constants and a kind assertion in each package's
module test.

1. Tests first: a bucket with `key: "ip"` parses (red: strict object refuses it); an unknown kind is refused naming
   the bucket; `listRateLimitBuckets` returns names, limits and kinds in order; `overrideBuckets` changes one field,
   keeps `windowMinutes` and `key`, leaves the defaults untouched, throws on an unknown name; each package constant
   carries the kinds listed under "Today".
2. Implement decisions 2 to 5.

## Phase 3: docs and versions

READMEs (ops § scripts entry for CommonJS apps; security options table, key kinds, listing, overrides; auth rate
limit paragraph), CHANGELOG sections, patch bumps in `package.json`, `module.json`, `src/index.ts` and
`package-lock.json`: ops 0.1.9, security 0.1.8, auth 0.1.11, mcp-access 0.1.12, blog 0.1.11, waitlist 0.1.9,
billing 0.1.11, privacy 0.1.11.

Done when: new tests fail on master and pass after; `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`
are green.

## Progress

- [x] Phase 1: runOpsMain (new tests red on master: the export did not exist; green after)
- [x] Phase 2: bucket key kinds (new tests red on master: the strict bucket schema refused `key`; green after)
- [x] Phase 3: docs, CHANGELOGs, patch bumps; the six packages raise their `@softure-ai/security` range to `^0.1.8`
  (impl-review #1)

Gates on the branch: `npm run typecheck`, `npm run lint`, `npm run build` green; the eight touched packages' tests
pass; the full `npm test` runs in pre-push.
