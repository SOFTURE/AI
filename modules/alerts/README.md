# @softure-ai/alerts

One channel to tell the operator. The modules already emit the events an operator should hear about (a failed job, a
schedule that turned failing or late, a failing health check); without this module every app turns them into mail or
chat messages itself, and one outage sends hundreds of identical messages. Here an app calls `alert()` with a key, and
the module decides whether a message goes out, sends it through a jobs queue to the configured channels, and sends a
recovery when the key resolves.

## 1. What it provides

- `alert(ctx, { key, severity, title, details?, link? })`: the first occurrence of a key goes out; repeats within the
  window are counted, not sent; the first one after the window (or one with a higher severity) sends a summary with
  the count ("Happened 37 more times since the last message"). The `alerts.flush` schedule sends the summary of
  repeats when no further occurrence comes.
- `resolveAlert(ctx, key)`: the recovery message, with the repeats not reported yet. A resolved key that comes back
  fires again, counting from one.
- Delivery on the jobs queue `alerts.deliver`, one job per channel and message: a channel outage retries there (about a
  day of backoff) and never blocks the caller or the other channels.
- Channels: Slack, Discord and Telegram webhooks, a generic JSON POST, mail through `@softure-ai/mailing` from a named
  operator sender, or the app's own (`defineAlertChannel`). Per channel: a minimum severity and quiet hours.
- Adapters: `alertsFromJobs()` for jobs' `onJobFailed`, `onScheduleStateChanged` and `onQueuePaused`;
  `alertFromHealthReport()` for the health checks of `@softure-ai/ops`.
- `softure-alerts test`: a test message to each channel, at once, with each channel's outcome.
- `AlertsPage`: the admin list of recent alerts, behind the app's role check.

## 2. Installation

```bash
npm install @softure-ai/alerts @softure-ai/jobs @softure-ai/core @softure-ai/db drizzle-orm zod
```

The mail channel also needs `@softure-ai/mailing`; the admin page needs `@softure-ai/ui`, `next`, `react` and
`@softure-ai/auth` for its role check. A chat-only app without a page needs none of them.

## 3. Configuration

```ts
import { defineSoftureConfig } from "@softure-ai/core";
import { alerts, slackChannel, telegramChannel } from "@softure-ai/alerts";
import { alertsFromJobs, alertsJobQueues, alertsJobSchedules } from "@softure-ai/alerts/jobs";
import { mailChannel } from "@softure-ai/alerts/mailing";
import { requireRole, authorizeRole } from "@softure-ai/auth/next";
import { jobs } from "@softure-ai/jobs";
import { mailing, resend } from "@softure-ai/mailing";

export default defineSoftureConfig({
  // database, locale, timezone, appOrigin …
  modules: [
    jobs({
      queues: { ...alertsJobQueues, "app.sync": {} },
      schedules: { ...alertsJobSchedules, "app.sync": { every: "1h" } },
      ...alertsFromJobs({ link: "https://app.example.com/admin/jobs" }),
    }),
    mailing({ from: "App <hello@mail.example.com>", senders: { alerts: "App alerts <alerts@mail.example.com>" }, provider: resend() }),
    alerts({
      channels: {
        ops: slackChannel({ url: process.env.ALERTS_SLACK_URL }),
        phone: telegramChannel({
          botToken: process.env.ALERTS_TELEGRAM_TOKEN,
          chatId: process.env.ALERTS_TELEGRAM_CHAT,
          minSeverity: "critical",
        }),
        mail: mailChannel({
          to: process.env.ALERTS_MAIL_TO,
          sender: "alerts",
          quietHours: { from: "22:00", to: "07:00", timeZone: "Europe/Warsaw" },
        }),
      },
      panelGuard: { requireRole, authorizeRole },
    }),
  ],
});
```

| Option | Default | Meaning |
| --- | --- | --- |
| `channels.<name>` | (at least one) | a channel from a factory below; the name is lowercase letters, digits, `_` and `-` |
| `repeatWindowSeconds` | `3600` | while a key fires, repeats within this many seconds after the last message are counted, not sent (60 s to 7 days) |
| `retentionDays` | `30` | days a resolved alert stays in the list before the flush job deletes it |
| `panelRole` | `"admin"` | the auth role that may open the admin page |
| `panelGuard` | none | `{ requireRole, authorizeRole }` from `@softure-ai/auth/next`; without it the page is "not found" for everyone |
| `routes.panel` | `/admin/alerts` | the page's path |

