# Changelog

Newest first. Each version lists what changed for an app that uses the module. When an app has run a version in
production, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done").

## Unreleased

- No changes for an app: the first release published through the npm trusted publisher (OIDC) instead of a token.

## 0.1.0

- First version (#954): the `metering.charges` ledger, budgets per provider and day or month (optionally per account),
  `reserveSpend` / `settleSpend` / `releaseSpend` under a provider lock, `recordCharge`, `getSpend`, adapters for
  `@softure-ai/llm`'s `onUsage` and marketing-kit's `onCharge`, a privacy contributor and the
  `metering.prune-charges` job.
