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

## Progress

- [ ] p1 manifests and lockfile
- [ ] p2 code
- [ ] p3 gates, rebase, pull request
- [ ] p4 close the Dependabot pull requests
