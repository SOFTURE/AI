---
change_id: blog-quality-gate
title: "Blog texts pass a quality gate before every publish and in CI"
status: archived
roadmap_item: BL-6
branch: claude/bl-6-dj6zv0
created: 2026-10-04
updated: 2026-10-04
archived_at: 2026-10-04
---

## Intent

An app that enables `@softure-ai/blog` gets a text quality gate: `softure-blog check [path…]` reports
findings (rule, severity, file and line) for structure, links, style, brand voice and YMYL rules, and
exits non-zero on any error; `softure-blog publish` refuses a file going public when the gate finds an
error. The app picks a language ruleset (`pl` ported from FIRE, `en` new), switches YMYL rules on or
off, adds its voice phrases and its own rule plugins in `blog({ quality })`. A reusable weekly
workflow runs the gate with `--external`. FIRE's two fixtures give the same findings through the `pl`
ruleset plus FIRE's domain rules written as plugins in a test.

Input: [`backlog-input.md`](backlog-input.md) (roadmap item BL-6).

## Context

From [`roadmap.md`](../../foundation/roadmap.md), item **BL-6** (roadmap `blog`, main since 2026-10-04):

> ### BL-6: Text quality gate
> - **Outcome:** A quality gate in `@softure-ai/blog` that runs before every publish and in CI:
>   - structure rules (answer first, heading order, length, summary present);
>   - link rules (internal targets exist, glossary terms resolve; external links checked only with `--external`);
>   - style rules from a ruleset chosen by the app: language (`pl` ruleset ported from FIRE, an `en` ruleset), AI-writing patterns, brand voice phrases from config;
>   - YMYL rules (a number needs a source, `current_as_of` required), switchable per app;
>   - a rule plugin API: FIRE's domain rules (`rules-facts`, `rules-chart`) stay in FIRE as plugins;
>   - findings with severity and file position; `softure-blog check` exits non-zero on errors, and `publish` refuses them;
>   - a reusable weekly workflow that runs the gate with `--external`.
> - **Unknowns:** how much of FIRE's Polish style list is generic Polish and how much is FIRE's voice;
>   whether rule messages are English only or come from dictionaries.
> - **Risk:** medium. Texts go to production without a human read; a weak gate ships bad copy.
> - **Baseline:** FIRE `src/lib/blog/quality/**` (fixtures and tests), `scripts/blog-check.mts`,
>   `.github/workflows/blog-links.yml`. After: the same fixtures give the same findings through the
>   `pl` ruleset plus FIRE's plugins in a test.

Coordinator brief (2026-10-04): only BL-6; BL-3 (renderer) runs in parallel in another thread. BL-2
left a `PublishGate` hook in `runBlogPublish` / `runBlogCli` (only for files going public, never for
`--withdraw`, any problem refuses the run) and asked for the gate code in `src/quality/`.

Known state: `modules/blog/` exists (BL-2): `parseArticleFile` (strict English frontmatter), the
publish run with the gate hook, the `softure-blog` bin with one command (`publish`).

## Constraints

- Exclusively owns: `modules/blog/src/quality/`, the reusable links workflow. Touches BL-2 files only
  where the gate plugs in (`options.ts`, `cli/run.ts`, `server/index.ts` exports, README, tests).
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` dictionaries.
- FIRE_TRACKER is read only: code is copied, never changed there.
- No release, tag or publish by the agent; the owner tags releases (BL-8).
- Gaps found go to `roadmap-blog-followups` as `BF-` items, not fixed here.

## Notes

- Research done: it answers the two unknowns, maps FIRE's 2.2k lines to the package and decides how
  Polish rule data passes the language gate.
- Framing skipped: the problem is not in doubt. The roadmap names the outcome, the source files and the
  baseline; the open questions are design choices that research settles.
- Archived 2026-10-04: `@softure-ai/blog` checks texts with a quality gate in `src/quality/` (structure, links, `en`/`pl` style rulesets, voice, YMYL switch, severity overrides, limits, rule plugins and a rule catalog for BL-7), `softure-blog check` runs it without a database and `publish` refuses a text going public with an error; the reusable `blog-links` workflow runs it weekly with `--external`; FIRE's fixtures give FIRE's findings through the `pl` ruleset and stand-in plugins. Gaps BF-5 and BF-6.
