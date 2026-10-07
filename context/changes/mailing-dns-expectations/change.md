---
change_id: mailing-dns-expectations
title: "mailing: required DMARC policy, reply path and return-path checks in checkSenderDns (issue #206)"
status: plan_reviewed
roadmap_item: null
issue: 206
branch: claude/project-thread-bpfubi
created: 2026-10-07
updated: 2026-10-07
---

## Intent

Close every point of [issue #206](https://github.com/SOFTURE/AI/issues/206), so an adopting app can drop its own DNS
rules and rely on `checkSenderDns` / `softure-mail dns` alone:

1. **Required DMARC policy.** An option sets the minimum the DMARC record must carry (policy, subdomain policy,
   strict DKIM and SPF alignment). A weaker record (`p=quarantine` where `reject` is required, `adkim=r` where `s` is
   required, `pct` under 100) fails as `weak`.
2. **Reply path.** When a reply-to address is given (or configured), its domain must accept mail: MX records that are
   not a null MX (RFC 7505), and at most one SPF record.
3. **Return path.** Hosts the provider uses for MAIL FROM and bounces (Resend: `send.<domain>`, `rsend.<domain>`) must
   resolve: a CNAME (optionally to an expected target domain) or MX records. `resendReturnPath(domain)` gives Resend's
   pair.

A reviewer checks `tests/dns.test.ts`, `tests/cli.test.ts`, the README and the CHANGELOG.

## Context

Issue #206, filed while an adopting app replaced its own DNS check with the package's. Work is tracked in GitHub
Issues, not in a roadmap: no roadmap item; the PR closes the issue.

## Constraints

- Scope: `modules/mailing` only. No other open thread changes mailing.
- Additive API: existing calls and their report keys keep their meaning; new report keys are `null` / empty when the
  check was not asked for.
- The check never throws: a failed lookup is a finding.
- English-only code and docs.

## Process notes

- Research: skipped as a separate file. The issue names the function and line (`src/server/dns.ts:134`), and reading
  `dns.ts`, `cli/run.ts`, `options.ts`, `tests/dns.test.ts` and `tests/cli.test.ts` (master `98c8113`) confirmed all
  three gaps; findings are in plan.md's "Today" section.
- Framing: skipped. Each point is an observed gap with the fix the adopter proposed; the only open question (minimum
  vs. exact DMARC record) is a design decision recorded in plan.md.
