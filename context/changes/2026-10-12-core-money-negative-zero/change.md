---
change_id: core-money-negative-zero
title: "core: formatMoney never prints a minus on zero (issue #375)"
status: open
roadmap_item: null
issue: 375
branch: claude/project-thread-pbuepq
created: 2026-10-12
updated: 2026-10-12
---

## Intent

Close [issue #375](https://github.com/SOFTURE/AI/issues/375): `formatMoney(-0, "PLN", "en")` prints `-PLN 0.00` and
`{ rounded: true }` prints `-PLN 0` (pl: the same minus before `0,00`). A negative zero is ordinary output of `Math.round(-0.4)`, so an app formatting
computed amounts shows a minus on zero.

After the change `formatMoney` shows zero without a sign in every mode, and the adopting app can drop its wrapper.
A reviewer checks the new cases in `foundation/core/tests/format.test.ts`.

## Context

Issue #375 (labels `bug`, `pkg: core`, `adoption`), filed by an adopting app. Work is tracked in GitHub Issues: no
roadmap item; the PR closes the issue. `@softure-ai/core` 0.1.9 is the last released version.

## Constraints

- Non-zero amounts keep their output byte for byte, signed and unsigned.
- No version bump: the fix rides the next release (CHANGELOG `## Unreleased`).
- English-only code and docs.

## Notes

- Framing: skipped. The issue names the defect, the expected output and a proposal.

## Decisions (auto)

- Fix with `signDisplay: "negative"` instead of normalizing `-0` (see research.md).
