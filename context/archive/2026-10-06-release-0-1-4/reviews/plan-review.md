# Plan review: release-0-1-4

Date: 2026-10-06 · Verdict: approved

- `node scripts/release/plan-tags.mjs all` lists `testing@0.1.0` and `deploy@0.1.0` once the flag is gone, in
  dependency order after core and db.
- The stage step hands `NPM_TOKEN` to npm only for a package missing from npm (`release-0-1-3`), so the 16 existing
  packages still prove their trusted publishers while the two new ones use the token.
- `deploy` depends on `@softure-ai/core` and `@softure-ai/db` `^0.1.2`, which 0.1.4 satisfies.
