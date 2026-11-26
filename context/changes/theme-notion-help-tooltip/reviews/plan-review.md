# Plan review: theme-notion-help-tooltip

Verdict: approve. The fix sits where Radix allows it: `composeEventHandlers` skips the trigger's own close when the
app's handler prevented the default, so opening on a prevented click ends open in every order of hover and press, and
the shadcn wrapper keeps its parity. The red-first test drives the exact race from the issue with the trigger's
`data-state`, which needs no layout. The own provider costs a nested context, harmless under `Sidebar`'s. The touch
`pointerleave` guard covers browsers that fire leave after click. A minor release fits a new export.
