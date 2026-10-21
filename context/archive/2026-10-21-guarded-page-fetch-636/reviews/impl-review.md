---
change_id: guarded-page-fetch-636
reviewed: 2026-10-21
verdict: approved
---

# Implementation review: guarded-page-fetch-636

Checked the diff (5f5e21d) against plan.md, change.md and issue #636.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | Every hop, the first URL and each `Location`, goes through `checkGuardedUrl` and `openGuardedRequest` (guarded lookup, `agent: false`); tests cover a redirect to a metadata literal, to a host resolving to `10.0.0.5`, to another port, scheme or credentials. | No change. |
| 2 | Check | The cap counts decoded bytes; a 10 MiB gzip bomb under 64 KiB stops at 64 KiB. Leaving the read loop destroys the decoder and, through the pipeline, the response. | No change. |
| 3 | Check | One timer tears down whatever request and response are open; a trickling body and a chain of slow redirects both end in `security.outbound_timeout`. | No change. |
| 4 | Check | `sendGuardedRequest` keeps its tests unchanged and green after sharing the guard. | No change. |
| 5 | Minor | A body cut at `maxBytes` can end inside a multibyte character. | Kept: `TextDecoder` replaces it with U+FFFD; documented as bytes. |
| 6 | Minor | `URL.parse` would need Node 22.1, the package supports 22.0. | Fixed: a local `parseUrl` with `new URL` in a try. |
| 7 | Minor | `htmlToReadableText` narrows to a single `article`, so a repository page's file list is left out. | Kept: the README is the page's content; the file list stays in the links of a page without an article. |

No Critical or Major findings.
