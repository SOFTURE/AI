---
change_id: theme-flat-paint-chat-look-1261
status: planned
---

# Plan: chat look maps (issue #1261)

Input: change.md, research.md. Complexity: small (one package, additive).

## Phase 1: look maps and tests (TDD)

Files: `themes/theme-flat-paint/src/look/chat.ts`, `src/index.ts`, `tests/chat-look.test.tsx`,
`tests/chat-browser.test.tsx`, `tests/theme-css.test.ts`.

1. `src/look/chat.ts`: the seven slot types (same sets as ui's) and `CHAT_LOG_LOOK`, `CHAT_MESSAGE_LOOK`,
   `CHAT_COMPOSER_LOOK`, `TOOL_CALL_CARD_LOOK`, `REASONING_DISCLOSURE_LOOK`, `CHAT_EMPTY_STATE_LOOK`,
   `CHAT_ERROR_LOOK`, plus `CHAT_LOOK` that groups them by component for spreading.
   - Message: role label on `caption` bold; the user bubble with a `line-strong` outline (and `surface-raised`, which
     ui sets); a failed message with a 4 px `debt` leading edge; `meta` as `num` on `caption`.
   - Tool card: dashed border while `pending`, solid once settled; `error` with a 4 px `debt` leading edge; the status
     as a flag (`rounded-flag`, outline) in `muted` / `accessible` / `debt` per state.
   - Reasoning: summary on `body-sm`, content with a `line-strong` rule. Empty state: the card radius and padding,
     title on `subsection`. Error: card radius, `debt` outline and leading edge. Composer: Send without ui's
     transparent border (as the prompt action).
2. Barrel exports.
3. Tests: slot sets match ui's (type test); rendered markup carries the map classes on the right slots;
   theme-css compiles every class; a Chromium test (skipped without a browser) renders a full chat with ui's compiled
   `styles.css` and the theme's app CSS, light and dark, at 390 and 1440 px, and asserts: user bubble outline =
   `line-strong`, background = `surface-raised`; tool states differ by border style and edge, not colour alone;
   nothing but Send is painted lime; status text reaches 4.5:1; no horizontal overflow.

## Phase 2: docs

README: look maps table rows, a chat example, the `text-page` note for a title above the chat. CHANGELOG `Unreleased`.

## Decisions (auto)

- No tints behind state text: the plain roles already pass AA on every surface; a tint would need its own checks.
- Browser test asserts computed styles instead of pixel baselines: the package has no baseline gallery, and the
  issue's "visual tests" are met by measuring the rendered look in both schemes and both widths. Screenshots are
  written only when `FLAT_PAINT_SHOTS_DIR` is set (for the review), never committed.
- `ChatLog` gets no map beyond list spacing on the theme's step: ui's look already fits.
- No version bump: the coordinator releases the batch.

## Progress

- [ ] Phase 1: look maps and tests
- [ ] Phase 2: docs
- [ ] Implementation review
