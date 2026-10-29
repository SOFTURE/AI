---
change_id: files-module-888
reviewed: 2026-10-29
verdict: approved
---

# Plan review: files-module-888

Checked plan.md against change.md, research.md, issue #888 (every numbered point of "Proposal") and the module
standard (docs/02).

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Major | Two concurrent saves for one owner could both pass the quota check. | Planned: the insert runs under `pg_advisory_xact_lock` per owner with the usage re-read; the loser's blob is deleted. |
| 2 | Major | A link must not leak whether a file exists: different answers for forged and expired links tell them apart. | Planned: one `404` body and header set for every refusal, the MAC checked before any lookup. |
| 3 | Major | A stored HTML or SVG file served from the app's origin could run script there. | Planned: `attachment`, `nosniff`, `Content-Security-Policy: sandbox`. |
| 4 | Major | A save that fails half way must not leave a partial blob or a row. | Planned: the local driver writes a partial file and renames; S3 aborts the multipart upload; saveFile deletes the blob on any refusal after the write. |
| 5 | Minor | A storage key built from user input could escape the storage folder. | Planned: keys come only from the file id; the local driver refuses a key outside `[a-z0-9/-]`. |
| 6 | Minor | `next build` must not need the link keys, the S3 secrets or the folder. | Planned: read or touched at use time only. |
| 7 | Minor | The name segment is user text in a URL. | Planned: sanitised at save (no path, no control characters, at most 255), percent-encoded in the URL, signed. |
| 8 | Check | Issue point 4 asks for a key ring "like connections". | Same format and rotation rule, own variable `SOFTURE_FILES_LINK_KEYS`. |

No Critical findings.
