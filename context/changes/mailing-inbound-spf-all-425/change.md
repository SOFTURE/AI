---
change_id: mailing-inbound-spf-all-425
title: "mailing: the inbound cloudflare SPF check requires -all or ~all (issue #425)"
status: open
roadmap_item: null
issue: 425
branch: claude/project-thread-4ce1ur
created: 2026-10-13
updated: 2026-10-13
---

## Intent

Close [issue #425](https://github.com/SOFTURE/AI/issues/425) (labels `bug`, `pkg: mailing`, `adoption`):
`checkSenderDns(domain, { inbound: "cloudflare" })` accepts an SPF record that includes `_spf.mx.cloudflare.net`
but ends in `?all`, `+all`, a bare `all` or no `all` at all. Such a record lets anyone send as the domain. The inbound
SPF check must fail as `weak` unless the record's `all` is `-all` or `~all`.

## Context

mailing is at 0.1.14 on master. Releases are batched by the coordinator: no version bump, the CHANGELOG gets
`## Unreleased`. An adopting app keeps its own one-rule check as a workaround and can drop it after the release.

## Constraints

- Only the inbound SPF check changes; the sender SPF check (`spf`) keeps its `permissive` warning as it is.
- No new finding: `weak` already exists in `DnsFinding`.

## Notes

- Framing: skipped. The issue states the problem and the expected finding.

## Decisions (auto)

- Finding `weak`, status `fail` (the issue's suggestion; the inbound checks only pass or fail).
- The first `all` mechanism decides (RFC 7208 §5.1: mechanisms after `all` are never tested), qualifier `-` or `~`
  passes; `+all`, bare `all`, `?all` and a record without `all` fail as `weak`.
- A record without `all` that delegates with `redirect=` also fails as `weak`: the check does not follow
  redirects, and Cloudflare's own setup publishes `~all`.
- `missing-include` is reported before `weak`: the include is what makes the record the service's.
