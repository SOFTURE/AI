# Implementation review: marketing-kit-caption-entrance-underline

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| 1 | Suggestion | The draft's underline offset (0.9 font sizes) differs from the render's 1 em: libass draws a line one font size tall, the render a 1.18 em line. | Kept: each sits under the letters in its own layout; the browser test checks the render's, the draft test the draft's. |

Plan followed; no drift. Tests: `caption-entrance-underline.test.ts` (10), `footage-config.test.ts` (entrance and
underline), `tests/caption-underline-pop.test.ts` in Chromium (bar under the lit word only, pop never past its size).
