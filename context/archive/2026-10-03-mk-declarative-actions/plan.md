# Plan: mk-declarative-actions

Input: change.md, research.md, frame.md. Complexity: medium (3 phases; one contract section and one interpreter).

## Goal

- A video in `marketing.json` either names a `sceneModule` (unchanged) or gives every beat after the
  opening an `actions` list (and an optional `pad`). The loaded config tells the two apart.
- Each action is `{ "do": "<director method>", …arguments }` for the 13 Director actions; targets are
  locator descriptors, and `focus` and `mark` also take an array (the union rectangle).
- Mistakes a config can show without a browser are refused at load time by JSON path: an unknown action
  or key, a descriptor with two kinds, an invalid regex, an `until` word the sentence does not say, a
  hook still or mark no action saves, no `checkScreen`, actions mixed with `sceneModule`.
- While recording, an action that fails names its JSON path (`videos[0].beats[2].actions[4]`) and the
  config file; the screen guard keeps its exit code 2.
- The fixture film's JSON twin records the same `log.json` as the TS film (opt-in render test), and
  FIRE's film in JSON makes the same Director calls as its TS scene (scratch check, recorded in the
  implementation review).

**Out of scope:** conditional or repeated actions; mixing a module and actions in one video; changes
to the Director's behaviour; FIRE's own migration to JSON (FIRE's roadmap); `src/compose/`,
`src/render/`, `src/voice/`, `src/screenshot/` (MK-6, MK-7, MK-4).

## Approach

**Starting point:** scenes are TS modules only (`src/cli/films.ts:21-29`); beats are `{ id, text }`
(`src/config/schema.ts:203`).

**Chosen:** the schema gains the action and descriptor shapes and the static checks; `config.ts`
resolves a `sceneSource` union (`module` with a path, or `actions` with beats); `src/record/actions.ts`
turns descriptors into locators and actions into Director calls, wrapping each call so a failure names
its JSON path; `loadFilm` builds the scene from either source (frame.md, option B).
Rejected: raw Playwright selector strings (no validation, a second syntax to learn); conditions and
variables in JSON (`sceneModule` covers logic).

**Key decisions:**
| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Action shape | discriminated union on `do`; strict objects; argument names follow the Director's options (`after`, `perChar`, `scale`, `height`, `whoosh`, `top`, `seconds`) | 1:1 with the Director; zod names the allowed `do` values in its error | research |
| Arguments | `wide {scale?, whoosh?}`, `tap {target, after?}`, `type {text, perChar?}`, `fill {input, value}`, `blur {}`, `focus {target, scale?, height?}`, `bring {target, top?, seconds?}`, `mark {name, target}`, `still {name}`, `cue {name}`, `hold {seconds}`, `until {word}`, `checkScreen {}` | the Director's signatures (`src/film.ts:93-125`); `fill.input` is the `name` of the input, as docs/03 sketched | research |
| Ranges | scale 0.5-4, after/seconds/perChar 0-10, hold 0-30 s, height 1-4000 px, top -4000-4000 px | wide enough for FIRE (scale 1.75, hold 1.4, top 320), narrow enough to catch a unit slip (ms for s) | research |
| `fill.input` | a CSS identifier (`^[A-Za-z_][A-Za-z0-9_-]*$`) | the Director builds `input[name=…]` unquoted (`record.ts:283`) | research |
| Descriptor | one strict object: exactly one of `role`, `text`, `label`, `testId`, `css`; `name` only with `role`; `hasText` only with `css`; `exact` only with a string `name`/`text`/`label`; `nth` (integer ≥ 0) with any; transformed into a discriminated union after validation | a plain zod union reports "Invalid input" without the key (research, scratch run); one object gives an error per key | research |
| Text match | a non-empty string (Playwright's substring, case-insensitive; `exact: true` for whole and case-sensitive) or `{ "regex": "…", "flags": "i" }`, flags from `imsu`, the source must compile | FIRE uses both (research table) | research |
| Roles | `ARIA_ROLES`: Playwright's `getByRole` list; a type test ties it to Playwright's parameter type | a typo (`buton`) is caught at load time | research |
| Without `nth` | Playwright's strict mode: a locator matching two elements fails with its JSON path | ambiguity is a scene bug, not something to pick silently | plan |
| Mode | `sceneModule` optional; without it every beat but the first needs `actions`; with it, no beat may have `actions` or `pad`; the first beat never has either | one scene per video; the first sentence plays over the opening still (`src/film.ts:72-76`) | frame |
| Static checks | `until.word` is a word of its beat (same punctuation strip as the Director); `hook.still` is saved by a `still` action; each `hook.shots[].mark` by a `mark` action; at least one `checkScreen` | the recording checks these only at its end (`record.ts:344-355`); paths make them actionable | research |
| Loaded scene | `VideoConfig.sceneSource: { kind: "module", path } \| { kind: "actions", beats: { id, pad, actions, index }[] }` | a discriminated union, not optional fields (AGENTS.md) | plan |
| Interpreter | `src/record/actions.ts`: `getLocator(page, descriptor)`, `runAction(director, action)`, `createActionScene(beats, videoIndex)` | owned folder (`src/record/`) | change.md |
| Union errors | `formatIssues` input goes through `expandUnionIssues`: an `invalid_union` whose branches all but one fail on the input's type is replaced by that branch's issues, with their full paths | zod 4 reports "Invalid input" at the union for a descriptor with a wrong key (plan review W1) | plan review |
| Runtime errors | each action call is wrapped: `videos[i].beats[b].actions[a] (do): <message>`; a `ScreenGuardError` is rethrown as a `ScreenGuardError`; `filmPath` for an action scene is the config file | answers unknown 2; exit code 2 stays (`main.ts:66-68`) | research |
| Baseline | fixture: a JSON twin `fixture-tour-actions` (same sentences, so the same voiceover key) recorded next to `fixture-tour` in the render test, logs compared field by field except `voiceoverKey`; FIRE: the TS scene and the JSON scene run against a fake page and Director, traces compared | the recorder is deterministic for equal calls (research); FIRE's app needs Docker Postgres | research |

**Critical details:** the JSON Schema for `target` must accept both one descriptor and an array; the
fixture TS film's recording must not change (the TS path is untouched apart from `filmPath`).

## Phase 1: The contract

**Discipline:** TDD. **Files:** `src/config/schema.ts`, `src/config/actions-schema.ts` (new), `src/config/issues.ts`,
`src/config/config.ts`, `src/cli/films.ts`, `src/cli/main.ts` (`filmPath`), `schema/marketing.schema.json`,
`tests/config.test.ts`, `tests/actions-schema.test.ts` (new).

1. `actions-schema.ts`: `ARIA_ROLES`, `textMatchSchema`, `locatorSchema` (validated object → union),
   `targetSchema`, `actionSchema`; exported types `TextMatch`, `LocatorDescriptor`, `SceneAction`.
2. `src/config/issues.ts`: `expandUnionIssues(issues)`, used by `loadMarketingConfig` (plan review W1).
3. `schema.ts`: beats gain `pad?` and `actions?`; `sceneModule` optional; the mode and static checks in
   the video's `superRefine`, each with its path.
4. `config.ts`: `sceneSource` replaces `sceneModule`; `findMissingFiles` checks the module only for
   `kind: "module"`.
5. `films.ts`/`main.ts`: compile against `sceneSource` (an action scene arrives in phase 2).
6. Regenerate the JSON Schema.

**Tests:** every action parses with its defaults absent; an unknown `do` names the allowed values; an
unknown key on an action and on a descriptor; a descriptor with no kind and with two kinds; `name`
without `role`, `hasText` without `css`, `exact` with a regex; a role outside the list; a regex that does
not compile; flags outside `imsu`; `fill.input` with a quote; a target array that is empty; an `until`
word outside the sentence; actions on the first beat; a scene beat without actions and no module;
actions next to a `sceneModule`; `pad` next to a `sceneModule`; a hook still and a hook mark no action
saves; no `checkScreen`; the loaded `sceneSource` for both kinds; the JSON Schema accepts a target as one
descriptor and as an array; a descriptor with a misspelt key inside a one-or-many target is reported at
the key, not as "Invalid input".

**Done when:**
- Automated: the tests above pass; gates green (typecheck, lint, test).

## Phase 2: The interpreter

**Discipline:** TDD. **Files:** `src/record/actions.ts` (new), `src/cli/films.ts`, `src/film.ts`
(comment, types re-exported), `src/index.ts`, `tests/actions.test.ts` (new).

1. `getLocator(page, descriptor)`: `getByRole(role, { name, exact })`, `getByText(text, { exact })`,
   `getByLabel(label, { exact })`, `getByTestId(id)`, `locator(css, { hasText })`, then `.nth(n)` when given;
   regex matches become `RegExp`.
2. `runAction(director, page, action)`: one `switch` on `do`, exhaustive.
3. `createActionScene(beats, videoIndex): Scene`: `director.beat(id, run, { pad })` per beat; each action
   wrapped as in Key decisions.
4. `loadFilm`: an `actions` source builds the scene without importing anything; `filmPath` is the config file.

**Tests:** each descriptor shape builds the expected locator calls on a fake page; `nth`; regex flags;
each action calls the Director with the expected arguments; an array target becomes an array of
locators; a failing action names `videos[0].beats[1].actions[2] (tap)`; a `ScreenGuardError` stays one;
the fixture's TS scene and its JSON twin make the same Director calls.

**Done when:**
- Automated: the tests above pass; gates green (typecheck, lint, test, build).

## Phase 3: Fixture, baseline and docs

**Discipline:** test-after. **Files:** `examples/fixture/marketing.json`, `tests/render.test.ts`,
`README.md`, `docs/03-marketing-kit.md`.

1. The fixture gains `fixture-tour-actions`, the JSON twin of `films/fixture-tour.ts`.
2. The render test also records the twin and compares the two `log.json` files.
3. FIRE's film translated to JSON in the scratchpad (Polish copy stays out of the repository) and its
   trace compared with the TS scene's against the read-only clone; the result goes into the review.
4. README: the actions reference, descriptors (with `nth` for a locator that matches several elements),
   static checks, the runtime error format, when to use `sceneModule`. docs/03: the sketch points at the reference.

**Done when:**
- Automated: the opt-in render test passes locally with equal logs; gates green (typecheck, lint, test, build).
- Manual: the FIRE trace comparison reports equal traces (69 actions, 8 beats).

## Risks and rollback

- A descriptor quirk changes which element a locator finds → the trace test compares the exact
  Playwright calls, and the fixture logs are compared in a real browser.
- Parallel items edit `schema.ts`, `config.ts` and the fixture → merge master before the PR and again
  before merging; regenerate the JSON Schema after each merge.
- Rollback: revert the phase commits; videos with `sceneModule` work as before throughout.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: The contract

#### Automated
- [x] 1.1 Action schema and config tests pass — 4cbe3e5
- [x] 1.2 Gates green (typecheck, lint, test) — 4cbe3e5

### Phase 2: The interpreter

#### Automated
- [x] 2.1 Interpreter tests pass, including the fixture trace — 4cbe3e5
- [x] 2.2 Gates green (typecheck, lint, test, build) — 4cbe3e5

### Phase 3: Fixture, baseline and docs

#### Automated
- [x] 3.1 The opt-in render test passes with equal logs — 4cbe3e5
- [x] 3.2 Gates green (typecheck, lint, test, build) — 4cbe3e5

#### Manual
- [x] 3.3 FIRE's JSON scene makes the same Director calls as its TS scene — 4cbe3e5
