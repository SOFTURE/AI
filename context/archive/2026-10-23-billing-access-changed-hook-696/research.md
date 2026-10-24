---
change_id: billing-access-changed-hook-696
status: archived
---

# Research

Read on master c9eaf67: `modules/billing/src/options.ts`, `server/grants.ts`, `server/take-back.ts`,
`server/trials.ts`, `server/payments.ts`, `server/plans.ts`, `mailing/reminder-mail.ts`, `jobs/index.ts`,
`next/actions.ts`, `scripts/*`, mailing's `server/run-deliveries.ts`.

## Where access changes

| Function | Change | Transaction | Callers |
| --- | --- | --- | --- |
| `grantPlanManually`, `grantLifetimeManually`, `grantPaymentRequest` (via the first) | grant | `recordManualGrant` | admin actions, `grant-plan` script |
| `revokeManualGrant` | take-back of a manual grant | own | admin action, `revoke-grant` script |
| `extendTrialManually` | trial end moves | own | admin action, `extend-trial` script |
| `recordPayment` | provider grant (`granted`) | own | `receiveStripeWebhook`, other adapters' routes |
| `refundPayment` | full or partial take-back (`refunded`, `partially_refunded`) | own | `receiveStripeWebhook` |
| `failRefund` | days given back (`refund_failed`) | own | `receiveStripeWebhook` |
| `grantPlan`, `changeEntitlement`, `importEntitlement` | low-level, record nothing | caller's | building blocks, imports |

Every recorded change runs in its own `ctx.db.transaction` and returns the resulting `Entitlement`, so a hook called
by the public function after `transaction()` resolves sees committed data. The low-level functions run inside other
transactions (a hook there would fire before commit), so they stay silent.

## Options

`billingOptionsSchema` is a `z.strictObject`; the payment adapter is already a `z.custom` (functions pass through
the parse). Options are read with `getBillingOptions(ctx.config)`. Errors of app callbacks are logged with
`console.error` and the package prefix (`manual.ts`, `onRequest`); `errorLogLabel` (core) gives a log-safe label.

## Reminders

`runDeliveries` (mailing) calls `build(recipient)` and then, for a real run, `deliverOnce` and
`onDelivery(outcome)` for that same recipient, strictly in order, before reading the next recipient. Its
`onDelivery` takes only the outcome. Billing can therefore pair the outcome with the delivery it just built inside
its own `build` closure, without changing mailing; a recipient `build` skips never reaches `onDelivery`.
