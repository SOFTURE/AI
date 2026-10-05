# Plan review: testing-clock-shift

Date: 2026-10-05 · Verdict: approved

- The roadmap's unknown (fake timers in the same file) is answered by a measurement, not assumed; the
  plan turns the measurement into two tests so a Vitest upgrade that changes it is caught.
- Copying a mechanism FIRE runs today is the right base; the three fixes (calendar check, idempotent
  shift with a restore, `Date.name`) are each what a shared package needs and FIRE's single file did not.
- Throwing on a malformed `TEST_TODAY` is correct even under the "errors as values" rule: it is a
  configuration bug, and continuing on the real date would make a green run mean nothing.
- `setupFiles` takes paths (measured), so the README must show the one-line app file; the plan has it.
- Not wiring the root config is a deliberate scope cut, stated in research; acceptable for DP-6.
- Risk: code that captured `Date` before the setup keeps the real clock; documented as a limitation.
