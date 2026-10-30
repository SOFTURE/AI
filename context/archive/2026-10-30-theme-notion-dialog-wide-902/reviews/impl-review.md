---
change_id: theme-notion-dialog-wide-902
verdict: approved
---

# Implementation review

Reviewed the diff of de518e8 and 7741160 against plan.md and master (95c963c).

- Acceptance of #902: `DialogContent size="wide"` adds `lg:max-w-1/2` to `max-w-[calc(100%-2rem)] sm:max-w-lg`:
  720 px at 1440 px in the desktop baseline, the phone gutter in the phone baseline. Documented in the README's
  component notes, the CHANGELOG and the parity fixture (`Dialog[size=wide]`).
- Acceptance of #903: `DialogFooter showCloseButton closeLabel="Anuluj"` renders a button named "Anuluj"; without
  the prop it renders `messages.dialog.close`. Listed with the other message props in the README.
- Defaults: the existing fixture entries and baselines are unchanged; only the new case was added.
- Guards: `tests/upstream/deltas.ts` lists the six changed lines with their reasons; typecheck, ESLint, the language
  gate and the theme's 986 tests are green; visual suite 128 of 128.

Verdict: approved.