### Channels

Every factory takes `minSeverity` (default `info`: every alert) and `quietHours` (none). A URL, token or address may be
`undefined` (an environment variable that is not set): the config still loads, and each delivery to that channel fails
at once with `alerts.channel_unconfigured`.

| Factory | Sends |
| --- | --- |
| `slackChannel({ url })` | an incoming webhook: `{ "text": ... }`, at most 3000 characters |
| `discordChannel({ url })` | a webhook: `{ "content": ... }`, at most 2000 characters, mentions disabled |
| `telegramChannel({ botToken, chatId, apiOrigin? })` | the bot's `sendMessage` as plain text, at most 4096 characters |
| `webhookChannel({ url, headers? })` | a JSON POST of the message's fields (`kind`, `key`, `severity`, `title`, `details`, `link`, `repeats`, `occurrences`, `at`) plus `channel`, `subject` and `text` |
| `mailChannel({ to, sender? })` (`@softure-ai/alerts/mailing`) | a transactional mail through `@softure-ai/mailing`, from the named sender of `mailing({ senders })`, with an idempotency key per delivery |
| `defineAlertChannel({ kind, deliver })` | the app's own: `deliver(delivery, { config })` resolves `ok()` or a `ChannelFailure` |

The webhook channels take `fetch` (tests) and `timeoutMs` (default 10 000). A rate limit (`429`) waits its
`Retry-After`; `5xx` and network failures retry with the queue's backoff; a refusal (`401`, `403`, a redirect, `404`
for a deleted webhook, any other `4xx`) fails the delivery at once.

### Quiet hours

