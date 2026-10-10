# Changelog

Newest first. Each version lists what changed for an app that uses `@softure-ai/marketing-kit`. When an app has run a version in
production, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done"). Versions before the first one below are described in their GitHub Releases (`marketing-kit@x.y.z`).

## 0.1.12

- `shots` frames one row of a card that is shorter than its crop (#371):
  - `crop.fill: true`: a target shorter than its frame is stretched to the frame's bottom edge for the capture and
    its content centred vertically, so no page background or next card shows below it. Refused (gate `crop`) when
    the target still ends above the frame's bottom edge; excludes `crop.top`.
  - Step `flatten`: removes the top border and top margin of every match, e.g. the line above the first row a print
    state still shows; fails when nothing matches.

## 0.1.11

- `shots` entries take a print state (#333):
  - `hide`: CSS selectors hidden in that entry's files only, on top of `app.hideSelectors`. New gate `hide`: the file
    is refused when one of them still shows a rendered element inside the frame, or the browser cannot parse it.
  - `crop.top`: a second locator whose top edge starts the frame (e.g. a row inside a card); the width stays
    `crop.target`'s. Refused (gate `crop`) when it matches nothing or several, or lies outside the target.
  - Step `open`: opens every matching `<details>`; fails on a match that is not a `<details>` or did not stay open.
  - Step `hide` with `keepLast`: hides every match but the last N, e.g. the early columns of a sideways chart; fails
    when that would hide nothing.
- `SCREENSHOT_GATES` gains `hide` (between `crop` and `size`).

## 0.1.10

- Every command crashed on start-up when npm resolved satori to 0.35.2 or 0.36.0 (the case through `npx`, which has
  no lockfile): those releases end the process as soon as they are imported. satori is now pinned to `0.35.1`, and
  the CLI loads it only for `og`, so `shots`, `record`, `voice` and the other commands no longer load it at all
  (#254). An app that worked around it with `-p satori@0.35.1` can drop the extra package.
- `shots` signs in itself: a top-level `signIn` block (`path`, `steps`, `expect`, optional `prepare`) and
  `signedIn: true` on an entry. The sign-in runs once per run, its session stays in memory; a failed sign-in refuses
  every signed-in file (gate `sign-in`) and the others still run.
- `signIn.prepare`: the app's command that creates and seeds the account and prints a JSON object as its last line;
  `{data:key}` reads it in `expect`, `path` and step values, so the phrase gate checks a value of the seeded account.
  `{env:NAME}` reads the environment (a password). Nothing the kit resolves is printed.
- Entries take `steps` (`click`, `fill`, `check`, `press`) done before the gates read the page (gate `steps`).
- `crop: { target, aspect: "W:H", padding }` frames one element at a fixed aspect ratio, from the whole page (no
  sticky header over it), and checks the file's dimensions (gate `crop`).
- New gate `duplicate`: a file with the same bytes as an earlier file of the run is refused and deleted. The one
  change for a 0.1.9 config: a light and dark pair of a page that ignores the scheme keeps only its first file.
- `getLocator` moved to `src/record/locator.ts` (still exported from the actions module).

## 0.1.9

- `beats[].screenGuard`: a sentence's own phrases, checked while that sentence is on screen (at a `checkScreen` inside
  it, or when it ends), so each number is proven on screen when the voiceover says it. The video's `screenGuard` is
  still checked at every `checkScreen` and may be left out, with the `checkScreen`, when the sentences carry every
  phrase. A 0.1.8 `marketing.json` works as it is.
- README: `record <video> --placeholder` (0.1.8) is the rehearsal before paying; a script that recorded fake
  voiceovers into a second cache with a copy of `marketing.json` can go.
- `fill` replaces a value already in the input: the old value is selected and deleted on screen, then the new one is
  typed (over a prefilled `45`, `fill … "50"` records `50`, not `4550`). An empty input records as before; `"clear":
  false` keeps the old behaviour; an input the app refills makes the action fail with its name.
- New `press` action and `Director.press(key, { times, perKey })`: any key (`Backspace`, `Enter`, `ControlOrMeta+A`)
  one or more times. A hand-written `Director` needs the new method.

## 0.1.8

- Described in the GitHub Release `marketing-kit@0.1.8`.
