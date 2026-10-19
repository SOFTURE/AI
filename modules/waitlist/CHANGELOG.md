# Changelog

Newest first. Each version lists what changed for an app that uses `@softure-ai/waitlist`. When an app has run a version in
production, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done"). Versions before the first one below are described in their GitHub Releases (`waitlist@x.y.z`).

## Unreleased

- `WaitlistForm` takes the app's look and ids for its fields and button (#593): `emailProps` (`id`, `placeholder`),
  `fieldClassNames`, `fieldHintAs` and `fieldHintProps` for the email field; `scopeClassNames` for every consent box;
  `WaitlistFormScope.description` (a line under the statement) and `inputId` (the box's id); `submitVariant`,
  `submitFullWidth` (default `true`) and the `submit` slot in `classNames` for the button. `<Waitlist />` passes them
  through, with `consentDescriptions` and `consentIds` per scope id. `WaitlistEmailProps` is exported from `/ui`.
  Without the new props the markup is unchanged. Migrate (optional): an app that kept its own form because its look
  differed renders `WaitlistForm` (or `<Waitlist />`) with its button width and variant (`submitFullWidth={false}`,
  `submitVariant`, `classNames.submit`), its label class (`fieldClassNames.label`), its placeholder and field id
  (`emailProps={{ id: "field-email", placeholder }}`), and per scope its sentence and id (`description`, `inputId`, or
  `consentDescriptions` and `consentIds`); then it removes its own form and its state handling (README, "Appearance").

## 0.4.0

- `WaitlistForm` takes the app's own success view and a callback (#579): `success` (a node or `(state) =>
  ReactNode`) is shown in place of the default notice and unsubscribe link once the sign-up counts (`ok`) or waits
  for its link (`confirmation_sent`); `onSuccess(state)` is called once per sign-up, after that view is on the page.
  `WaitlistFormSuccessState` (the root entry) types both. `<Waitlist />` takes `success` as a node. Without the new
  props nothing changes. Migrate (optional): an app that kept its own form only to show a confirmation card renders
  `WaitlistForm` from a client component with `action={joinWaitlistAction}`, `success={<Card />}` and, to move
  focus, `onSuccess={() => cardRef.current?.focus()}` (README, "An app that composes its own form"); then it removes
  its own form and its state handling. A card that should keep the unsubscribe link reads `state.unsubscribeUrl` in
  the function form.
- A rate-limited join tells the person when to try again (#580): `joinWaitlistAction` now answers
  `{ status: "error", error: "security.rate_limited", retryAfterSeconds, email, scopes }`, with the limiter's whole
  seconds (at least 1) for either bucket (`waitlist` per client, `waitlist-email` per address). `WaitlistFormState`
  gains the optional `retryAfterSeconds`, set only with that error; other states are unchanged. `WaitlistForm` shows
  the new copy `form.retryAfter` ("Too many attempts. Try again in {minutes} min.", minutes rounded up, at least 1)
  and keeps `errors.security.rate_limited` when the state has no value. Migrate (optional): an app that kept its own
  join action only to carry the wait switches to `<Waitlist />` or `joinWaitlistAction` and removes its own action
  and its own rate limit call; an app that renders the state itself reads `state.retryAfterSeconds`. An app with its
  own translation adds `form.retryAfter` to it (`waitlist({ messages: { <locale>: { form: { retryAfter: "…{minutes}…"
  } } } })`), or the English text shows for a refusal that carries the wait.

## 0.3.1

- A form without a required consent is refused before its address is read (#557): `joinWaitlist` and
  `joinWaitlistAction` now check the scopes in front of the address, so a missing required scope answers
  `waitlist.consent_required` (`field: "consent"`) even when the address is malformed. As before, the refusal spends
  one attempt of the client's `waitlist` bucket and none of the address's `waitlist-email` bucket, and it writes,
  looks up and mails nothing. Declaring the consent is the existing `waitlist({ scopes: [{ id, required: true, label
  }] })`; `WaitlistForm` renders it as a required checkbox, with a `ReactNode` label through `<Waitlist
  consentLabels={{ [id]: <>…</> }} />` or `WaitlistFormScope.label`. Migrate (optional): an app that kept its own
  join action only to gate the consent declares that consent as a required scope and switches to `<Waitlist />` or
  `joinWaitlistAction`, then removes its own action and its own rate limit call. Apps without a required scope: an
  empty form with a malformed address now answers `waitlist.consent_required` instead of `waitlist.email_invalid`;
  nothing else changes.

## 0.3.0

- The double opt-in confirmation mail can leave from a background job with retry (#494):
  `waitlist({ doubleOptIn: true, confirmationMail: { enqueue: enqueueConfirmationMail } })` from the new entry
  `@softure-ai/waitlist/jobs`, with `@softure-ai/jobs` as an optional peer dependency (`^0.1.1`). The join then
  enqueues `{ signupId }` on the `waitlist.confirmation-mail` queue in its own transaction and answers without
  sending; the handler mails a fresh link (a new token, the request's expiry) and retries a provider outage, a spent
  quota or a refused account. `PendingSignup.isMailQueued` says the job sends it; `sendConfirmationMail(ctx,
  signupId)` is the handler's work for an app's own worker. Without `confirmationMail.enqueue` nothing changes.
  Migrate (optional): install `@softure-ai/jobs`, add `jobs({ queues: { "waitlist.confirmation-mail": {} } })` to
  `softure.config.ts`, pass `confirmationMail: { enqueue: enqueueConfirmationMail }`, and spread
  `confirmationMailJobHandlers` into the worker's `handlers`. An app whose `rewriteConfirmationLink` reads request scope
  (cookies, headers) keeps the default path.

## 0.2.1

- `@softure-ai/waitlist/jobs` (#491): `waitlistJobHandlers` and `waitlistJobSchedules` run
  `pruneUnconfirmedSignups` hourly as a `@softure-ai/jobs` schedule; `@softure-ai/jobs` (^0.1.1) is a new optional peer.
  Migrate (optional): an app with `@softure-ai/jobs` adds `...waitlistJobSchedules` to `jobs({ schedules })` and
  `...waitlistJobHandlers` to its worker's handlers, then removes its own cron. Without jobs nothing changes.

## 0.2.0

- **Breaking (#446):** the built-in `pl` dictionary is gone; English is the only built-in copy and the fallback for
  every other locale, which is now any BCP 47 tag. Migrate: an app that shows Polish keeps its own translation and
  passes it as the overrides for its locale, `waitlist({ messages: { pl: myTranslation } })`; a key it leaves out
  reads English. Scope labels take any locale key; a sign-up's stored locale is used for its mails when the module has
  copy in it (English or the app's translation), else the app's locale.

## 0.1.11

- The `@softure-ai/ui` peer range also accepts 0.2.0.

## 0.1.10

- `countSignupsByChannel(ctx, { splitSuppressed: true })` adds `active` and `suppressed` per channel: a
  confirmed sign-up whose address is on mailing's suppression list counts as `suppressed`
  (`SuppressedSplitChannelCount`). An app no longer reads `mailing.suppressions` and hashes addresses itself
  for a go/no-go report (#324). Needs `@softure-ai/mailing` 0.1.12.
- `WAITLIST_RATE_LIMIT_BUCKETS` declares `key: "ip"` on `waitlist` and `key: "subject"` on `waitlist-email`
  (security 0.1.8 bucket kinds).
- Requires `@softure-ai/security` `^0.1.8`: earlier versions refuse the `key` field.

## 0.1.9

- **Security: the join action no longer hands out another person's unsubscribe link** (#306). With
  `unsubscribeLinkOnSuccess`, `unsubscribeUrl` was returned for every answer without double opt-in, including an
  address already on the list and a suppressed one, so anyone could type someone else's address into the form and
  receive their signed link. Now only the request that created the sign-up (`status: "joined"`, `isNew: true`) gets
  it; a known and a suppressed address are answered alike, `{ status: "ok" }` without a link. An app that kept its own
  join action to give the link only for `isNew` can go back to the module's.

## 0.1.8

- **A sign-up without double opt-in no longer undoes an opt-out** (#237). `joinWaitlist` of an address on mailing's
  suppression list (any source) writes nothing, records no consent, calls no `onJoined` and returns the new outcome
  `Ok<{ status: "suppressed" }>` (type `SuppressedSignup`). Before, it lifted the person's own `page`/`one-click`
  opt-out for whoever typed the address into the form. The join action answers it exactly like a sign-up that
  counted (`status: "ok"`, with `unsubscribeUrl` when enabled) and sends no mail, so the form does not reveal who
  unsubscribed. With double opt-in nothing changes: `confirmSignup` lifts the opt-out when the link is used. An app
  that checked `isSuppressed` before `joinWaitlist` can drop that check; code that switches on `status` handles the
  new case.

## 0.1.7

- **Moving an existing list**: `importSignups(ctx, rows)` (`/server`) and the `import-signups` ops script
  (`/scripts`, `createImportSignupsScript(config, { scopeAliases })`) import the list an app kept before: the original
  sign-up time and id, placement, locale and channel, a consent per scope at its historical time and document version
  (privacy's `importConsent`), and, for who unsubscribed, the withdrawals at that time and an opt-out their next
  sign-up lifts. Checked whole before writing, one transaction, idempotent, never narrows scopes. New dependency:
  `@softure-ai/ops` (an optional module in `dependsOn`); `@softure-ai/privacy` `^0.1.8`.
- `getSignupById(ctx, id)`, for mailing's `legacyUnsubscribe.verify` when old links carry the row id.
- **Channel per sign-up**: migration `0003_add_channel.sql` adds `waitlist.signups.channel`; option `resolveChannel`
  fills it from the request (e.g. analytics' `getChannel`), `joinWaitlist` takes `channel`, `WaitlistSignup.channel`,
  `listSignups({ channel })`, `countSignupsByChannel(ctx)` and the privacy export carry it.
- **Unsubscribe link after sign-up**: option `unsubscribeLinkOnSuccess` (off by default) returns the person's own
  unsubscribe link as `unsubscribeUrl` with `status: "ok"`; `WaitlistForm` shows it (slot `unsubscribe`, copy
  `form.unsubscribeHint` and `form.unsubscribeLink`). The first sign-up refuses the option without
  `MAILING_UNSUBSCRIBE_SECRET`.

## 0.1.6

- `module.json` names `auth` as a required dependency (the privacy contributor reads `auth.users`).
- Adapters use the configured database handle; `@softure-ai/ui` is a peer dependency.
