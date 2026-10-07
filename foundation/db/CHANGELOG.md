# Changelog

Newest first. Each version lists what changed for an app that uses `@softure-ai/db`. When an app has run a version in
production, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done"). Versions before the first one below are described in their GitHub Releases (`db@x.y.z`).

## 0.1.6

- One database handle per process: `getConfiguredDatabase` opens the config's `database.handle` or URL once, and modules, health route and commands share it.
- App migrations run around module migrations (`before` and `after` hooks).
- Adoption: app baselines, `--adopt <module>@<version> --through <n>`, dependencies adopted first, and modules whose SQL references app tables (stub tables).
- **Breaking:** `pg` and `@electric-sql/pglite` are optional peer dependencies, no longer dependencies. An app installs
  the driver its `DATABASE_URL` uses and lists `"@softure-ai/db"` and that driver in `serverExternalPackages`
  ([README §2](README.md#2-installation)); a URL whose driver is missing fails with a message naming the package.
- A migrate bundle keeps drizzle's driver adapters external (`--external:drizzle-orm/pglite`,
  `--external:drizzle-orm/node-postgres`).
