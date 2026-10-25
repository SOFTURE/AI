---
change_id: theme-notion-contrast-aa
---

# Research

## Measurement

Contrast per WCAG 2.x relative luminance; an `rgba` token is composited over the surface it sits on. Pairs come from
the class strings in `src/ui` and `src/notion` (`text-X` inside an element on `bg-Y`, hover and focus states
included) plus the axe run of issue #741. Failing pairs are listed in the issue; the main ones:

- light `muted-foreground` #787774: 4.48 on white, 4.17 on `muted`, 3.89 on a hovered row, 3.96 on `blue-bg`.
- white on `primary` #2383e2: 3.88 (both schemes); `text-primary` links on white 3.88, on the dark card 4.20.
- white on `destructive` #eb5757: 3.48; `text-destructive` on white 3.48, on the dark popover 4.40.
- light palette text (Status, tone figures): orange 3.28, yellow 2.75, red 4.26, gray/brown/blue/purple/pink ~4.47.
- dark palette text on the card: purple 4.15, pink 4.28, red 4.29; tag text on dark `yellow-tag` 4.18; dark
  `muted-foreground` on dark `blue-bg` 4.32.
- opacity-faded text: light tab triggers `text-foreground/60` 3.56, sidebar group label `text-sidebar-foreground/70`
  3.14 (light) and 3.59 (dark); alert description `text-destructive/90`.
- focus ring: 57 % blue, about 2.1:1 against the page (non-text minimum 3:1).

## Findings

- One value cannot carry both white text on a blue fill and blue text on a dark surface: white needs a luminance at
  most 0.183, text on #191919 needs at least 0.219. The same holds for red. In light one darker value passes both.
- shadcn/ui new-york v4 already dims the destructive fill in dark (`dark:bg-destructive/60`); the badge does it,
  the button does not. Following it lets the dark `destructive` token be the lighter text red.
- For blue there is no such idiom; Notion itself draws dark-mode link text in a lighter blue than its button fill.
- Lightness-only shifts in OKLCH keep hue and chroma (the "Notion look"); a solver steps lightness by 0.001 until
  every pair of the token reaches 4.55 (a small margin above 4.5 after hex rounding).
