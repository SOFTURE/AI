# Example app (Next.js)

A Next.js 16 app built from `@softure-ai/core`, `@softure-ai/db` and `@softure-ai/ui`, and the
end-to-end harness of the repository: every module adds its scenarios here
([roadmap FD-7](../../context/foundation/roadmap.md)).

It installs the foundation packages the way an app gets them from npm: `.npmrc` sets
`install-links`, so `npm ci` packs `../../foundation/*` (their `files` and `exports`, built
`dist/` included) and installs copies, not symlinks. A file a package forgets to publish breaks
this app before it breaks a user.

## Run the e2e

```bash
npm run e2e            # at the repository root
```

[`scripts/e2e.mjs`](scripts/e2e.mjs) builds every package, reinstalls this app, starts Postgres
from [`compose.yaml`](compose.yaml) (port 5433) unless `DATABASE_URL` is set, runs
`softure migrate`, `next build`, and Playwright against `next start`. CI runs the same steps in
[`.github/workflows/e2e.yml`](../../.github/workflows/e2e.yml) on a Postgres service container.
With a Chromium already on the machine, `PLAYWRIGHT_CHROMIUM_PATH=<path>` skips Playwright's download.

The `context/workflow.json` key `integration.local` names this command, so orchestrators run it
before a change is ready.

## Develop

```bash
npm run build                          # at the root, after changing a package
cd examples/next-app && npm ci         # picks up the new dist/
docker compose up --detach --wait
npm run migrate
npm run dev
```

`DATABASE_URL`, `APP_ORIGIN` and `APP_LOCALE` (`en` or `pl`) come from the environment; see
[`.env.example`](.env.example). `next dev` reads `.env.local`, `npm run migrate` reads the shell.

## What is in it

| Path | What it shows |
| --- | --- |
| `softure.config.ts` | `defineSoftureConfig` with one module, registered for package code |
| `instrumentation.ts` | the config imported at server start (Node.js runtime only) |
| `modules/guestbook/` | a module defined in the app: manifest, `migrations/0001_create_entries.sql`, drizzle tables, queries returning `Result` |
| `app/layout.tsx` | `ThemeScript`, `SoftureThemeProvider`, `ToastHost` |
| `app/page.tsx` | `ThemeSwitch`, `Card`, `EmptyState`, the guestbook and the `softure.migrations` ledger |
| `app/add-entry.tsx`, `app/actions.ts` | `Modal` with an `ActionForm` posting to a server action validated with zod |
| `messages/` | the app's `en` and `pl` copy; no text is written inline |
| `e2e/` | Playwright: theme switch, modal and form, migrations |

## Adding a scenario

1. Use the module in the app (its package as a `file:` dependency, listed in `softure.config.ts`).
2. Add `e2e/<module>.spec.ts`. Read copy from the dictionaries, not literals; a test that writes
   data deletes it at the end (see `e2e/guestbook.spec.ts`).
3. `npm run e2e` at the root.

## Known limits

- A module's `migrations: { dir: new URL("./migrations/", import.meta.url) }` fails `next build`:
  Turbopack resolves a literal `new URL(…, import.meta.url)` as a file and finds a folder.
  `modules/guestbook/index.ts` passes `import.meta.url` through a value Turbopack does not follow.
  Recorded in [`context/backlog/next-integration.md`](../../context/backlog/next-integration.md).
- The bundle resolves packages only inside this folder (`turbopack.root` in `next.config.ts`), so a
  file missing from a packed copy fails `next build`. TypeScript has no such limit: when a packed
  copy lacks its `.d.ts`, `tsc` walks up to the repository's `node_modules` and finds the workspace
  package. The release pack check (`npm run release:pack`) covers declaration files.
- No authentication: the server action has no user to authorize, and nothing is rate-limited. It is
  a test fixture, not a deployable app.
