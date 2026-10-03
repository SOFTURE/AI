# Plan review: privacy-consents-legal

Reviewed: plan.md against change.md, research.md, the roadmap item EN-8 and docs/02 (author's
review, `--auto`). Verdict: approve.

- **Scope.** Covers the three outcomes of EN-8 (ledger, API used by registration and the waitlist,
  legal shell) and the baseline (registration produces consent rows, legal pages render app
  content). The waitlist half of the baseline lands with EN-5, which records through this API.
- **Unknowns.** All three answered with a reason in research §2.
- **Risk.** Evidence must be complete: the registration hook runs in the account's transaction and
  throws on misconfiguration, so no account exists without its rows; rows cannot be updated.
- **Migrations.** One file in the module's own schema; the FK to `auth.users` holds because privacy
  depends on auth (its migrations run first, its deletion runs before auth's).
- **Shared files.** The example's config, layout, ledger and health lists change in this item only;
  EN-3 (in parallel) owns `modules/mailing/` and its own scenario files.
