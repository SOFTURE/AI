---
change_id: mailing-attachments-655
status: archived
---

# Plan: attachments on sendMail (issue #655)

Input: change.md, research.md. Complexity: medium (one package: contract, validation, options, provider adapters,
fake provider and outbox, CLI preview, jobs guard, docs).

## Phase 1: contract, options and validation (TDD)

Files: `modules/mailing/src/contract.ts`, `src/options.ts`, `src/server/validate-mail.ts`,
`src/server/send-mail.ts`, `src/server/deliveries.ts`, `src/server/index.ts`, `src/index.ts`,
`tests/send-mail.test.ts` (or a new `tests/attachments.test.ts`).

1. Tests first: a mail with attachments reaches the provider with filename, content type and the same bytes; no
   attachments gives `attachments: []`; refused as `mailing.invalid_input` with field `attachments` (nothing sent):
   more than `maxCount`, total over `maxTotalBytes`, empty content, content not a `Uint8Array`, filename empty, with
   `/`, `\`, a control character, `.` or `..`, over 255 characters, content type outside the allow-list or
   malformed; a provider without `supportsAttachments` refuses a mail with attachments (logged cause
   `provider_without_attachments`) and still sends one without; the failure log carries count, types and sizes,
   never the filename or content; options refuse `maxTotalBytes` above the default and an empty allow-list.
2. `MailAttachment { filename, contentType, content: Uint8Array }`; `OutgoingMail.attachments?`;
   `ProviderMessage.attachments: readonly MailAttachment[]`; `MailProvider.supportsAttachments?: boolean`.
3. Options `attachments: { maxCount (default 10, 1..100), maxTotalBytes (default 28,000,000, at most that),
   contentTypes (default allow-list) }`.
4. `validateMail(mail, options, limits?)` checks attachments; `sendMail`, `sendMailUnchecked`, `previewMail` and
   `deliverOnce` pass the configured limits. `describeAttachments(attachments)` returns
   `{ filename, contentType, size }[]` for an app's own log or dry run.

## Phase 2: providers, outbox and dry run (TDD)

Files: `src/providers/resend.ts`, `src/testing/fake-provider.ts`, `src/testing/outbox.ts`, `src/cli/run.ts`,
`tests/resend.test.ts`, `tests/fake-provider.test.ts`, `tests/cli.test.ts` (preview helper).

1. Resend maps attachments to `{ filename, content: base64, content_type }` and declares `supportsAttachments`.
2. The fake provider declares it, captures copies of the bytes; the outbox line stores content as base64 and
   `readMailOutbox` decodes it back to `Uint8Array` (old lines without `attachments` read as `[]`).
3. `printPreview` lists attachments as `<filename> (<type>, <size> bytes)`, never the content.

## Phase 3: queued deliveries

Files: `src/jobs/delivery-job.ts`, `tests/jobs.test.ts`.

1. Tests first: `enqueueDelivery` throws for a payload holding a `Uint8Array`/`ArrayBuffer` anywhere; a
   `buildMail` that returns attachments sends them.
2. Guard in `enqueueDelivery`; docs say attachments come from `buildMail` by reference.

## Phase 4: docs

`modules/mailing/README.md` (attachments section, limits, log, queue, drop "no attachments" from limitations),
`modules/mailing/CHANGELOG.md` `## Unreleased` with migration steps.

## Decisions (auto)

- Queued deliveries: attachments are stored by reference by the app (its own storage and retention) and loaded in
  `buildMail` on each attempt; the job payload stays ids only and `enqueueDelivery` refuses binary data in it.
  This needs no new table or retention job in mailing, and matches how the body is already rebuilt.
- `contentType` is required and must be on the allow-list; the app passes its own list in
  `mailing({ attachments: { contentTypes } })` to allow others ("explicitly passed").
- Default `maxTotalBytes` 28,000,000 raw bytes (about 37.3 MB base64, under Resend's 40 MB); configurable lower only.
- Default `maxCount` 10.
- The failure log carries the attachment count, content types and sizes, not filenames: a filename is app text that
  often holds personal data, and the module never logs the subject for the same reason. Deviation from the issue's
  "filenames" in the log; `describeAttachments` gives the app the filenames for its own records and the dry run
  prints them.
- `MailProvider.supportsAttachments` (opt-in): a provider without it gets no mail with attachments
  (`mailing.invalid_input`), so an older custom adapter cannot drop files silently.
- Empty attachments are refused: an empty file is almost always a bug in the caller.
- (During implementation) `ProviderMessage.attachments` is optional and present only when the mail has attachments,
  instead of an always-present empty list: a `ProviderMessage` built by existing code (tests, custom fakes, older
  outbox lines) stays valid and equal, and providers read `message.attachments ?? []`.
- (During implementation) the preview printer moved from the CLI to `formatMailPreview` in
  `server/operator-output.ts` (exported from `/server`), so it is tested directly and an app's own dry run can use it.
- (During implementation) the container lacked `ssh-keygen`, which a repository test of the deploy workflows needs;
  installed it locally (environment only, no repository change).

## Progress

- [x] Phase 1: contract, options and validation (700545c)
- [x] Phase 2: providers, outbox and dry run (700545c)
- [x] Phase 3: queued deliveries (700545c)
- [x] Phase 4: docs (4c1b800)
