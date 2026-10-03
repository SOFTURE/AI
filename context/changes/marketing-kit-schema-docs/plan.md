# Plan: marketing-kit-schema-docs

Input: change.md, research.md. Complexity: small.

## Goal
Every key a project writes in `marketing.json` has a `description` in `tools/marketing-kit/schema/marketing.schema.json`:
each `properties` entry anywhere in the file, and each record value (`social.platforms.<platform>`). A description says
what the key does and, when the default is not in the schema (a recorder default), what it defaults to. A test in
`tools/marketing-kit/tests/schema.test.ts` names every key that lacks one. Validation does not change.

**Out of scope:** new keys or new limits (FU-16, FU-18); rewriting the README reference tables; `title`/`examples`
annotations; publishing the package.

## Approach
**Starting point:** the JSON Schema is generated from the zod schema (`src/config/schema.ts:393-399`) and only
`relativePath` carries a `.describe()` (`schema.ts:42`); meaning lives in JSDoc comments and the README table
(research §Current state). zod 4.6.5 keeps descriptions through every wrapper used here (research §Answers).

**Chosen:** `.describe()` at every key of the zod schemas, the guard test first. The JSDoc comment that only
repeated the key's meaning becomes the description (one source of text); comments about implementation (why a
pattern, why a refinement) stay comments.
Rejected: post-processing the generated JSON with a key → text map in `write-schema.ts` - two sources that drift, and
the zod schema stays undocumented for code readers; `.meta({ description })` - same output, more noise, no gain.

**Key decisions:**
| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Where descriptions live | `.describe()` on the zod schema | the roadmap outcome names it; one source of truth | roadmap |
| What the guard checks | every `properties` entry and every object-valued `additionalProperties` (record values) | those are the keys a user types; array items and union branches are not keys | research |
| Shared constants (`id`, `nonEmpty`, locators) | neutral or no description on the constant, a specific `.describe()` at each key | avoids one key's text leaking to another | research §Risks |
| Lists of names (colour roles, role tokens, sfx events, platforms) | a `Record<Name, string>` of descriptions next to the shape builder | a missing entry is a type error | plan |
| Defaults in text | named only when the default is not a schema `default` (recorder defaults, `linkInBio`, fitted `focus.scale`) | editors already show a schema `default` | research §Answers |
| JSDoc that becomes a description | removed in the same edit | one text, not two | plan |
| README | one sentence: editors show each key's description | the table stays the overview | research §Open questions |
| Version bump | none | the package is `0.0.0`, never published (MK-8 publishes) | plan |

