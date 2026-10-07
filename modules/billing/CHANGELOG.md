# Changelog

Newest first. Each version lists what changed for an app that uses `@softure-ai/billing`. When an app has run a version in
production, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done"). Versions before the first one below are described in their GitHub Releases (`billing@x.y.z`).

## 0.1.7

- `sendAccessReminders` stops at a refused mail account or a spent quota (mailing's `halted`, counted in
  `retryLater`) and skips a reminder whose send was interrupted long ago (mailing's `uncertain`, counted in `skipped`).

## 0.1.6

- `module.json` names `mailing` and `ops` as optional dependencies.
- Adapters and commands use the configured database handle; `@softure-ai/ui` is a peer dependency.
