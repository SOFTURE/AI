# Plan: blog-canonical-host-links

Input: change.md. Complexity: small.

## Goal
An absolute body link to the site's canonical origin (core's `getSiteUrls(config).origin`, seo's when listed) is
the site's own in both places that decide it: the renderer adds no `rel="noopener noreferrer"`/`target` to it and
the quality gate counts it as an internal link. Without seo nothing changes (the origin is `appOrigin`).

**Out of scope:** what URLs the pages declare (BF-7, done); the `siteHosts` and `ownOrigins` options themselves.

## Approach
**Starting point:** `pages/body.ts` takes `origin: string` (`config.appOrigin` from `next/pages.tsx`
`getBodyOptions`) and puts its host first in `siteHosts`; `quality/settings.ts` `resolveQualitySettings` takes
`Pick<SoftureConfig, "appOrigin" | "timezone">` and builds `ownOrigins` from `appOrigin` and the option.

**Chosen:** the callers that hold the config pass the site origin too.
- `RenderPageBodyOptions.origin: string` becomes `origins: readonly string[]` (the app's own origins); every
  origin's host is a site host. `getBodyOptions` passes `[config.appOrigin, getSiteUrls(config).origin]`.
- `resolveQualitySettings`'s second input gains an optional `siteOrigin` (`{ appOrigin, siteOrigin?, timezone }`),
  added to the own origins and deduplicated as today. `server/options.ts` `getQualitySettings` passes
  `getSiteUrls(config).origin`.
Rejected: calling `getSiteUrls` inside `resolveQualitySettings` (it would need the whole config, and the gate's
tests build settings from two fields); keeping `origin` and adding `siteOrigin` to the body options (two fields
for one list).

**Critical details:** `renderPageBody` and `RenderPageBodyOptions` are exported from `@softure-ai/blog/pages`; the
rename is a breaking change of an unpublished package (first release is BL-8). The architecture test keeps
`src/next/` and `src/pages/` free of seo: `getSiteUrls` comes from `@softure-ai/core`.

## Phase 1: Both host lists take the site origin
**Discipline:** TDD. **Files:** `modules/blog/src/pages/body.ts`, `src/next/pages.tsx`, `src/quality/settings.ts`,
`src/server/options.ts`, `modules/blog/tests/next/pages.test.tsx`, `tests/quality/settings.test.ts`, any test that
builds `RenderPageBodyOptions`, `modules/blog/README.md` (Limitations line on BF-11 removed, the own-host and
`ownOrigins` docs updated), `context/foundation/roadmap.md`.

1. Tests (red first): under the existing "blog pages under seo's canonical rule" suite (canonical host
   `example.org`, `appOrigin` `app.example.com`), an article whose body links `https://example.org/...` renders
   that link without `rel`/`target`, and a link to `appOrigin` stays internal. A gate test: settings resolved
   through `getQualitySettings` of a config with that seo, a body link to `https://example.org/blog/...` is not
   reported as external (and an unrelated host still is); `resolveQualitySettings` with `siteOrigin` lists it
   once among `ownOrigins`.
2. `pages/body.ts`: `origins`; `next/pages.tsx`: pass both origins.
3. `quality/settings.ts`: `siteOrigin`; `server/options.ts`: pass `getSiteUrls(config).origin`.
4. README: the Limitations bullet goes; the docs of `siteHosts` and `quality.ownOrigins` say the canonical
   origin is already included.

**Tests:** steps 1; the existing renderer, gate and pages tests unchanged except the body options' shape.

**Done when:**
- Automated: a body link to seo's canonical host renders as internal on the blog pages, and `appOrigin` still does.
- Automated: the gate counts a link to seo's canonical origin as internal through `getQualitySettings`.
- Automated: Gates green (typecheck, lint, test, build).

## Risks and rollback
- An app had listed the canonical host in `siteHosts`/`ownOrigins` by hand: duplicates are harmless (hosts are
  matched with `some`, origins deduplicated).
- Rollback: revert the phase commit; the lists go back to `appOrigin` plus the options.

## Decisions (auto)
- Complexity → small (one phase, two lists).
- `origins` (a list) over `origin` + `siteOrigin` on the body options.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Both host lists take the site origin

#### Automated
- [ ] 1.1 a body link to seo's canonical host renders as internal on the blog pages, and `appOrigin` still does
- [ ] 1.2 the gate counts a link to seo's canonical origin as internal through `getQualitySettings`
- [ ] 1.3 Gates green (typecheck, lint, test, build)
