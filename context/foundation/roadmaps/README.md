# Queued thematic roadmaps

One roadmap per backlog group (WORKFLOW §5.1): the file name equals the folder name in `context/backlog/`,
and each backlog folder links back here. Only `../roadmap.md` (the main roadmap) is executed; a queued
roadmap becomes the main one only when the owner promotes it (`softure-roadmap --promote <slug>`).
Finished main roadmaps move to `../archive/<YYYY-MM-DD>-roadmap.md`.

| Roadmap | Theme | Prefix | Status |
| --- | --- | --- | --- |
| [`roadmap-identity.md`](roadmap-identity.md) | security, auth, feature-switches, ops; FIRE adopts them | `ID-` | waiting |
| [`roadmap-engagement.md`](roadmap-engagement.md) | mailing, waitlist, mcp-access, privacy | `EN-` | waiting |
| [`roadmap-monetization.md`](roadmap-monetization.md) | billing, analytics | `MO-` | waiting |
| [`roadmap-marketing-kit.md`](roadmap-marketing-kit.md) | video, screenshot and OG generator | `MK-` | waiting |

Main roadmap now: [`foundation`](../roadmap.md) (`FD-`).
