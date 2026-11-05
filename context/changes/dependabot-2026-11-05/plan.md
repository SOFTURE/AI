# Plan: dependabot-2026-11-05

## Phases

1. Manifests: apply the `package.json` changes of #1097, #1098 and #1099; hold the OpenTelemetry family on
   3.0.x / 0.300.x (`sdk-trace` replaces `sdk-trace-node`/`sdk-trace-base`, `api-logs` dropped,
   `context-async-hooks` added); rebuild the OpenTelemetry part of `package-lock.json` so each package resolves once.
2. Code: `@opentelemetry/api-logs` imports move to `@opentelemetry/api`; `NodeTracerProvider.register()` becomes an
   explicit `registerTracerProvider` (AsyncLocalStorage context manager, W3C trace context + baggage, global
   provider); span processors take `{ exporter }`; the logger keeps its own narrow `AttributeValue`;
   `listPosition` takes the list element. Tests follow the renamed classes.
3. Gates: typecheck, ESLint, language gate, full test suite, build. After the security patch (#1101) merges, rebase
   and rebuild the lockfile on top of it, rerun the gates, open the pull request.
4. After the merge: close #1097, #1098 and #1099 with a pointer to the merged pull request.

## Decisions (auto)

- One change for three pull requests: they overlap in `package-lock.json` and two of them only make sense together
  (OpenTelemetry 3 is one release train).
- `~3.0.0` / `~0.300.0` instead of the newest 3.1 / 0.301: the contrib instrumentations (runtime-node, undici) accept
  only `^0.300.0`, so 0.301 would install two copies of `@opentelemetry/instrumentation`.
- No changeset/version bump here: the changed packages ride the next combined release.
- satori stays pinned at 0.35.1: `tools/marketing-kit` pins it on purpose (#254), and 0.63 fails the OG render
  tests. The rest of #1097 lands as proposed.
- zod 4.6.7 breaks the analytics `channelField` bound message; the security patch (#1104) already fixed it on master,
  as it did the blog's markdown-it 15.0.3 types. This branch is rebased onto c0aa67e and keeps master's versions of
  next, zod, markdown-it, happy-dom and vite.

## Progress

- [x] p1 manifests and lockfile (satori kept at 0.35.1)
- [x] p2 code ; typecheck, ESLint per directory, language gate green
- [x] p3 rebased onto c0aa67e (#1104), pre-push full suite 788 files passed; PR #1106. CI round 1: hyperframes, ai,
  lucide, playwright and pglite had been left nested or duplicated by the incremental lockfile updates (the
  `npx hyperframes` step found no CLI, typecheck saw two PGlite and two playwright-core copies); their entries were
  rebuilt so each hoists once. hyperframes 0.9 pins undici 7.25.0 (high advisories), so the root `overrides` gain
  `undici: ^7.30.2`; `npm audit --omit=dev` reports 0. `HYPERFRAMES_VERSION` follows the pin (0.9.5).
- [ ] p4 close the Dependabot pull requests
