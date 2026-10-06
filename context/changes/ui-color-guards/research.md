# Research: ui-color-guards

Date: 2026-10-06. Sources: FIRE_TRACKER `src/lib/color-vision.ts` and `src/app/theme-contrast.test.ts` (read only),
`foundation/ui/src/theme/{tokens,theme-css}.ts`, the classes of `foundation/ui/src/ui/*`, `modules/auth` (a
`./testing` subpath precedent).

## 1. What FIRE has

- `color-vision.ts` (~200 lines): sRGB ↔ linear, Viénot/Brettel LMS projection for **protanopia and deuteranopia
  only** (tritanopia deliberately left out: ~0.01% and it would ban both brand colours), CIE76 distance in CIELab,
  Lab hue angle and hue distance, `minVisionDistance` (normal + the two simulations), WCAG 2.1 `contrastRatio`,
  `findColorCollisions` returning every colliding pair.
- `theme-contrast.test.ts`: parses FIRE's `globals.css`, resolves `var()` chains, blends tints (`bg-accent/15`) and
  asserts per theme: text roles ≥ 4.5 on three grounds, UI roles ≥ 3, accent on its own tint ≥ 4.5, text on the lime
  fill ≥ 4.5, plus FIRE-specific palette checks (data roles ≥ ΔE 20, brand hue distance, presets). The CSS parsing,
  the landing-page markup check and the FIRE roles stay in FIRE; the generic part is the pair check and the blend.

## 2. What ui has

- Colours live in `DEFAULT_THEME.light|dark` (`#rrggbb` strings) keyed by `SchemeTokenName`; apps override through
  `SoftureTheme` and `mergeThemes`. No CSS parsing is needed: the guard reads the token objects.
- Pairs the components actually paint (from `src/ui/*` classes): text `foreground`, `muted`, `accent`, `danger`,
  `success`, `warning` on `background`, `surface`, `surface-raised`; `on-accent` on `accent-fill` and
  `accent-fill-hover` (primary button, checked switch and checkbox); `danger` and `foreground` on `danger/10` (danger
  button, form error box); `background` on `danger` (danger button hover); non-text `border-strong` and `focus` on the
  three grounds. `border` is decorative (1.15–1.40) and `accent-fill` on white is a fill only (1.27), as the tokens
  file already says, so neither is a guarded pair.
- Measured today, every listed pair passes in both schemes; the tightest are light `border-strong` on `background`
  (3.03) and light `warning` on `background` (4.68). So the guard can land without a token change.

## 3. The open question: the distance metric

Measured on nine pairs (FIRE's roles, ui tokens, a blue pair):

| Pair | CIE76 | CIEDE2000 | ratio |
| --- | --- | --- | --- |
| `#b45309` / `#b91c1c` (amber/red) | 27.1 | 16.2 | 1.67 |
| `#047857` / `#356912` (two greens) | 30.5 | 15.3 | 2.00 |
| `#2563eb` / `#7c3aed` (blue/violet) | 34.4 | 15.1 | 2.27 |
| `#1d4ed8` / `#0e7490` (blue/teal) | 74.4 | 19.8 | 3.76 |
| `#16171a` / `#5b606b` (two darks) | 33.2 | 24.1 | 1.38 |

CIE76 inflates distances unevenly: 1.4× for darks, up to 3.8× in the blues. A single CIE76 threshold therefore means
something different per hue, and its error is in the dangerous direction for a guard (two blues pass as "very
different"). CIEDE2000 was built to fix exactly that non-uniformity. **Decision:** the default metric is CIEDE2000;
`cie76` stays available as an option so FIRE keeps its calibrated thresholds (12, 15, 20, 40) when it adopts the
package. Default minimum distance: 10 (ΔE00). FIRE's data-role minimum (ΔE76 20) lands at 10–12 ΔE00 on its own
pairs (ratios 1.7–2.0); CH-4 measures its palette against it and may pass its own threshold.

## 4. Simulation methods

- Protan and deutan: the Viénot projection FIRE uses (same matrices), so FIRE's numbers do not move.
- Tritan: Viénot's single plane is unreliable for tritanopia; Machado, Oliveira and Fernandes (2009) at severity 1.0
  in linear sRGB is what Chromium's DevTools emulation uses. Cross-checked offline with `colorspacious`
  (`sRGB1+CVD`, `tritanomaly`, severity 100): `#ff0000` → `#ff000f`, `#0000ff` → `#006b96`, `#356912` → `#336559`,
  `#b45309` → `#c63c47`. Those values become a test oracle of a different kind than the implementation.
- FIRE left tritan out of its guard on purpose; the package simulates all three, and `visions` lets a caller narrow
  the set (FIRE: protan and deutan).

## 5. Shape of the export

`modules/auth` exports `./testing` as source → types → built file, which `tests/repo/packages.test.ts` enforces; ui
follows it. The helpers are plain functions with no Vitest import, so any runner can use them, and they return
failures as values for `expect(failures).toEqual([])`, the FIRE pattern.

## 6. Risks

- Rounding: simulations return 8-bit hex, like FIRE; distances near a threshold can move by ~0.1.
- Parallel work: CH-2 adds `--sft-chart-*` tokens to ui and may bump ui too; a version conflict at merge is resolved
  from master (the higher version wins).