**Critical details:** `.describe()` returns a clone, so `const x = shared.describe(...)` never changes `shared`; a
description put on `relativePath` would appear at every path key that does not override it, which is why each path
key gets its own. Keep the wrapping order of `.default()`/`.prefault()`/`.optional()` as it is today: the probe shows
either order works, so there is no reason to move refinements or defaults. A `.describe()` on a `do` literal clones the
literal inside `z.discriminatedUnion`; `tests/actions-schema.test.ts` ("accepts every action with only its required
arguments", "names the allowed actions for an unknown one…") proves the union still discriminates.

## Phase 1: Guard test and descriptions for every key
**Discipline:** TDD. **Files:** `tools/marketing-kit/tests/schema.test.ts`, `tools/marketing-kit/src/config/schema.ts`,
`tools/marketing-kit/src/config/actions-schema.ts`, `tools/marketing-kit/src/og/templates/schemas.ts`,
`tools/marketing-kit/schema/marketing.schema.json`, `tools/marketing-kit/README.md`

1. `tests/schema.test.ts`: add a local `findUndescribedKeys(schema): string[]` that walks a JSON Schema (objects and
   arrays, recursively) and returns the path of every `properties` entry and every object `additionalProperties`
   without a non-blank `description`. Test it on a small inline schema first (a described key passes; a bare key, a
   bare key inside a `oneOf` branch, a bare record value and a blank description are each reported by path). Then a
   test "describes every key a project writes" expects `findUndescribedKeys` of the committed file to be `[]` (so a
   failure names the keys), and the root carries a `description`. Run it: it fails with the 277+ missing keys.
2. `src/config/schema.ts`: describe the root object and every key: top level (`$schema`, `brand`, `app`, `voice`,
   `videos`, `social`, `screenshots`, `ogImages`, `sfx`, `output`), `brand` and fonts, colour roles and role tokens
   (via `COLOR_ROLE_DESCRIPTIONS: Record<ColorRole, string>` used by both shape builders), `tokensFrom`, `app`,
   `device`, `voice`, the video keys (`voice` override, `persona`, `beats[]`, `hook`, `shots[]`, `screenGuard`,
   `endCard`, `sceneModule`), `social` (`linkTemplate`, `platforms` and its entry object with `code`, `linkInBio`
   naming the per-platform default, `posts[]`), `screenshots[]`, `ogImages[]` (`id`, `size`, `template`, `data`),
   `sfx` (via `SFX_DESCRIPTIONS: Record<SfxEvent, string>`) and `output`. JSDoc that only stated a key's meaning moves
   into its description.
3. `src/config/actions-schema.ts`: describe each `do` literal per branch (what the action does, its recorder defaults:
   `tap.after` 0.35 s, `type.perChar` 0.13 s, `bring.top` 140 px and `bring.seconds` 0.5 s, `wide.scale` 1 and
   `wide.whoosh` false, `focus.scale` fits the element), every argument, the locator options, and `regex`/`flags`.
4. `src/og/templates/schemas.ts`: describe every `data` key of both templates, the chart, its paths and tiles, with
   the length limits.
5. Regenerate with the `schema` script of the package (`tools/marketing-kit/package.json:45`) and commit the JSON.
6. `README.md` (configuration section, around line 66-69): say that editors show a description for every key.

**Tests:** the walker test (fails before, passes after); the root description; existing `schema.test.ts` drift test
(regenerated file matches); `config.test.ts`, `actions-schema.test.ts`, `og/*` unchanged and green (validation
unchanged).

**Done when:**
- Automated: `findUndescribedKeys` reports a bare key, a bare key in a `oneOf` branch, a bare record value and a blank description, and passes a described key.
- Automated: `tests/schema.test.ts` "describes every key a project writes" passes on the committed file.
- Automated: the committed `schema/marketing.schema.json` matches the zod schema (drift test green).
- Automated: the existing marketing-kit tests pass unchanged (no test file other than `schema.test.ts` edited).
- Automated: Gates green (typecheck, lint, test).
- Manual: owner reads a few descriptions in an editor hover and finds them clear.

## Risks and rollback
- A description is wrong or misleading → it is text only; fix forward. Mitigation: defaults in text are taken from
  the code lines in research.
- A `.describe()` changes validation → caught by the unchanged validation tests.
- Rollback: revert the phase commit; the generated file goes back with it.

## Decisions (auto)
- Complexity → small (one package, one pattern, no data).
- Guard scope → `properties` and object record values (research decision).
- Version bump → none (unpublished `0.0.0`).
- Implementation drift (small): a stale duplicate JSDoc line above `SELECTOR_PATTERN` (`schema.ts`) was removed with the
  comments that became descriptions; the root description sits after `.superRefine()` so the refined schema carries it;
  the fixture example in `family` names Inter, because `tests/architecture.test.ts` refuses FIRE's font names in `src/`.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Guard test and descriptions for every key

#### Automated
- [x] 1.1 `findUndescribedKeys` reports a bare key, a bare key in a `oneOf` branch, a bare record value and a blank description, and passes a described key
- [x] 1.2 `tests/schema.test.ts` "describes every key a project writes" passes on the committed file
- [x] 1.3 The committed `schema/marketing.schema.json` matches the zod schema
- [x] 1.4 The existing marketing-kit tests pass with no test file other than `schema.test.ts` edited
- [x] 1.5 Gates green (typecheck, lint, test)

#### Manual
- [ ] 1.6 Owner reads a few descriptions in an editor hover and finds them clear
