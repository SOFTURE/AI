# Plan: security-workers-fetch (RP-5)

## Approach

Keep the Node implementation. Allow the builtins workerd provides in RP-1's guard, check the host's addresses just
before the request when the runtime cannot take a `lookup` (Workers), and declare the security entries Workers-safe.
security 0.2.8.

## Decisions (auto)

- No `fetch` rewrite and no CIDR matcher: workerd runs `node:http`, `node:net` and `node:zlib` as the code uses them
  (research.md). The roadmap outcome is updated to what was measured.
- The pinning choice is a seam field `pinLookup` with a runtime default (`navigator.userAgent === "Cloudflare-Workers"`),
  so Node tests can run the Workers path against a transport that refuses `lookup` like workerd does.
- `openGuardedRequest` becomes async; a refused address rejects with `BlockedAddressError`, which callers already map
  to `security.outbound_blocked`. An `AbortSignal` from the callers' timers stops a host check that hangs.

## Phases

### Phase 1: the guard allows what workerd provides (test-after)
- `tests/repo/workers-entries.ts`: add `dns`, `dns/promises`, `http`, `https`, `net` with the caveats as comments;
  walker test rows for `net`, `http` (allowed) and `os` (refused); docs/07 bullet and a "measured" section.
- Done when: the repo tests pass.

### Phase 2: unpinned host check (TDD)
- `guarded-request.ts`: `isWorkersRuntime`, `pinLookup`, async `openGuardedRequest`, `checkHostAddresses` (skips IP
  literals, refuses an empty answer); `sendGuardedRequest` maps a rejection to timeout, blocked or failed and aborts the
  check on its timer. `guarded-get.ts` awaits the open and rethrows a block or an abort; page and download pass a signal.
- Done when: tests on a transport that refuses `lookup` show a request sent after an allowed answer, refusals for a
  private address, an empty answer and a private literal (no resolve), failure on a resolver error, a timeout while the
  check hangs, and a redirect to a private host refused in `fetchGuardedPage`; forcing the pinned path or dropping the
  rethrow turns them red.

### Phase 3: declare and document
- `softure.workers`: `.`, `./server`, `./signed-request`, `./readable-text`; manifest and module.json
  `runtimes: ["node", "workers"]`; README (Workers paragraph, limitation), CHANGELOG 0.2.8, docs/07 row.
- Done when: the guard passes on those entries and an `import "node:fs"` in `server/identify.ts` turns it red.

## Progress

- [x] Phase 1: guard allows `dns`, `http`, `https`, `net`; walker rows; docs/07 measured section
- [x] Phase 2: unpinned check; 6 request tests and 2 page tests; forcing the pinned path turns 4 red, dropping the abort turns the hang test red, dropping the rethrow turns the page test red
- [x] Phase 3: entries and runtimes declared; `node:fs` in `server/identify.ts` turns the guard red; README, CHANGELOG 0.2.8, docs/07 row
