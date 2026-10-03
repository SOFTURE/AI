# Plan: analytics-channel-tags

Input: change.md, research.md. Complexity: small (2 phases). Risk: low.

## Goal

- `analytics({ channel: { param, pattern, maxLength } })`, no `dbSchema`, no migration.
- `/server`: `parseChannel`, `readChannel(config, { url, referer })`, `withChannel(url, channel, config)`.
- `/proxy`: `createChannelTagger(config)` → `{ carry(request, response), tag(request) }`.
- `/next`: `getChannel()`, `getChannelFromSearchParams()`, `attributeRegistration(handler)`.
- Example: `proxy.ts` composition, the sign-up channel on `/account`, `e2e/analytics-channel.spec.ts`.

## Approach

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Storage | none; URL and Referer only | cookieless, no PII | research 1 |
| Propagation | 307 on navigations from a tagged same-origin page | the tag stays visible and survives the next hop | research 1 |
| Guard order | guard first, `carry` its redirect, then `tag` | the piece knows nothing of auth | research 2 |
| Hook | structural type, lazy `next/headers` | no auth dependency; config loads in Node | research 3 |

## Phase 1: Module

**Discipline:** TDD.

- Options, parsing, URL helpers, proxy piece, Next adapter, manifest and `module.json`, README.
- Tests: options, parsing, propagation and carry (navigation kinds, origins, invalid values,
  existing tags), Next adapter with mocked headers, module manifest.

## Phase 2: Example app, e2e, docs

- `proxy.ts`, config hook, account page line, `e2e/analytics-channel.spec.ts`; docs listing modules.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Module

#### Automated
- [x] 1.1 Parsing, propagation, carry and adapter tests pass — 69b995d
- [x] 1.2 Module test passes; `module.json` equals the manifest — 69b995d
- [x] 1.3 Gates green (typecheck, lint, test) — 69b995d

### Phase 2: Example app, e2e, docs

#### Automated
- [x] 2.1 e2e `analytics-channel.spec.ts` passes with the rest of the suite — 69b995d
- [x] 2.2 Gates green (typecheck, lint, test, build) — 69b995d
