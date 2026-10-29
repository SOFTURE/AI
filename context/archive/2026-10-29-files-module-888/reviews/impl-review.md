---
change_id: files-module-888
reviewed: 2026-10-29
verdict: approved
---

# Implementation review: files-module-888

Checked the diff against plan.md, change.md and issue #888 (each numbered point of "Proposal").

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Major | The quota must hold under concurrent saves. | Usage re-read inside the transaction under `pg_advisory_xact_lock` per owner; the test with two concurrent saves that each fit alone sees one `ok` and one `files.quota_exceeded`, one object in storage. |
| 2 | Major | A forged or expired link must cost no database read. | `verifyFileLink` runs before `findLiveRow`; tested with a context whose `db` throws on any access. |
| 3 | Major | Every dead link answers the same. | One `notFound()`; tests compare status, headers and body for forged (eight tamperings), expired, revoked, deleted and missing-bytes links. |
| 4 | Major | A base64url MAC has spare bits, so decoded bytes would accept several spellings. | Compared as ASCII text with `timingSafeEqual`, every key tried. |
| 5 | Major | A refused or failed save must leave nothing. | The size cap throws inside the driver's write; saveFile deletes the blob on every refusal and failure; tests for the cap, a body that throws, a driver that throws, the quota and dedupe check storage and rows. |
| 6 | Minor | `bytes=N-` past the end was read as malformed (200) instead of unsatisfiable (416). | Fixed while testing; the parser has its own table of cases. |
| 7 | Minor | User content on the app's origin. | `attachment` by default, `nosniff`, `Content-Security-Policy: sandbox; default-src 'none'`, `no-referrer`; README §12. |
| 8 | Minor | SigV4 must be right without a live bucket. | Checked against AWS's published S3 test vector; the driver runs against an in-memory S3 for single, multipart, aborted and empty uploads. |
| 9 | Check | Issue points 1 to 8: table, drivers, server functions, links, retention, privacy and health, testing, docs. | All present; the edge bypass is README §4 (`@softure-ai/host` `bypassPaths`). Client uploads, transforms, scanning and a UI stay out (issue scope). |
| 10 | Check | Module standard: twelve README sections, module.json equal to the manifest, `en` only, `dependsOn` naming jobs as optional. | Repository tests and the module's own tests pass. |

No Critical findings.
