# Research: observability-scheduled-workers

- `withObservability` keeps a request's records in an `AsyncLocalStorage` store and exports them with the span under
  `ctx.waitUntil`; records outside a store go to `pendingRecords` (100 at most) and leave with the next request.
- A Worker's `scheduled(controller, env, ctx)` gets `controller.scheduledTime` and `controller.cron`; `@softure-ai/jobs`'
  `createScheduledHandler` returns the tick's promise and also hands it to `waitUntil`, so awaiting the returned
  promise covers the tick.
- OpenTelemetry semantic conventions for a timer-triggered function: `faas.trigger = "timer"`, `faas.cron`; span kind
  internal (1).
