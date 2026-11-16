# Plan: example-on-workers (RP-10)

## Approach

Fix the platform gaps in the packages (one interface, a per-host implementation underneath), keep the example's code
identical between hosts except `SOFTURE_HOST`, and run its existing suite on `wrangler dev` locally and in CI.

## Decisions (auto)

- `withDatabaseBuild(config, { host })` in `@softure-ai/db/next-config` owns every host-specific bundler setting; the
  app never lists stubs or aliases. It is a Node-only entry (next.config), so it is not in `softure.workers`.
- The request handle closes after the body and all `waitUntil` work, not on return (`closeAfterBody`,
  `closeWhenSettled`); the Worker template passes the scope's `waitUntil` to OpenNext.
- Ops runs health checks per request on Workers and keeps the shared run on Node.
- `fakeMailProvider({ outboxUrl })` beside `outboxFile`; an unreachable sink answers `unavailable`.
- One test branches on host (CF-Connecting-IP is always set by wrangler); everything else runs unchanged.
- CI: a separate `e2e-workers` job beside `e2e` on `ubuntu-latest` with the same Postgres service; no secrets.

## Phases

### Phase 1: request scope and sockets bridge in db (TDD)
- Streamed body keeps the handle open, cancel closes it, bodiless response closes at once, `waitUntil` work keeps it
  open, failing and late work are awaited. Done when: db tests pass and the streaming tests are red without the fix.

### Phase 2: `@softure-ai/db/next-config` (test-after)
- `withDatabaseBuild` per host, `getCloudflareAliases`, the PGlite and sockets stand-ins. Done when: its tests pass and
  the example builds with it on both hosts.

### Phase 3: ops, mailing, observability, deploy template (TDD where behaviour changes)
- Ops: per-request run on Workers (red without the fix), request handle first. Mailing: `outboxUrl` (4 tests). Deploy:
  template registers sockets and passes `waitUntil` (init test). Done when: those suites pass.

### Phase 4: the example on Workers
- `next.config.ts` through `withDatabaseBuild`, `worker.ts`, `wrangler.jsonc`, `open-next.config.ts`,
  `playwright.workers.config.ts`, the outbox sink, the security branch. Done when: the full suite is green on
  `wrangler dev` and on Node.

### Phase 5: CI, versions, docs
- `e2e-workers` job; db 0.1.16, ops, mailing, observability patch bumps and deploy 0.7.1 bullet with CHANGELOGs; db and
  deploy READMEs and docs/07. Done when: typecheck, lint and the test suite are green.

## Progress

- [x] Phase 1: request scope; 5 tests, the 2 streaming ones red without the fix
- [x] Phase 2: next-config; 5 tests
- [x] Phase 3: ops per-request health (red without the fix), mailing outboxUrl, deploy template test
- [x] Phase 4: Workers e2e 134/134 green on `wrangler dev` (2.8 min); Node e2e (see impl review)
- [x] Phase 5: `e2e-workers` job; db 0.1.16, ops 0.2.6 (now on `@softure-ai/db/request`, which the Workers-entries guard demanded), mailing/observability/deploy bullets; observability Workers test (red without the fix); READMEs, docs/07
