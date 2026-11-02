# Research: billing free tier (issue #962)

Read: `modules/billing/src/entitlement.ts`, `contract.ts`, `options.ts`, `usage.ts`, `reminder.ts`,
`server/{entitlements,limits,usage,options,reminders,entitlement-sql}.ts`, `mailing/reminder-mail.ts`,
`ui/{access-badge,access-notice}.tsx`, `next/{pages,current-entitlement}.tsx`, `scripts/{status,entitlement}-scripts.ts`,
`testing/entitlement.ts`, `messages/en.ts`, migration 0012 and their tests.

## Findings

1. The state comes from one pure function, `resolveEntitlement(record, now, policy)`; every reader (the guard, the
   badge, the notice, reminders, limits, scripts) goes through it or through `Entitlement`. The policy is built from
   the options in `getEntitlementPolicy`, so a free tier is one more policy flag, not a new stored column.
2. Write access is `status !== "read_only"` in `hasWriteAccess`, `checkWriteAccess` and `requireWriteAccess`: a new
   status other than `read_only` writes without touching them.
3. Limits: `resolveLimit` switches on the status; `getDeclaredMeters` lists the blocks. A `free` case and the block in
   the list are all `consumeUsage`/`getUsage`/`getLimits` need.
4. `consumeUsage` refuses with `QuotaExhausted { usage }`; nothing says whether a plan would raise the limit.
   `resolveLimit` per plan answers it purely.
5. Reminders: `getAccessReminder` maps `read_only` to the ended mails and `isEnding` to the ending mails; the copy
   (notice and mail) says the account stops writing. With a free tier that is false, so the copy must know what the
   account falls back to. The ending entitlements do not carry it today.
6. Migration 0012's functions decide `paid | trial | read_only` in SQL from parameters the app passes
   (`getEntitlementStatesSql` fills them). A free tier is one more parameter with a default, so old calls answer as
   before. Changing a function's parameters and result columns needs `DROP FUNCTION` and `CREATE`.
7. There is no operator restriction today: read-only only follows from an ended trial or paid access. With a free
   tier no account reaches read-only; an operator restriction would be a feature of its own.

## Options

1. A policy flag and a `free` status in the union, with `afterEnd` on ending states for the copy. Additive.
2. Emulate free as `read_only` with a flag. Keeps the badge and the notice wrong, which is the issue's complaint.

Recommendation: option 1.
