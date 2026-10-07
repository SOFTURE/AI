# Plan: mailing-dns-expectations

Input: change.md (research and framing skipped, reasons there). Complexity: small (two phases).

## Today (master `98c8113`)

- `checkDmarc` (`src/server/dns.ts`) passes any policy other than `none` and ignores `adkim`, `aspf`, `sp` (for the
  domain's own record) and `pct`. No option can require more.
- `checkSenderDns` reads TXT records only (`resolveTxt`); nothing looks at MX or CNAME records.
- `mailingOptionsSchema.replyTo` may sit on another domain; neither the function nor `softure-mail dns` looks at it.
- `softure-mail dns` prints SPF, DKIM, DMARC lines and exits 1 on any `fail`.

## Goal

`@softure-ai/mailing` 0.1.8 with all three points.

**Out of scope:** checking that the provider signs with the published key, live DNS in tests, implicit MX (an A record
without MX: forwarding services always publish MX, and the issue asks for MX).

## Key decisions

- **Minimum, not exact record** (point 1): `expectDmarc: { policy?, subdomainPolicy?, adkim?, aspf? }`. A minimum
  catches every loosening the issue names and lets a stricter record through (an exact string would fail on tag order
  or an added `rua=`). Policy ranks `none < quarantine < reject` (an unknown value counts as `none`); alignment ranks
  `r < s`, absent = `r`. The effective policy is `p` for the domain's own record and `sp ?? p` for an inherited one;
  `subdomainPolicy` checks `sp ?? p`. When `policy` is required, `pct` under 100 is weak too (`p=reject; pct=0`
  protects nothing). Unmet → `fail`, finding `weak`, record shown. With no `expectDmarc`, behaviour is unchanged.
- **Reply path** (point 2): `replyTo?: string` (an address, a mailbox or a bare domain). Report key `replyTo:
  DnsCheck | null` (null when not asked). MX lookup on the domain: records → `pass found` (record lists `priority
  exchange` by priority); only `0 .` → `fail null-mx`; none → `fail missing`; error → `fail lookup-failed`. Then SPF
  records on that domain: more than one → `fail multiple` (permerror breaks bounces back to the reply domain).
- **Return path** (point 3): `returnPath?: readonly { host: string; targetDomain?: string }[]`. Report key
  `returnPath: readonly DnsCheck[]` (empty when not asked). Per host: a CNAME → `pass found` (record = target),
  unless `targetDomain` is set and the target is neither that domain nor under it → `fail unexpected-target`; no
  CNAME → MX records → `pass found` (Resend's older MX-based setup); neither → `fail missing`; error → `fail
  lookup-failed`. `resendReturnPath(domain)` returns `send.` and `rsend.` with `targetDomain: "rmta.net"`.
  Kept out of the `resend()` adapter: older Resend domains have no `rsend` record, so a default would turn them red.
- **Resolvers**: options `resolveMx` and `resolveCname` beside `resolveTxt`, defaults from `node:dns/promises`; the
  same three on `RunMailCliOptions`. New findings: `weak`, `null-mx`, `unexpected-target`.
- **CLI**: `--dmarc-policy`, `--dmarc-sp`, `--dmarc-adkim`, `--dmarc-aspf`, `--reply-to <address>`, `--return-path
  <host>` (repeatable, presence only), `--resend-return-path` (Resend's pair with their target check). Without
  `--domain`, the configured `replyTo` is checked. Lines `REPLY` and `PATH`; the summary names what fails (auth vs.
  replies vs. bounces). Values are validated: a bad policy or alignment is a usage error.
- **Versions**: mailing 0.1.8 (package.json, module.json, manifest, CHANGELOG).

## Phase 1: checkSenderDns (TDD)

`src/server/dns.ts`, `src/server/index.ts` exports.

- `tests/dns.test.ts`: required policy (reject vs quarantine, own vs inherited, `sp`), alignment (`adkim=r`,
  absent tag), `pct`, a stricter record passes, no expectation = old behaviour; reply path (found, null MX, missing,
  multiple SPF, lookup error, address/mailbox/domain input); return path (CNAME, expected target, look-alike target,
  trailing dot, MX fallback, missing, error), `resendReturnPath`.

Done when: tests seen red, then green.

## Phase 2: command and docs

- `src/cli/run.ts`, `tests/cli.test.ts`: new flags, configured reply-to, output lines, usage errors.
- README, CHANGELOG, versions.

Done when: `npm run typecheck`, `lint`, `test`, `build` green.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: checkSenderDns

- [ ] DMARC expectations
- [ ] reply path
- [ ] return path

### Phase 2: command and docs

- [ ] CLI flags and output
- [ ] README, CHANGELOG, version 0.1.8
