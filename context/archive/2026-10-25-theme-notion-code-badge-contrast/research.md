# Research: theme-notion Code and destructive Badge contrast (issue #763)

## Measured (tokens on the base branch)

| Part | Scheme | Text | Background | Ratio |
| --- | --- | --- | --- | --- |
| `Code` (`text-red` on `bg-secondary`) | light | `#c8413d` | `#f1f1ef` | 4.33 |
| `Code` | dark | `#ea5e5b` | `#2f2f2f` | 3.98 |
| `Badge` destructive + `color="default"` | dark | `#d4d4d4` | `destructive/60` over the page | 3.98 |
| `Badge` destructive + a palette `color` | dark | `rgba(255, 255, 255, 0.81)` | same | 4.46 |

`tests/contrast.test.ts` lists `red` on `background`, `card`, `popover` (and `muted` in light) but not on `secondary`,
the only surface `Code` uses.

## Findings

- `red` is the palette's text red (`Status`, tones, alert icons, the red progress fill). Darkening it for `Code`
  would move every red in the theme. Notion itself draws inline code in its own red (`#eb5757`), separate from the
  palette red, so a code colour of its own matches the model.
- A lightness-only shift in OKLCH (hue and chroma kept, the method of #756) gives the smallest move that clears
  4.5 with a small margin on `secondary`:
  - light `#c8413d` → `#c33c39`: 4.61 on `secondary`, 4.86 on `muted`, 5.22 on white;
  - dark `#ea5e5b` → `#f86a66`: 4.62 on `secondary`, 5.62 on `muted`, 6.07 on the page.
  Both differences are hard to see next to the old value; the dark one sits next to dark `destructive` `#fd6866`.
- The name cannot be `code`: `text-code` is already the 13/20 mono text style; a colour `code` would make
  `text-code` ambiguous. `code-foreground` follows the `*-foreground` naming of the theme.
- `Badge`: `color` and `variant` are independent cva variants, so a destructive badge with a colour gets
  `text-*-tag-foreground` (the colour's text wins over `text-destructive-foreground`) and in dark
  `dark:bg-destructive/60` (a variant utility, ordered after `bg-*-tag`). The result mixes two designs. A destructive
  badge has its own fill and text; a colour has no meaning on it. cva `compoundVariants` can apply the colour classes
  to every variant except `destructive`, which fixes both `Badge` and direct `badgeVariants()` callers.

## Options

1. `code-foreground` token (chosen): contained, Notion's model, one pair to test.
2. Darken/lighten `red` itself: moves every red in the theme for one part.
3. `Code` on `bg-background` instead of `secondary`: changes the Notion look of inline code.
