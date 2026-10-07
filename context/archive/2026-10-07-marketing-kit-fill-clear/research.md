# Research: marketing-kit-fill-clear

Input: change.md (issue #175). Sources: the package on `master` (d9129ab); a Playwright 1.63 spike against
Chromium 141 on a page with prefilled inputs (`type="number"`, plain text, `inputmode="numeric"`).

## 1. Current state

- `src/record/record.ts` `director.fill(name, value)`: `ensureVisible`, a `focus` camera cue at 1.55× (desktop: at
  most what fits), `director.tap(input, { after: 0.2 })`, then `director.type(value)`. `type` logs one entry in
  `log.keys` per character, calls `page.keyboard.type(character)` and holds `perChar` (0.13 s).
- `src/compose/compose.ts` plays a key sound at every `log.keys` frame.
- `src/record/actions.ts` `runAction` maps each action to the Director method of the same name;
  `src/config/actions-schema.ts` `actionSchema` is the strict discriminated union on `do`, also the source of the
  JSON Schema (`scripts/write-schema.ts`).
- `tests/actions.test.ts` checks the action → Director mapping with a trace Director
  (`tests/support/trace-director.ts`); `tests/actions-schema.test.ts` checks the schema, including the exact list of
  `do` values in the discriminator error.
- No test records a film outside the fixture render (`tests/render.test.ts`, only with `MARKETING_KIT_RENDER=1`).

## 2. What clears a field (spike)

| Sequence after the tap | `type="number"` `45` | text `hello world` | `inputmode="numeric"` `45` |
| --- | --- | --- | --- |
| type `50` | `4550` | appended at the caret | `4550` |
| `ControlOrMeta+A`, `Backspace`, type `50` | `50` | `50` | `50` |

Same results with a touch phone context (`isMobile`, `hasTouch`) and a desktop mouse context. `ControlOrMeta` is
Playwright's own platform switch (Meta on macOS, Control elsewhere), so the kit needs no platform check.

Backspace per character was considered for a "key by key" deletion, but the tap leaves the caret where the finger
landed, not at the end, so it would need an `End` first and still fail on an input that reformats while editing.
Select all and one Backspace work wherever the caret is.

## 3. Decisions

| Question | Choice | Why |
| --- | --- | --- |
| `clear` or `press` | **both** | `clear` fixes the silent `4550` for every scene; `press` covers keys a form needs anyway (Enter, Tab, Escape) and scenes that show deletion step by step |
| `fill`'s default | **`clear: true`** | appending to a prefilled value is never what a scene that names the value means; `false` keeps the old behaviour for a scene that wants it |
| An empty field | no keys pressed, no frames added | a film over empty fields records frame for frame as in 0.1.8 |
| How the clear looks | select all (held, so the selection shows), Backspace (held), then typing | the viewer sees the old value highlighted and gone; both keys are logged as key sounds |
| A field that stays non-empty after the clear | the action fails, naming the field and what it still holds | a silent wrong value is what the issue is about; the screen guard may not cover the field |
| `press` arguments | `key` (Playwright key name, modifiers with `+`), `times` (1-50, default 1), `perKey` (seconds, default 0.13) | mirrors `type`'s `perChar`; Playwright refuses an unknown key name with its own message, which the action error carries with the JSON path |
| Key name validation | non-empty, no whitespace | Playwright's key list is long and versioned; its error already names the bad key |

## 4. Risks

- A field that is not an `<input>` (a `<textarea>`): out of scope; `fill` only targets `input[name=…]`.
- An app that selects the content on focus: select all again is harmless.
- `Director` gains a method: a project that implements `Director` itself (none known; scenes receive it) would need
  `press`. Scenes that call it are unaffected.
