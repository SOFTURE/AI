# Changelog

Newest first. Each version lists what changed for an app that uses `@softure-ai/security`. When an app has run a version in
production, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done"). Versions before the first one below are described in their GitHub Releases (`security@x.y.z`).

## Unreleased

- New `unidentified` option: `"refuse"` (the default, as before) or `{ key }`, which counts every request no
  resolver identifies under one shared key `unidentified:<key>`, for a stack with no edge in front (`next dev`, a test
  stack). `identifyClient` then returns `Ok<"unidentified:<key>">`.
- README: the same-image setup (a deploy-time variable switches the fallback on the test stack only) and why proxy
  headers behind Cloudflare carry the edge's address, not the client's.

## 0.1.6

- Described in the GitHub Release `security@0.1.6`.
