---
change_id: quality-review-security-jobs-deploy
title: "security, jobs, deploy: close the findings of the 2026-11-19 quality reviews"
status: planned
roadmap_item: null
issue: null
branch: claude/project-thread-t8pq6z
created: 2026-11-19
updated: 2026-11-19
---

## Intent

Close the findings of the 2026-11-19 reviews at 01072699: the security review of `modules/security` (QR-d3866a23,
QR-8be820fc), the quality reviews of `modules/jobs` (QR-a2289334, QR-08b6e676, QR-eb6c9b7c) and `tools/deploy`
(QR-b1dff879, QR-1f28454f, QR-7b50ae7e, QR-a1525ff3, QR-da0414bb).

## Context

Asked in chat (no issue): review, fix, review again until the reports are clean, then release.

## Scope

- security `src/server/webhook.ts`: log the error's kind only (`errorLogLabel`); when the delivery id comes from an
  unsigned header, also record a key derived from the signed body, so a captured delivery resent with a new id is a
  replay. README "Replays", CHANGELOG.
- jobs `src/server/hooks.ts`: every hook races a time limit (`hookTimeoutMs`, default 10 s) and gets an
  `AbortSignal`; `src/react/use-job-status.ts`: each poll has a time limit. Tests for `toErrorCode`. README, CHANGELOG.
- deploy: drop the `export` of constants and a helper used only in their own CLI module.

## Notes

- Frame and research skipped: every finding names its cause, file and fix; the reports are the research.

## Decisions (auto)

- Body key: `sha256:<hex of the raw body>` under the same source, recorded in the same transaction after the header
  id. Either already present is a replay. A provider's honest retry has the same bytes and id, so nothing changes for
  it; a resend with a new header id over the same signed bytes is now skipped.
- Hook time limit as an option (`hookTimeoutMs`, 100 ms to 60 s, default 10 s), so tests and slow alert channels can
  set it; a timeout is logged like a throw (`the <hook> hook timed out`) and the hook's signal is aborted.
- Poll time limit: the larger of `maxIntervalMs` and 10 s, through `AbortSignal.any` with the unmount signal; a
  timeout reads as `network` and backs off.
