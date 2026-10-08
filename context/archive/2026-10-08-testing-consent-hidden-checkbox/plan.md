# Plan: testing-consent-hidden-checkbox

Input: change.md (research and framing skipped, reasons there). Complexity: small (one phase, one package).

## Goal

`registerAccount` ticks the consent box whether the native input is visible, transparent or clipped, and fails
with a clear assertion when it stays unchecked. The tick is exported as `tickCheckbox` for an app's own forms.

**Out of scope:** the adopting app's removal of its own helper; other helpers (the issue confirms they fit).

## Findings (the reading behind the plan)

- `locator.check()` runs actionability checks and clicks the element's centre with the mouse. A clipped input
  (`sr-only`) or one covered by a custom box makes the hit target another element, and Playwright waits until its
  timeout ("intercepts pointer events").
- The issue's three proposals:
  - clicking the label text (`getByText(consent).click()`) hits whatever sits at the centre of the text; a consent
    label usually contains links to the terms and the privacy policy, so the click can open a link instead;
  - `check({ force: true })` skips the checks but still clicks the input's coordinates, which on a clipped input
    land on another element;
  - an option on the copy object pushes a markup detail into a dictionary type shared with the auth module.
- `locator.dispatchEvent("click")` fires a real `click` event on the input itself. The browser runs the checkbox's
  activation behaviour (toggle, then `input` and `change`), React's `onChange` listens to it, and a `disabled`
  input stays unchecked. It needs neither visibility nor a free hit target.

## Key decisions

- **D1** New `tickCheckbox(checkbox: Locator)` in `src/playwright/checkbox.ts`: returns when already checked,
  otherwise dispatches `click` on the input, then `await expect(checkbox).toBeChecked()`. Idempotent, so a form
  that replays a ticked box is not unticked.
- **D2** `registerAccount` uses it for the consent box; `tickCheckbox` is exported from the playwright entry and
  listed in the README table.
- **D3** testing 0.1.3 with a CHANGELOG entry; the release is left to the #251 thread.

## Phase 1: hidden-checkbox tick (TDD)

- Tests (`tests/playwright-browser.test.ts`): the test app's register form gets a variant whose consent input is
  clipped (`sr-only` styles) under a label that draws its own box; `registerAccount` registers through it. A second
  test: `tickCheckbox` leaves an already ticked box ticked, and rejects on a disabled box.
- Code: `src/playwright/checkbox.ts`, `auth.ts`, `index.ts`; README, CHANGELOG, `package.json` 0.1.3 and the lockfile.

Done when: the hidden-checkbox test was seen red with `.check()`, then green; gates green (typecheck, lint, test,
build).

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: hidden-checkbox tick

#### Automated
- [x] 1.1 Hidden-checkbox tests seen red, then green
- [x] 1.2 Gates green (typecheck, lint, test, build)
- [x] 1.3 README, CHANGELOG and version 0.1.3
