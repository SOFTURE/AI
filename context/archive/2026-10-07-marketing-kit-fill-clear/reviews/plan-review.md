# Plan review: marketing-kit-fill-clear

Verdict: **approved** with two findings applied to the plan.

| # | Finding | Severity | Resolution |
| --- | --- | --- | --- |
| P1 | "A film over empty fields records exactly as before" needs evidence, not a claim: the clear must not add frames or keys when the field is empty. | should | Step 5 records an empty-field `fill` and asserts the key log equals the typed characters and the frame count equals the 0.1.8 sequence (tap hold + one hold per character). |
| P2 | `fill` reads the value with `inputValue()` after the tap; an app that fills the field on focus would be cleared too. | note | Intended: the scene names the value it wants on screen. Recorded in the README row. |
| P3 | `Director` is an exported interface; adding `press` breaks a hand-written Director. | note | Accepted (research §4): scenes receive the Director, none implement it. The upgrade note says so. |
| P4 | The schema test pins the discriminator's list of `do` values; adding `press` changes that message. | check | Holds: step 5 updates the expected message. |

Coverage of change.md intent: replace a prefilled value (steps 2, 5), the old value visibly goes (select all and
Backspace held and logged), `press` for single keys (steps 1-5). Constraints: empty fields unchanged (P1), keys
logged (step 2), JSON and TS 1:1 (step 4), 0.1.9 (step 6).
