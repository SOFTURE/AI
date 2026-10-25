---
change_id: theme-notion-non-text-contrast
---

# Research

## Where the boundary and state colours are used

- `input`: the border of `Input`, `Textarea`, `SelectTrigger`, `InputGroup`; also the outline `Button` border, the
  `ButtonGroup` separator (`bg-input`) and the dark active tab (`dark:border-input dark:bg-input/30`).
- `control-off`: the unchecked `Switch` track; the bridge maps `--sft-color-border-strong` to it, so the `@softure-ai/ui`
  fields, switches and checklist markers inside a `PageFrame` draw their boundary with it.
- `Progress`: track `bg-primary/20`, fill `bg-primary` (or a tone fill from `StatCard`: gray, green, orange, red).
- `Checkbox`: outline `border-muted-foreground` (already above 4.5:1 since #756), checked fill `primary`.

## Measurement (alpha composited over the surface, WCAG relative luminance)

| Part | Light | Dark |
| --- | --- | --- |
| `input` on page / card / popover / muted / secondary | 1.24-1.23 | 1.23-1.26 |
| `control-off` on the same | 1.40-1.36 | 1.39-1.41 |
| `Progress` fill `primary` against its `primary/20` track | 3.71 (3.33 on secondary) | 2.97 on page, 2.60 on popover |
| `Progress` track against the page | 1.33 | 1.20 |
| `primary` (checked switch and checkbox) on page / card / popover | 4.92 | 3.57 / 3.31 / 3.11 |

Smallest alpha that reaches 3:1 on every surface, hue kept: `input` light `rgba(15, 15, 15, 0.45)`, dark
`rgba(255, 255, 255, 0.348)`; `control-off` light `rgba(135, 131, 120, 0.926)`, dark `rgba(202, 196, 183, 0.484)`.

## Progress bar

The fill carries the value, so the fill must reach 3:1 against the track and the page. The track cannot also reach 3:1
against the page in light: the fill is 4.92:1 on white, and 3:1 on both sides of the track would need 9:1. The track
stays a quiet extent. In dark the default fill `primary` is too dark against its track (2.97); the `link` blue (#756),
the same hue lighter, gives 5.14 on the page and 4.51 on a popover. The tone fills already pass in both schemes (3.31+).
