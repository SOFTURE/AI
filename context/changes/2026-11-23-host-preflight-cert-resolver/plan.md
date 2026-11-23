# Plan: host-preflight-cert-resolver

## Approach

`findRouterResolvers(compose, env)` returns each router's resolver label, written and resolved; `checkOnboarding`
adds one problem listing every router whose resolved value differs from `edge.certResolver` (an unset variable counts
as different), or a note when all match. A file without such labels adds nothing.

## Decisions (auto)

- A problem (stop), not a warning: a wrong resolver means no certificate on the first release, the failure the comment
  describes.
- Variables resolved with `EDGE_NETWORK` only, like the network check; an unset variable is reported as such.

## Phases

1. Tests first (`survey.test.ts`), then `findRouterResolvers` and the check; README and CHANGELOG.

## Acceptance

- `npx vitest run tools/host` green with the two new tests; typecheck and lint green.

## Progress

- [ ] Phase 1
