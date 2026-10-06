# Research: deploy-init-template

Date: 2026-10-06. Sources: the roadmap item, [`docs/06-fire-extraction-2.md`](../../../docs/06-fire-extraction-2.md),
`tools/deploy/` (DP-1, DP-3, DP-4), `.github/workflows/deploy-app.yml` and `tools/deploy/examples/deploy.yml` (DP-2),
the container recipe in [`modules/ops/README.md`](../../../modules/ops/README.md) and its verified instance in
`examples/next-app/` (`Dockerfile`, `compose.container.yaml`, `scripts/container.mjs`). FIRE_TRACKER's `docker/**`
could not be read: cloning it was refused in this cloud session (the limit recorded in DF-1).

## Questions

1. **Which answers does `init` ask, and which does it read (the roadmap unknown)?**
   - **Flags, not prompts.** Every answer is a flag, so `init` runs the same in a terminal, a script and the CI
     job; a missing required flag is a usage error that names it.
   - **Asked:** `--domain` (the apex host: Traefik rule, `APP_ORIGIN`, the caller's `app-url`), `--image` (the
     GHCR name the workflow pushes and compose pulls). Optional: `--paths` (allowed path prefixes on the apex,
     default `/`), `--www` (redirect `www.<domain>` to the apex), `--acme-email`, `--env` (the app's own required
     secrets, added to the app service as `${NAME:?}` so `env render` renders them), `--tables` (what `row-counts`
     compares), `--name` (the compose project and server folder).
   - **Read from the app, not asked:** `package.json`. `name` gives the default `--name`; `@softure-ai/db` among the
     dependencies turns on the database part (Postgres with the ops roles, the migrate service, `scripts/migrate.ts`,
     the DP-3 steps in `deploy.sh`); `@softure-ai/ops` means `/api/health` exists (the workflow's health path and a
     `deploy.json` route; otherwise `/`). A `public/` folder adds its `COPY` to the `Dockerfile`; a `next.config.*`
     without `standalone` gets a warning.
   - **Not read from `softure.config`:** it holds modules and runtime settings, not deploy facts (domain, image,
     server), and loading it means running the app's TypeScript with its dependencies installed. `package.json`
     already answers "is there a database" and "is there a health route".
2. **What does the Dockerfile look like?** The ops recipe (two stages, standalone output, the migrate bundle,
   `HEALTHCHECK` in the image, a non-root user), with `COPY . .` before `npm ci`: an app with `file:` dependencies
   (vendored tarballs, the CI job's staged example) installs only when they are in the context. `BUILD_STANDALONE=1`
   is set for apps that switch `output: "standalone"` on it, as the example does.
3. **How does `deploy.sh` meet DP-2 and DP-3?** DP-2 calls the forced command with
   `SSH_ORIGINAL_COMMAND="deploy <tag>"` and `.env.prod` on stdin. The script checks the command and the tag (the
   workflow's regex), writes `.env.prod` with mode 0600, pulls `<image>:<tag>`, and with a database: `backup`,
   `schema-guard` on the migrations copied out of the new image (`docker create` + `docker cp`, so the runner image
   needs no CLI), `row-counts --out`, `docker compose up -d --wait` (migrate runs before the app through
   `service_completed_successfully`), `row-counts --compare`. The CLI runs on the host through
   `npx --yes @softure-ai/deploy@<version>`; the host needs Node 22 and `pg_dump` of the server's major version, and
   reaches Postgres on `127.0.0.1` only (the port is published on loopback). It reads the superuser password from
   `.env.prod` without sourcing it.
4. **Traefik rules.** Traefik runs in the app's compose (one app per VPS, the FIRE shape). Static configuration is
   command flags in compose (entry points, HTTP to HTTPS, ACME HTTP challenge, the file provider); the rules file
   `docker/prod/traefik.yml` holds the apex router (`Host` and, unless `/`, the allowed `PathPrefix`es plus
   `/_next/`), security headers (HSTS, `nosniff`, referrer policy), the optional `www` redirect and the service.
5. **How do the files reach the server?** The workflow sends only `.env.prod`. The compose file, the rules,
   `initdb/` and `deploy.sh` are copied to the server folder once (and again when they change); shipping them with
   each release is a gap for `deploy-followups`.
6. **How can CI build the example app's image from the generated `Dockerfile`?** The example installs workspace
   packages through `file:../../…`, which a standalone context cannot reach. The job stages it as a standalone app:
   copies its tracked files to a temp folder, packs the workspace packages it depends on into `vendor/`, points the
   dependencies at the tarballs, writes a lockfile, runs the built `init`, validates the compose file with
   `docker compose config` and the script with `bash -n` (and `shellcheck` when present), then `docker build`.

## Answer to the unknown

`init` asks for the domain and the image (plus optional paths, `www`, ACME email, the app's secrets and row-count
tables) as flags, and reads the rest from `package.json` and the file tree; nothing comes from `softure.config`.
Not in this item: FIRE parity of the templates (DF-1) and shipping the server files with each release (a new gap).
