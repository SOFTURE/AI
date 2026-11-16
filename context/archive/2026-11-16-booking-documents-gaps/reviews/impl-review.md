# Implementation review: booking-documents-gaps

Verdict: approve. The three pieces match the plan; findings fixed in the change:

1. Fixed (warning): the viewer's corner close button would sit under a phone's notch inside the safe-area padding;
   the close button moved into the header (`document-viewer-close`).
2. Fixed (warning, axe): the row's `aria-label` ("Open {name}") did not hold its visible words
   (label-content-name-mismatch); the open word is now an `sr-only` prefix, and `messages.open` is a plain word.
3. Fixed (warning, axe): the scrolling body was not reachable by keyboard (scrollable-region-focusable); it is a
   focusable, labelled region.
4. Fixed (suggestion): a PDF page fitted the area including its padding and was clipped; it fits inside the padding
   and is at most 880 px wide at 100 %.
5. Accepted: `loadPdfjsEngine`'s drawing is not covered in Node (no canvas); the visual gallery and the adopting
   app's browser checks cover a fake engine and the real one respectively.
