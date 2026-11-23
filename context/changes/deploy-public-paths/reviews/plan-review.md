# Plan review: deploy-public-paths

Verdict: approved.

## Findings

1. **Warning: existing deploy.json files.** `publicPaths` is optional; files without it parse as before, and `app add`
   then keeps the inventory list unchanged (no report line). No migration needed.
2. **Warning: path characters.** The host inventory accepts `^/[A-Za-z0-9._~/-]*$`; the deploy schema uses the same
   pattern for `publicPaths`, so every listed path is one the inventory and Access accept.
3. **Suggestion: login detection false positives.** A route that expects a redirect (`status` 3xx) keeps the normal
   redirect check; only a route that expects a non-3xx status and gets a login redirect gets the new message. A
   plain redirect elsewhere keeps the old `status N, expected M` detail.
4. **Suggestion: bypass of `/`.** With `--public` the host would bypass the whole host; that is what a public app
   means. No special case.
