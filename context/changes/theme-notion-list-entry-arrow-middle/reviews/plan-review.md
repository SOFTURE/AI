# Plan review: theme-notion-list-entry-arrow-middle

Verdict: approve. The change is one class decision in `ListEntry`, with no API change. It fixes the issue's case (a
linked row with a control and no status) without undoing #1497: a stacked status over controls keeps the top
alignment, and #1497's geometry test stays as the guard for it. The new browser test measures exactly what the issue
reports (arrow middle against the control's middle) at both viewports, so the 44 px phone target is covered, and the
added gallery row makes the case visible in the screenshots and the artifact. `data-row-wide` keeps the top alignment
through the `has-` variant, which its existing fit test guards.
