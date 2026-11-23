# Implementation review: deploy-public-paths

Verdict: approved.

## Findings

1. **Warning: older pinned CLIs and the strict schema.** `deploySchema` is strict, so a `deploy.json` with
   `publicPaths` is refused by a `softure-deploy` older than the release that carries this change. `init` writes
   `publicPaths` together with `deploy.sh`'s `DEPLOY_CLI` pin and the workflows' version of the same release, so
   generated apps stay consistent; an app adding the key by hand must bump its pin. Stated in the CHANGELOG's
   Migrate line ("add `publicPaths`" lands with the release). No change.
2. **Suggestion: login detection scope.** Only redirects whose target is Access or a page named
   `login`/`log-in`/`signin`/`sign-in` get the new message; other redirects keep `status N, expected M`. Tests cover
   both, and an expected redirect to `/login` still passes.
3. **Suggestion: app without a health route.** Behind a login it still verifies `/` (the only route left) and gets
   the new message on its first release; the README says to add `@softure-ai/ops` or pass `--public`. A warning at
   init time was tried and dropped: it fired for every app without ops, most of them public.
4. Language gate, lint, typecheck green on every commit; tests listed in Progress.
