# Plan review: blog-publish-cache-refresh

Reviewed: plan.md against change.md, research.md and the roadmap item BF-10 (author's review, `--auto`).
Verdict: approve. Findings: 0 critical, 3 warning, 2 suggestion.

## Lenses

- Outcome coverage: an authenticated, rate-limited route from `@softure-ai/blog/next` that refreshes the tag;
  the command calls it before the IndexNow submit; without it the command names `revalidateSeconds`.
- Contracts: the command's output lines (existing tests assert whole arrays), the manifest (routes, env,
  mount, optional dependency), the root entry's exports.
- Security: the secret never logged or echoed, compared in constant time, never sent across a redirect; the
  route counts before it authenticates; a short secret refused.
- Failure paths: an app without the route (404), a different secret (401), a flood (429), the limiter's
  database down (503), the app down or slow (timeout).

## Findings

### W1 [WARNING] The e2e spec could pass without the refresh
**Where:** Phase 2, `e2e/blog-refresh.serial.spec.ts`.
**Problem:** if the page were not cached at all, the changed body would show without the route, and the spec
would prove nothing.
**Decision:** Fixed in the plan - the spec loads the page before the publish (filling the cache), and the
implementation records one run with the secret withheld from the command, where the old body stays: the
negative control goes in the impl review.

### W2 [WARNING] Existing command tests read `process.env`
**Where:** `tests/cli.test.ts`, the `run` helper.
**Problem:** with the command reading `process.env` by default, a developer's `BLOG_REFRESH_SECRET` would
change the asserted lines.
**Decision:** Fixed in the plan - `RunBlogCliOptions.env` (as the mailing command has), and the tests pass
their own environment.

### W3 [WARNING] A failed refresh before the IndexNow submit
**Where:** the order in `runPublish`.
**Problem:** a crawler pinged after a failed refresh may see the old page.
**Decision:** Accepted - the submit still goes out: the pages refresh after `revalidateSeconds` anyway, and
crawlers rarely come within that window; holding the submit would lose it for good. The warning says the
app shows the change after `revalidateSeconds`.

### S1 [SUGGESTION] Codes for the client's failures
**Decision:** Fixed in the plan - `blog.refresh_invalid_secret` (shorter than 32 characters),
`blog.refresh_unreachable` (network or timeout), `blog.refresh_rejected` (any answer but 204/200, the status
in the reason), mirroring seo's IndexNow codes.

### S2 [SUGGESTION] Several instances
**Decision:** Accepted as a documented limitation (research 2): the README says the default cache handler
refreshes the instance that answered; a shared cache handler covers the rest. Not a gap for the roadmap: it
is how Next's cache works, not something the blog can change.

## Progress mechanics

One `## Progress`, last; phase titles match; the gates item is last among each phase's automated ones.

## Triage summary

All findings decided; nothing pending.