`quietHours: { from: "22:00", to: "07:00", timeZone: "Europe/Warsaw", exceptSeverities?: ["critical"] }`: a message
produced inside the window waits until its end (the delivery job's `runAt`), unless its severity is exempt
(`critical` by default). `from` later than `to` crosses midnight; the end is the local time, also on the night the
clocks change.

## 4. Mounting

- The worker runs the module's jobs: `handlers: { ...appHandlers, ...alertsJobHandlers }` from
  `@softure-ai/alerts/jobs`, next to `alertsJobQueues` and `alertsJobSchedules` in `jobs({ ... })` (section 3).
- `app/admin/alerts/page.tsx`: `export { AlertsPage as default } from "@softure-ai/alerts/next";`.
- `package.json` scripts: `"alerts:test": "softure-alerts test"`.

### Raising alerts

```ts
import { alert, resolveAlert } from "@softure-ai/alerts/server";

await alert(ctx, {
  key: "import:bank", // one alert per key; repeats are counted
  severity: "critical", // info, warning or critical
  title: "The bank import stopped", // one line, at most 200 characters
  details: "The bank answered 503 three times.", // optional, at most 4000 characters
  link: "https://app.example.com/admin/imports", // optional, http(s)
});

// Later, once it works again:
await resolveAlert(ctx, "import:bank");
```

`ctx` is `{ db, clock, config }`; `db` may be an open transaction, so the alert and its delivery jobs commit with the
caller's write, and a rolled-back caller sends nothing. `alert` answers `ok("fired" | "counted" | "repeated")`, or
`err("alerts.invalid_input")` for a key, title, details or link out of bounds. Keys are letters, digits and
`. _ : / @ -`, up to 200 characters. Keep personal data out of every field: the text goes to chat services and mail.

### Jobs

`alertsFromJobs(options?)` returns hooks for `jobs({ ... })`:

| Hook | Key | Default severity |
| --- | --- | --- |
| `onJobFailed` | `jobs.failed:<queue>`: one alert per queue, each failed job counted | `warning` (`jobFailedSeverity`) |
| `onScheduleStateChanged` | `jobs.schedule:<queue>`: fires on `failing` or `late`, resolves on `healthy` | `critical` (`scheduleSeverity`) |
| `onQueuePaused` | `jobs.paused:<queue>`, with the code and the end of the pause | `warning` (`queuePausedSeverity`) |

`onQueuePaused` takes `{ queue, code, until }` and is ready for the queue pause jobs is getting; pass it once the
installed jobs version accepts it. The hooks never alert the module's own queues (`alerts.deliver`, `alerts.flush`),
so a failing channel cannot raise alerts about itself, nor the queues in `ignoreQueues`. A failure to record an alert
is logged by kind and never reaches the job.

### Health checks

The health route answers a load balancer many times a minute, so alerts come from a scheduled job that runs the same
checks:

```ts
// src/jobs/handlers.ts
import { alertFromHealthReport } from "@softure-ai/alerts/server";
import { collectHealthChecks, runHealthChecks } from "@softure-ai/ops/server";

"ops.health": defineJobHandler({
  payload: z.object({}),
  run: async (_payload, ctx) => {
    const report = await runHealthChecks(ctx, { checks: collectHealthChecks(ctx.config, ctx.db), timeoutMs: 5000 });
    const result = await alertFromHealthReport(ctx, report, { link: "https://app.example.com/api/health" });
    return result.ok ? ok() : result;
  },
}),
```

A check that is not `ok` fires `health:<name>` (`critical` by default, `severity` and `keyPrefix` change it); a check
that passes resolves it.

### Test command

`softure-alerts test [--channel <name>] [--severity info|warning|critical] [--config <file>]` sends a test message to
every channel (or only `--channel`) at once, without the queue or a database, and prints `ops: sent` or
`ops: alerts.channel_refused` per channel; it exits 1 when any channel failed. It loads the config like `softure-mail`
(a file Node can load); a bundled app runs `runAlertsCli({ config, argv })` from `@softure-ai/alerts/cli` in a script.

## 5. Migrations and tables

Schema `alerts`, one table, migrated by `softure migrate`:

- `alerts.alerts`: one row per key: `severity`, `title`, `details`, `link`, `status` (`firing` or `resolved`),
  `occurrences` since it started firing, `pending_repeats` not reported yet, `opened_at`, `last_seen_at`,
  `last_notified_at`, `resolved_at`. Constraints keep the key's pattern, the lengths and the counts consistent.

Deliveries are jobs rows (`jobs.jobs`, queue `alerts.deliver`), not a table of this module.

## 6. Environment variables

None of its own. Channels read their URLs, tokens and addresses from variables the app names (section 3); none is
required to load the config.

## 7. Switches

None.

## 8. Appearance

`AlertsList` (`@softure-ai/alerts/ui`) slots: `root`, `list`, `item`, `header`, `title`, `status`, `details`,
`detail`, `link`, `empty`, through `classNames` or `unstyled`. It uses only `@softure-ai/ui` classes; the status is
`danger` for a firing critical alert, `warning` for a warning, `muted` for info and `success` once resolved.

## 9. Copy

`src/messages/en.ts`: `severity.*`, `tag.*` (the `[Critical]` prefix of each message kind), `repeats` (plural forms),
`open`, `test.*`, `jobs.*` (titles and details of the jobs adapter), `health.title`, `page.*` and `errors.*`. Messages
are rendered in the config's locale when they are delivered; the titles of the adapters are stored in the alert when
it is raised.

## 10. Hooks

- `alertsFromJobs()` provides jobs' hooks (section 4).
- `defineAlertChannel({ kind, deliver })` is the app's own channel: a pager, an SMS gateway, a ticket system.
- Other modules raise alerts by calling `alert` from their own hooks, e.g. a metering budget hit.

## 11. GDPR

Stores no personal data by design: keys, titles and details are operational text the app writes. It exports and
deletes nothing for a user; keep user data out of alerts.

## 12. Limitations

- Every alert goes to every channel its severity reaches; there is no routing by key.
- One row per key, no per-occurrence history: the list shows counts and the last details, not every event.
- No acknowledging or muting from the page; resolve from code, or let the flush job's summaries carry on.
- A message is rendered when it is delivered; a delivery held by quiet hours carries the counts of when it was
  produced.

## Build

`npm run build -w modules/alerts` runs `tsc -p tsconfig.build.json`. In this repository the export condition
`@softure-ai/source` points tests and type checks at `src/`. Releasing:
[scripts/release/README.md](../../scripts/release/README.md).
