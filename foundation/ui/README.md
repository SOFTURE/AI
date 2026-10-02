# @softure-ai/ui

**Status:** wave 0 · tokens, theme and CSS pipeline (FD-5); UI primitives (FD-6).

The design foundation every SOFTURE UI stands on: the `--sft-*` token contract with light and dark
defaults, a theme provider, a no-flash theme switch, the UI primitives every module builds its
screens from, and compiled CSS that needs no Tailwind in the app
([docs/02 §5](../../docs/02-module-standard.md#5-appearance-tokens-slots-overrides)).

## Install and wire up (Next.js App Router)

```css
/* app/globals.css: styles.css first, so its layer order is the one the browser keeps */
@import "@softure-ai/ui/styles.css";
@import "tailwindcss";                  /* optional: only if the app uses Tailwind 4 */
@import "@softure-ai/ui/tailwind.css";  /* optional: bg-accent, text-muted, rounded-card… on the tokens */
```

```tsx
// app/layout.tsx
import { SoftureThemeProvider, ThemeScript } from "@softure-ai/ui";

const theme = { light: { "color-accent": "#0b5" } };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript theme={theme} />
      </head>
      <body>
        <SoftureThemeProvider theme={theme}>{children}</SoftureThemeProvider>
      </body>
    </html>
  );
}
```

`<ThemeSwitch locale="pl" />` anywhere renders Light · Dark · System (System is the default).

## Tokens

| Group | Tokens (`--sft-…`) | Per scheme |
| --- | --- | --- |
| Colour | `color-{background,surface,surface-raised,foreground,muted,border,border-strong,accent,accent-fill,accent-fill-hover,on-accent,danger,success,warning,focus}` | yes |
| Shadow | `shadow-{1,2}` | yes |
| Typography | `font-{sans,mono,heading}`, `text-{xs,sm,base,lg,xl,2xl,3xl,display}` | no |
| Shape and space | `radius-{control,card,pill}`, `space-{1…8}` (0.25 rem steps) | no |
| Motion | `duration-{fast,base,slow}` (160/200/240 ms), `ease-{out,in-out}` | no |

The list lives in `src/theme/tokens.ts` (`SCHEME_TOKENS`, `SHARED_TOKENS`, `DEFAULT_THEME`); every
CSS file the package ships is generated from it.

## Overriding the theme

Three ways, from the most global:

1. **CSS.** Unlayered rules in the app beat the defaults, which sit in `@layer softure`:
   `[data-theme="dark"] { --sft-color-accent: #8f6; }`.
2. **`<SoftureThemeProvider theme={{ light, dark, shared }}>`.** `light` and `dark` take colours and
   shadows, `shared` takes the rest. Only the tokens you name are written. Values with `;`, `{`, `}`,
   `<`, `>` or a line break throw.
3. **`design.json`** (Impeccable, `schemaVersion: 2`): `<SoftureThemeProvider design={json}>`, or
   `themeFromDesignJson(json)`, which returns a `Result` with the theme and the roles it ignored.
   Role names map to tokens (`line-strong` → `color-border-strong`); `theme` overrides `design`.

`getThemeColors(theme)` gives the background of each scheme for Next's `viewport.themeColor`.

## Theme switch

- The choice lives in the cookie `sft-theme` (`light` | `dark`; absent = System). `ThemeScript`
  reads it before the first paint and sets `data-theme` on `<html>`; the server never reads it, so
  routes stay static. Use the same `cookieName` on `ThemeScript` and `ThemeSwitch` when you change it,
  and `cookieDomain` on the switch to share the choice across subdomains.
- With a strict CSP pass `nonce` to `ThemeScript`.
- `data-theme="light"` or `"dark"` on any element themes that subtree.
- Slots: `classNames={{ root, legend, options, option, input, label }}`; `unstyled` drops the
  defaults. Copy: `locale` (`en` default, `pl`) and partial `messages`.

## Primitives

| Group | Components and helpers |
| --- | --- |
| Actions | `Button` (`primary`, `secondary`, `ghost`, `danger`; `sm`, `md`, `lg`; `pending`), `ButtonLink`, `IconButton`, `getButtonClass` |
| Icons | `ArrowLeftIcon` … `ChatIcon` (33, decorative, `size` and `className`) |
| Surfaces | `Card` (`boxed`, `lead`, `flat`), `Stat`, `EmptyState`, `Hint`, `FormError` |
| Fields | `Field`, `FieldGroup`, `TextField`, `PasswordField`, `MoneyField`, `SelectField`, `CheckboxField`, `INPUT_CLASS` |
| Controls | `Select` (ARIA listbox), `Switch`, `SwitchControl`, `Checkbox`, `SegmentedControl` |
| Dialogs and feedback | `Modal`, `ModalBody`, `ModalFooter`, `ModalForm`, `ToastHost` + `announceToast` |
| Forms | `ActionForm` (server action, value replay, field errors, success toast), `ActionResult` |
| Money | `parseAmount`, `formatAmountInput`, `normalizeAmountInput`, `getAmountErrorMessage` |

Server-safe (no `"use client"`): `Button`, `ButtonLink`, `IconButton`, icons, `Card`, `Stat`,
`EmptyState`, `FormError`, `Field`, `FieldGroup`. The rest are client components.

### Shared props

- **Slots.** Every component takes `classNames` with a typed slot list (`Card`: `root, header,
  titleRow, title, subtitle`; `Modal`: `overlay, panel, header, heading, title, subtitle, close`; …).
  An app class is added to the default and wins, because the defaults sit in `@layer softure`.
- **`unstyled`.** Drops every default class and keeps structure, ARIA and behaviour.
- **Copy.** Components with built-in text (`Modal`, `ModalFooter`, `ActionForm`, `Card` and field
  hint names) take `locale` (`en` default, `pl`) and partial `messages` for their group in
  `uiMessages`. Everything else the user reads (labels, titles, button text) comes from the app as
  props.
- **Links.** `ButtonLink` renders `<a>` unless you inject your router's link:
  `<ButtonLink LinkComponent={Link} href="/pricing" variant="primary">`. The package never imports
  `next/*`.

### Forms

```tsx
"use client";
import { ActionForm, MoneyField, TextField } from "@softure-ai/ui";

<ActionForm
  action={saveDebt}                       // (formData) => Promise<ActionResult>
  getErrorMessage={(code) => t(code)}     // codes from the server -> the app's copy
  submitLabel="Save"
  successMessage="Saved"                  // toast; render <ToastHost /> once per page
  onCancel={close}                        // optional: lay out as a Modal body and footer
>
  <TextField name="name" label="Name" required />
  <MoneyField name="amount" label="Amount" locale="pl" suffix="PLN" />
</ActionForm>
```

The action returns `ok()` or `{ ok: false, error: "app.code", fieldErrors?: { name: "app.code" } }`.
After a rejected submit the fields show what was typed (React resets the form) and their own
errors; `PasswordField` never replays. The server parses amounts with the same
`parseAmount(text, locale)` the field formats with.

### Modal

Render `<Modal title onClose>` while it is open. It moves focus in, keeps Tab inside, makes the rest
of `<body>` inert (live regions stay reachable), locks the page scroll and returns focus to the
opener. Escape closes it unless something inside handled the key first (an open `Select` list).
Pass `isDismissible={false}` while a save runs (`ActionForm onPendingChange`).

## How the CSS is built

`npm run build` runs `tsc`, then `scripts/build-css.mjs`, which compiles the components with the
Tailwind 4 CLI into `dist/styles.css` and writes `dist/tailwind.css`. It prints the gzip size and
fails above 20 kB (NFR-7).

- Components use Tailwind classes with the `sft:` prefix (`sft:bg-surface`, `sft:hover:text-foreground`).
  The package theme is `@theme inline reference prefix(sft)`, so every utility reads a `--sft-*`
  token and Tailwind emits no variables of its own. Durations have no Tailwind namespace:
  `sft:duration-(--sft-duration-fast)`.
- `styles.css` opens with `@layer theme, base, softure, components, utilities;`: softure sits above
  the app's resets and below the app's components and utilities, so an app class always wins.
  Imported after the app's Tailwind (for example from JavaScript after `globals.css`), softure would
  land above the app's utilities; keep the import order shown above.
- Raw colours are allowed only in `src/theme/`; `tests/architecture.test.ts` keeps them out of `src/ui/`,
  together with inline copy (JSX text and literal `aria-*`, `title`, `placeholder`, `alt`, `label`).
- A utility whose theme value is missing compiles to nothing, silently. `tests/styles.test.ts`
  therefore requires a compiled selector for every `sft:` class written in `src/ui/`; the static
  theme in `scripts/build-css.mjs` adds the base spacing, one breakpoint, two container widths,
  line heights and the spinner animation.
