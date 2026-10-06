# Research: deploy-workflow-e2e-server

Question: how the end-to-end test of `deploy-app.yml` can run the tag's `deploy.sh` (DF-9's, on `master` at
`7f69fd3`) and `softure-deploy verify` on CI runners, with nothing leaving them.

## What the server half needs

`deploy.sh` (init's output, `tools/deploy/e2e/app/docker/server/deploy.sh`) needs, on the host it runs on: bash, Docker
with the compose plugin, `docker pull <image>:<tag>` to succeed, `npx @softure-ai/deploy@<version>` (backup, schema
guard, row counts), `pg_dump` for the backup, `flock`, `crontab` (the maintain line) and `logger`, ports 80, 443 and
`127.0.0.1:5432` free, and a writable app folder next to itself.

## Findings

1. **Where the server runs.** DF-3's server is an Alpine `sshd` container. Running `deploy.sh` inside it would need
   the Docker socket, the same absolute paths inside and outside (compose bind mounts `./traefik.yml` and
   `./initdb` resolve on the host), host networking (the backup reaches `127.0.0.1:5432`), Node, `pg_dump`, `flock`
   and a crontab whose "no crontab" message matches the one `deploy.sh` expects (busybox's differs). The deploy job's
   own runner is an Ubuntu 24.04 host with Docker, compose, `flock`, `pg_dump` and passwordless `sudo`: the shape
   `init` documents for a VPS. Decision: the runner is the server; `sshd` runs on it (installed by `apt` when the
   image lacks it), as the runner's user (in the `docker` group). The container goes.
2. **The image.** The build job's runner is not the deploy job's, so its local image is gone. `build-push-action`
   writes a `docker` archive (`outputs: type=docker,dest=…`) on the test path; it travels as an artifact. `deploy.sh`
   pulls the image, and a stub `docker` would skip a real step, so the deploy job runs a `registry:2` on
   `127.0.0.1:5000`, loads the archive and pushes it there. The e2e app's image becomes
   `localhost:5000/softure/ai-deploy-e2e` (init accepts it; the `check` job's pattern too).
3. **The CLI version.** The committed e2e app pins `@softure-ai/deploy@0.0.0` (so a version bump does not churn it),
   which is never published. The forced command puts an `npx` stand-in first on `PATH` that answers
   `npx --yes @softure-ai/deploy@<v> <command>` with the CLI built from the tag (DF-3 already builds it), and refuses
   anything else.
4. **TLS (the roadmap's unknown).** The compose file's Traefik asks Let's Encrypt for `deploy-e2e.example.com` and
   would serve its self-signed default certificate meanwhile; `verify` (and its certificate probe from DF-6) trusts
   the system store only. An `http://` allowance is no help: Traefik redirects port 80 to 443. Measured locally with
   `traefik:v3.5`: a certificate placed in the ACME store (`acme.json` in the `letsencrypt` volume, resolver
   `letsencrypt`, `Account: null`) is served, and Traefik logs "No ACME certificate generation required"; a
   certificate valid for 2 days made it try a renewal (within 30 days of the end), one valid for 90 days does not.
   Decision: a CA of the run signs the host's certificate, which is seeded into the volume before `deploy.sh` runs;
   the runner trusts the CA (`update-ca-certificates`, for `curl`) and `verify` gets `NODE_EXTRA_CA_CERTS`. The
   host name points at `127.0.0.1` in `/etc/hosts`. Nothing in the shipped files or in `verify` changes.
5. **Verify on another runner.** The `verify` job runs on a fresh runner that cannot reach the stack. Its two steps
   (wait for the health route, `softure-deploy verify`) run in the deploy job on the test path; the wait script is
   kept identical by the repository test.
6. **Docker Hub.** The compose file's `traefik:v3.5` and `postgres:16` are pulled from `mirror.gcr.io` and tagged
   under their own names (an anonymous pull from Docker Hub was refused with 429 in this session).
7. **The result line.** DF-9 made the send step require `result|ok` and had the recorder print it. With `deploy.sh`
   running after the recorder, the recorder's line would make a failed `deploy.sh` look like a release: the
   recorder prints nothing to stdout any more, and its log goes to stderr.

## Local run

In this session's container (Ubuntu 24.04, Docker 29, a `runner` user in the `docker` group with `sudo`):
`start-server.sh` installed `openssh-server` and `cron`, pushed the image to the local registry, seeded the
certificate and started `sshd`; the workflow's own pack and send steps (extracted from `deploy-app.yml`) sent the
release; `deploy.sh` ran every step to `result|ok` (postgres, backup, schema guard with 1 pending migration, switch,
tag, cron line installed); `curl` got 200 from `https://deploy-e2e.example.com/api/health` and `softure-deploy verify`
passed 2 of 2 routes. The image was a stand-in with the example app's shape (`/app/softure-migrations`, `migrate.mjs`,
the health route): building the example's Dockerfile needs npm inside a build container, which this session's proxy
does not reach. The real image runs on the pull request.

## Risks

- A runner image without `openssh-server` or `cron` costs an `apt-get update` (handled; seconds).
- The deploy job's 15-minute timeout: DF-3's job took 1.5 min; the server half adds image download, two image pulls,
  the stack start and verify, a few minutes.
