---
change_id: testing-next-action-guards
title: "testing/guards: Next.js server-action architecture guards (issue #402)"
status: planned
roadmap_item: null
issue: 402
branch: claude/project-thread-dqzwyl
created: 2026-10-12
updated: 2026-10-12
---

## Intent

Close [issue #402](https://github.com/SOFTURE/AI/issues/402) (labels `enhancement`, `adoption`, `pkg: testing`): an
adopting Next.js app keeps about 350 lines of server-action architecture guards in its own test suite. When this
change is done, a new entry `@softure-ai/testing/guards/next` exports one function per rule, each returning the
offending `file:line: message` list, plus one call that runs them all:

1. A `"use server"` module exports only async functions.
2. `revalidatePath` / `revalidateTag` run only in a success branch.
3. Implementation modules never use request-scoped APIs (`cookies()`, `headers()`, `connection()`, `draftMode()`).
4. Implementation modules take an injectable database handle.
5. No plain value is imported from a `"use client"` module into server code.
6. Error details never travel in a redirect URL.

Rules 3 and 4 take the layer naming as an option. The issue comment's three gaps ride along in
`@softure-ai/testing/guards`: a parser-based `stripComments`, a README note on `readSourceFiles`' default filter,
and `collectStringLiterals` for string literals in plain `.ts`.

A reviewer checks `foundation/testing/tests/guards-next.test.ts`, the README and the CHANGELOG `Unreleased` entry.

## Context

> An adopting Next.js app keeps about 350 lines of architecture guards for server actions in its own test suite.
> They walk the source tree and fail on rules every Softure Next app follows, so they belong next to
> `readSourceFiles` / `readImports` in `@softure-ai/testing/guards` (for example a `guards/next` subpath).
>
> Expected: `expectServerActionModules({ root, actionGlob, implementationGlob })` or one function per rule, each
> returning offending `file:line` with a readable message, built on the existing guard helpers. Rule 3 and 4 take
> the layer naming as options, since apps name their layers differently.

(issue #402, 2026-10-12; the six rules are listed in the issue.)

The issue's comment (2026-10-12) adds: no comment stripper (four variants in the app), `readSourceFiles`' default
filter narrows silently, `collectVisibleTexts` sees only JSX.

`@softure-ai/testing` is 0.1.4 on master with #412's `Unreleased` entry. Releases are batched by the coordinator, so
this change bumps no version.

## Constraints

- Owns `foundation/testing/` (src/guards, tests, README, CHANGELOG, package.json exports).
- Existing exports keep their API and behaviour; `typescript` stays an optional peer.
- The guards are static and conservative: they report what they can prove from one file's syntax and the given
  file list, and say in the README what they cannot see.

## Notes

- Placement: unlinked (`roadmap_item: null`); autonomous mode works from issues, no active roadmap.
- Framing: skipped. The issue names the rules, the shape of the result and the options it wants.
