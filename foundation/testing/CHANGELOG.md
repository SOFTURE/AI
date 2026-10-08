# Changelog

Newest first. Each version lists what changed for an app that uses `@softure-ai/testing`. When an app has run a version in
production, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done"). Versions before the first one below are described in their GitHub Releases (`testing@x.y.z`).

## 0.1.3

- The `vitest-setup` file pins the process to a time zone with a negative offset (`America/New_York`), so code that
  forgets an explicit `timeZone` gets a wrong date instead of passing in UTC or the machine's zone. `TEST_TZ` picks
  another zone; an unknown name fails the run. A behaviour change for apps that list the setup file: tests that
  relied on the machine's zone now run in New York (#251).
- `pinTestTimeZone(timeZone?)` for the top of `vitest.config.*`: pins the zone in the main process, so it holds in
  the `threads` and `vmThreads` pools too, where the setup file cannot switch zones and now fails with a message
  naming this fix. Also exported: `pinTimeZone`, `readTestTimeZone`, `DEFAULT_TEST_TIME_ZONE` (#251).

- `registerAccount` ticks the consent box with the new `tickCheckbox`, so a form whose native checkbox is visually
  hidden under a custom box (`sr-only`, `opacity-0`) registers instead of stopping on "intercepts pointer events"
  (#245).
- `tickCheckbox(checkbox, { timeout? })` exported from `@softure-ai/testing/playwright` for an app's own forms: ticks
  the box, leaves a ticked one ticked, fails on a disabled one.

## 0.1.2

- README: `setupFiles` takes the bare specifier `@softure-ai/testing/vitest-setup`.
