# Research: security-alerts-hono-codeql-80

- `npm ls hono @hono/node-server --all` on master `9efd0cb`: only `hyperframes@0.9.20` (via marketing-kit) pulls them;
  `hyperframes/package.json` declares `hono ^4.0.0`, `@hono/node-server ^2.0.5`. `npm update hono @hono/node-server`
  takes 4.13.18 and 2.1.8, both past the first patched versions (4.13.16, 2.1.6); `npm audit` then reports 0.
- `examples/next-app/package-lock.json` has no `hono` entry.
- `overlay-html.ts:197` builds a GSAP call as a string; `turns` comes from `getDropLetterTurns` (numbers rounded by
  `r3`). `JSON.stringify` of a number array prints the same text as joining `String(n)`, so a number-only literal keeps
  the output byte for byte (`overlay-text-cards.test.ts:354,372` assert it exactly) and gives CodeQL no string flow.
- Unreleased published changes on master (tag vs HEAD, dependencies or non-test sources): agent-ready, alerts,
  analytics, auth, connections, feature-switches, mailing, ops, privacy, seo, waitlist, host, theme-flat-atlas. A patch
  keeps every `^0.x.y` range of their dependents valid.
