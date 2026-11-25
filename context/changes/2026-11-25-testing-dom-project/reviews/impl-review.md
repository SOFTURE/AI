# Implementation review: testing-dom-project

Verdict: approve. Matches the plan: `dom: true` adds two inline projects that extend the app's config, `node`
excluding `*.dom.test.*` and `dom` narrowed to `*.dom.test.*` with the extension-anchored extglob, happy-dom and the
DOM setup file; without `dom` the config is unchanged (pinned by a test). The Vitest run of a scratch app proves the
issue's acceptance (Enter opens, arrows move, Escape closes and returns focus) and that each file runs once in the
right project; emptying the setup file makes the clean-document test fail, so the cleanup is load-bearing. The test
app lives outside the package because inside it Node resolves `@softure-ai/testing` to the package itself; the
published path (bare names to `dist/`) was checked by hand with a built package. Optional peers keep apps without
DOM tests unchanged; README (DOM tests, API, Limitations) and CHANGELOG `Unreleased` say the same. No findings.
