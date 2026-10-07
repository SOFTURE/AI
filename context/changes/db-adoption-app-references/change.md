---
change_id: db-adoption-app-references
title: "Adoption of a module whose SQL references app tables"
status: impl_reviewed
roadmap_item: null
issue: 170
branch: claude/project-thread-dexe9x
created: 2026-10-07
updated: 2026-10-07
---

## Intent

Adoption compares a module's live schema with a reference schema built on a scratch PGlite from the module's files
and its dependencies' files. The scratch database has no app tables, so a module whose own SQL references one
(`REFERENCES public.app_users (id)`, the case the `before` hook exists for, #153) cannot build its reference at all:

```
<module>: could not build the reference schema: <module> <file>: relation "public.app_users" does not exist
```

Such a module can be adopted neither with `adoptModule` / `--adopt` nor through `app.baseline` (issue #170).

After this change the reference build copies **stubs** of the app's tables from the live database into the scratch
database before the module files run: every table outside the ledger, the enabled modules' schemas and drizzle's
schema, with its columns (no defaults, no NOT NULL, no foreign keys), its primary key, unique constraints and plain
unique indexes, plus the enum types those columns use. Module SQL that references an app table then runs on the
scratch database exactly as on the live one, and the foreign key lines it creates are compared like any other line.
The app passes nothing new.

A reviewer checks `foundation/db/tests/reference-stubs.test.ts`, the new case in `foundation/db/tests/adopt.test.ts`
and the README / docs sentences.

## Context

Source: GitHub issue [SOFTURE/AI#170](https://github.com/SOFTURE/AI/issues/170), found while implementing adoption
baselines (#152, on master). Builds on #153 (`app.before` / `app.after`) and #152 (`app.baseline`,
`buildReferenceSchema`). Issues are tracked in GitHub Issues, not in a roadmap, so this change has no roadmap item.
The PR closes #170.

## Constraints

- Owns `foundation/db/src/migrations/reference.ts`, a new `foundation/db/src/migrations/stubs.ts`, the reference call
  sites in `adopt.ts` and `migrator.ts`, the db README and the adoption sentences in docs/02 §4 and docs/05 step 3.
- Out of scope: `foundation/db/src/client.ts`, `session.ts` and `foundation/core/src/config.ts` (#154 changes them in
  parallel); ops / deploy docs and the changelog (#158).
- `@softure-ai/db` stays unreleased; no release, tag or publish (#154 and #158 still change db/core).
- English-only code, comments and commits (AGENTS.md); neutral wording on GitHub.

## Process notes

- Research: done, short ([`research.md`](research.md)): picks between the two directions the issue names and lists
  what a stub must carry.
- Framing: skipped. The problem is a measured failure with a one-line reproduction (the `linked` fixture), the issue
  names both possible directions, and research settles the choice from the code; nothing suggests the adoption
  feature itself is the wrong frame.
