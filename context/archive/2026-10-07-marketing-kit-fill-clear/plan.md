# Plan: marketing-kit-fill-clear

Input: change.md, research.md. Complexity: small (one phase).

## Goal

`@softure-ai/marketing-kit` 0.1.9: `fill` replaces a prefilled value (select all, Backspace, then the typed value,
every key logged and held), `fill` with `clear: false` appends as before, and a `press` action presses a key one or
more times. A film over empty fields records exactly as in 0.1.8.

**Out of scope:** FIRE_TRACKER's adoption; `textarea` or contenteditable fields; a literal `\b` in `type`.

## Key decisions

| Decision | Choice | Source |
| --- | --- | --- |
| Clear sequence | `ControlOrMeta+A`, `Backspace`, only when the field holds a value | research §2, §3 |
| Default | `clear: true` | research §3 |
| Still not empty | the action fails with the field and its value | research §3 |
| `press` | `key`, `times` 1-50, `perKey` 0-10 s | research §3 |
| Version | 0.1.9 | |

## Phase 1: fill clears, press presses

**Discipline:** TDD (schema and mapping tests, then a browser test that records against a page with a prefilled
field).
**Files:** `src/film.ts`, `src/record/record.ts`, `src/record/actions.ts`, `src/config/actions-schema.ts`,
`schema/marketing.schema.json`, `tests/actions.test.ts`, `tests/actions-schema.test.ts`,
`tests/support/trace-director.ts`, `tests/record.test.ts` (new), README, `package.json`, `package-lock.json`.

1. `Director.press(key, { times?, perKey? })` and `Director.fill(name, value, { clear? })`.
2. Recorder: `press` logs a key, presses, holds `perKey`, `times` times; `fill` after the tap reads the value and,
   when it is not empty and `clear` is not `false`, presses select all and Backspace (each logged and held), then
   checks the field is empty and fails naming it otherwise.
3. Schema: `fill.clear` (boolean, optional), new `press` action; `ACTION_NAMES` gains `press`; JSON Schema
   regenerated.
4. `runAction` maps both, leaving out options the action does not set.
5. Tests: schema accepts and refuses (`times` 0 and 51, a key with a space, an unknown key on `press`); mapping;
   recording with Chromium: a prefilled `45` filled with `50` holds `50`, `clear: false` holds `4550`, an empty field
   logs exactly the typed keys and no more frames than the characters, `press` Backspace twice empties `45`, and a
   field that refills itself fails with its name.
6. README: `fill` row says what happens to a prefilled value, `press` row, upgrade note; version 0.1.9.

Done when: gates green (typecheck, lint, test, build).

## Progress

- [x] Phase 1: fill clears, press presses — 43dafbb
