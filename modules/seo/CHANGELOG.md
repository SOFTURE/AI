# Changelog

Newest first. Each version lists what changed for an app that uses `@softure-ai/seo`. When an app has run a version in
production, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done"). Versions before the first one below are described in their GitHub Releases (`seo@x.y.z`).

## 0.1.6

- `robots.other` (default `{}`): more `name: value` lines written in every group of `robots.txt`, e.g.
  `{ "Content-Signal": "ai-train=yes, search=yes, ai-input=yes" }`; a list writes one line per value. Every group gets
  them, the one closing switched-off categories too, since a crawler with a group of its own reads only that group.
  Names the module writes itself (`User-agent`, `Allow`, `Disallow`, `Sitemap`) and values with a line break are
  refused at start-up. `RobotsRule` has the matching `other` field (Next's shape).
- README: signing IndexNow requests (e.g. web-bot-auth) through `submitToIndexNow`'s `fetchImpl`.
- The package tarball ships `CHANGELOG.md`; the README drops a stale status line.

## 0.1.5

- Described in the GitHub Release `seo@0.1.5`.
