---
change_id: marketing-kit-audit-reachability-1191
status: done
---

# Plan: the pinned undici and fflate findings stay unreachable (issue #1191)

Input: change.md, research.md. Complexity: small.

## Phase 1: tests (written first, failing without the change)

- `composeFilm` refuses an asset given as an `https://` URL (a clip, the logo, a font face) and names it;
- `composeFootage` refuses a remote clip or logo the same way;
- a protocol-relative `//host/x.mp4` is refused too; the existing compositions still build.

## Phase 2: code

- `compose/html.ts`: `assertLocalReferences(html)` finds a remote reference in the forms hyperframes downloads
  (`src=`, `href=`, CSS `url(…)`, `@import`) and throws with the reference; both composers return through it.

## Phase 3: docs

- README: replace the audit paragraph with what each finding is, why the kit never reaches it (undici: only
  hyperframes' download helper, which a local composition never calls, enforced by the guard; fflate: only
  `inflateSync`), the GHSA ids, the upstream pull requests, and how an app records the accepted risk or lifts
  the pins with its own overrides. CHANGELOG `## Unreleased`.

## Acceptance

- The new tests pass; every existing compose and render test unchanged.
- Gates: typecheck, lint, tests.

## Progress

- [x] Phase 1
- [x] Phase 2
- [x] Phase 3
