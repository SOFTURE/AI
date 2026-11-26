# Implementation review: theme-notion-help-tooltip

Verdict: approve. The diff matches the plan: one composition (`src/notion/HelpTooltip.tsx`), its export, one message
(`helpTooltip.label`), tests, the gallery case with its fixture and visual baselines, README and CHANGELOG. The click
handler prevents the default before Radix's own close runs (`composeEventHandlers` checks it), so the issue's race
ends open; the test drives that exact sequence and failed against a toggling trigger. Hover, focus, blur, Escape and a
press outside go through Radix's `onOpenChange`, and `onOpenChange` reaches the app only on a real change. The shadcn
`tooltip.tsx` is untouched, so upstream parity holds. The own `TooltipProvider` keeps the component usable outside
`Sidebar`. The hidden hint duplicates the text for `aria-describedby`; Radix's own `role="tooltip"` copy only exists
while open, so the duplicate is needed. Chromium confirms the sizes (44 px below `md`, 28 px above) and the race on a
real pointer. No Polish outside dictionaries; no new dependency.
