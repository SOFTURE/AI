# Frame: mk-declarative-actions

## Request as stated

Roadmap MK-3: beats carry an `actions` list mapping 1:1 to Director methods; targets are locator
descriptors; `sceneModule` stays as an escape hatch; FIRE's film in JSON records the same log as in TS.

## Observation, premise, direction

- Observation: every scene today is a TS module; an agent or a project without TypeScript cannot write
  one, and a broken locator points at a file, not at the key to fix.
- Premise: FIRE's whole scene is plain data apart from the locators (research), so JSON loses nothing.
- Proposed direction: a strict JSON action list per beat, interpreted onto the existing Director.

## Premise check

- Do nothing: `sceneModule` keeps working, but MK-8's "describe a film in one JSON file" promise is false
  and every new project writes TS.
- Evidence: 69 actions, 5 locator shapes, no conditional waits (research, "FIRE's scene, by shape").
- Already solved elsewhere: Playwright's own locator API is the target; nothing in SOFTURE to reuse.
- Smallest proof: the fixture film's JSON twin records the same `log.json` as the TS film, and FIRE's
  JSON scene makes the same Director calls as its TS scene.

## Framings

| Option | What we build | Cost vs as-asked | Risk |
| --- | --- | --- | --- |
| A. Raw selectors | `target` is a Playwright selector string (`role=button[name=/^Dalej$/]`) | about half | authors learn Playwright's selector engine syntax; no validation beyond "a string" |
| B. As asked | strict descriptors (`role`, `text`, `label`, `testId`, `css`, + `name`, `exact`, `hasText`, `nth`, regex as `{ regex, flags }`), static checks at load time (until words, still and marks, checkScreen) | as asked | one more shape to keep in step with Playwright |
| C. A scripting language | B plus conditions, loops and variables | about double | a second programming language inside JSON; `sceneModule` already covers logic |

## Decision

B, because FIRE needs no logic beyond what B expresses and C duplicates the escape hatch. Confidence: HIGH.
Problem to plan around: a beat's `actions` list replaces the scene module for a whole video, with errors
by JSON path both at load time and while recording. Scope now: the schema, the interpreter, the CLI
wiring, the fixture twin, docs. Out of scope now: mixing a module and actions in one video, conditional
actions, a `type` that targets a field (it types into the focused element, as the Director does).
What changes for the plan: a video uses either `sceneModule` or beat `actions`, never both, so the
loaded config models the scene as a discriminated union.
