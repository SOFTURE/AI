---
change_id: deploy-release-retention-1171
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and master (dbc2281).

- Acceptance of #1171: setting with schema and init (phase 1); `cleanup` with dry run, keep N, protected images,
  tools images, dangling and build cache, disk before and after (phase 2); maintain bounded (phase 2); CLI, README,
  CHANGELOG and tests (phases 1-3). Each point has a test.
- Risk: removing the rollback image. The rollback target is read from `.env.prod.prev`, and keep is at least 2.
- Risk: another project's data. Only `docker image ls <own repository>` and `softure-deploy-tools` are listed;
  no volume or container command is issued; a test asserts another repository is never removed.
- Risk: a deploy now prunes release folders after the settings step instead of the files step; a failed settings
  step then leaves the old folders, which is safer.
- Risk: bash 3.2; no associative arrays (seen ids kept in a newline string), `df -Pk` only.

Verdict: approved.
