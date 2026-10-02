# @softure-ai/ui

**Status:** wave 0 · tokens, theme and CSS pipeline (FD-5); primitives follow in FD-6.

The design foundation every SOFTURE UI stands on: the `--sft-*` token contract with light and dark
defaults, a theme provider, a no-flash theme switch, and compiled CSS that needs no Tailwind in the
app ([docs/02 §5](../../docs/02-module-standard.md#5-appearance-tokens-slots-overrides)).

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
- Raw colours are allowed only in `src/theme/`; `tests/architecture.test.ts` keeps them out of `src/ui/`.
