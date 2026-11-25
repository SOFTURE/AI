# Plan review: theme-notion-dialog-first-field

Verdict: approve. One helper used by two content components, test first, with the app's own `onOpenAutoFocus` kept
in control and Radix's default kept for dialogs without a field. The upstream deltas list the change, so the guard
test keeps the shadcn drift visible. Choosing the dialog side over the tooltip side is right: only it puts focus on
the field, as the acceptance asks. Leaving `AlertDialog` alone keeps its Cancel-first default. No version bump here.
