# Plan review: theme-notion-list-entry-menu

Verdict: approve. The menu is built from primitives the theme already ships (`DropdownMenu` with its destructive
variant, `AlertDialog`), so keyboard access and the danger tone come with them; a data-driven API makes "destructive
last, separated" a property of the component, not of each app. The confirmation keeps the dialog's state outside the
menu and returns focus to the menu button, which the research shows is needed. The `ListEntry` slot is additive, so no
app breaks. Each acceptance line has evidence: the keyboard and the confirmation in a happy-dom test, the one-line
layout at 1280 and 390 px in a Chromium measurement. The rules for controls and state are documentation, which matches
the issue's "a documented rule".
