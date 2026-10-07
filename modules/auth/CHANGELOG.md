# Changelog

Newest first. Each version lists what changed for an app that uses `@softure-ai/auth`. When an app has run a version in
production, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done"). Versions before the first one below are described in their GitHub Releases (`auth@x.y.z`).

## 0.1.7

- `module.json` names `mailing` and `ops` as optional dependencies.
- Adapters and commands use the configured database handle; `@softure-ai/ui` is a peer dependency.
- Deny-by-default route guard and the legacy session cookie name.
- Registration fields, a register page factory, a submit variant and longer `next` paths.
- Legacy password hashes normalised to NFC, an unchanged new password refused, conditional reset buckets, session revocation.
- `set-temporary-password` ops script; `@softure-ai/ops` is an optional peer.
- `createTestAccount` in `@softure-ai/auth/testing`.
