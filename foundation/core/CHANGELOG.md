# Changelog

Newest first. Each version lists what changed for an app that uses `@softure-ai/core`. When an app has run a version in
production, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done"). Versions before the first one below are described in their GitHub Releases (`core@x.y.z`).

## 0.1.6

- `PublicError`, `isPublicError` and `getPublicMessage`: a message written for the user passes through, every other error's text stays out (`safeError` is unchanged).
- `selectPlural` builds one `Intl.PluralRules` per locale and reuses it.
- `database: { url, handle }`: the config can carry the app's own database handle, shared with the modules.
- An empty `database.url` is accepted when the config is defined and refused only by a command that connects (build stages need no `DATABASE_URL`).
- A guard against loading the package as CommonJS (ESM only).
