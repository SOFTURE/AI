# Plan: privacy-copy-account-target

## Approach

1. **ops: run context.** `OpsScript.run(tx, args, context)` with `OpsRunContext { commit: boolean }`;
   `executeOpsScript` passes `{ commit: options.commit }`. Test in `modules/ops/tests`: `run` sees the flag in a
   dry run and with commit. README, CHANGELOG `## Unreleased`.
2. **privacy: ledger check in `copyAccount`.** Read the ledger in the source's read transaction and in the target's
   write transaction; when `(module, version) -> checksum` differs, refuse `privacy.copy_ledger_mismatch` with a
   detail listing up to five differences. Option `ledger?: "refuse" | "ignore"` (default `"refuse"`). Tests: a
   migration only one side has refuses, a different checksum refuses, `"ignore"` copies.
3. **privacy: `newEmail` in `copyAccount`.** Normalised (trim, lowercase); the existence check uses it instead of
   the copied email; after verification, `auth.users.email` is set and the copied email-keyed consents move to the
   new key (rows the target already had under the old key stay). A unique violation becomes
   `privacy.copy_account_exists`. Tests: rename copies with the new email and consents keyed by it, the old email
   existing in the target is no refusal, the new email taken refuses, a dry run writes nothing.
4. **privacy: script.** `--to` (secret, `--to-file`), `--new-email` (zod email). With `--to`: open the target
   (`openTarget`, default like `openSource`), run the copy in a transaction there, measure before/after inside it,
   roll it back unless `context.commit`. Refuse when the context is missing (an older ops), and a usage error when
   `--to` equals `--from`. Tests: dry run and commit into `--to` leave the app database untouched, `--new-email`,
   `--to-file`, same URL refused.
5. Docs: privacy README section 11 (script and `copyAccount`), CHANGELOG `## Unreleased`.

## Decisions (auto)

- **D1: a run context in ops, not a target chosen by the ops helper.** The helper opens the configured database
  before the script sees its arguments; letting a script pick it would change `runOpsScript`'s flow for every
  script. A third `run` argument is additive and lets any script with a second database honour the dry run.
- **D2: `--to` runs its own transaction, mirroring the app-database mode.** The copy runs with `commit: true`
  inside a target transaction the script rolls back on a dry run, so `before`/`after` are measured inside it as in
  the default mode. The target commits before the (empty) ops transaction; nothing else is written there.
- **D3: `newEmail` as an option, not an `afterCopy` hook.** The issue offers either; the option covers the asked
  case with the right existence check and consent rekeying, which a hook could not change. A hook can follow
  when an app needs another post-copy write.
- **D4: the ledger check is on by default.** A silently NULL column is the failure the issue reports; a refusal
  with an opt-out (`ledger: "ignore"`) is safer than an opt-in nobody sets. Compared: `(module, version)` and
  `checksum`; not `applied_at`, `method`, `module_version`. Two databases without a ledger compare equal.
- **D5: include tables matched by email keep the old address.** `include` rows are the app's data, copied as they
  are; the README says so. Only `auth.users.email` and the copied email-keyed consents change.
- **D6: no version bump.** Releases are batched; both CHANGELOGs get `## Unreleased`.

## Progress

- [x] 1. ops run context
- [ ] 2. ledger check
- [ ] 3. newEmail
- [ ] 4. script --to and --new-email
- [ ] 5. docs
