---
change_id: marketing-kit-sentence-screen-guard
status: plan_reviewed
updated: 2026-10-07
---

# Plan: per-sentence screen guard and the pre-payment rehearsal in marketing-kit

Input: change.md

## Goal

A sentence can name the phrases the screen must show while it is spoken, and the guard checks them then; the README
points an author who wants to rehearse before paying at `--placeholder`.

## Approach

A new optional `beats[].screenGuard` on every sentence after the opening, for actions scenes and scene modules alike
(both drive `Director.beat`). The recorder checks a sentence's phrases at the end of that sentence (after its hold),
unless a `checkScreen` inside the sentence already checked them. `checkScreen` checks the video's list plus the
current sentence's. Rejected: checking the video-level list at the end of the film (it would change what existing
films prove and fail films whose last sentence scrolls the numbers away); a separate `checkSentence` action (one more
action for what the end of a sentence already marks).

## Key decisions

- **D1. Part 1 needs no new flag.** `--placeholder` is the issue's `--fake-voice`, shipped in 0.1.8. The README's
  voiceover section says so, and the upgrade note names the script and config copy it replaces.
- **D2. Where a sentence's phrases are checked:** at a `checkScreen` inside the sentence when there is one, otherwise
  when the sentence ends, after its hold, which is the last frame spoken over it.
- **D3. `checkScreen` checks the video's phrases and the current sentence's.** Before the first sentence it checks
  the video's only.
- **D4. The video-level list becomes optional** (default `[]`) when a sentence carries phrases; a film still needs at
  least one phrase somewhere, and `checkScreen` (the schema's check for actions, the recorder's for a module) is
  required only when the video-level list is not empty.
- **D5. The opening sentence takes no `screenGuard`** (it plays over the still; the scene starts at the second), the
  same rule as `actions` and `pad`. A sentence's list, when present, has at least one non-blank phrase.
- **D6. A sentence that ends without its phrases** throws `ScreenGuardError` (exit code 2) naming the sentence, the
  missing phrases and the file to fix, with the same recording-day hint as `checkScreen`.
- **D7. The pure parts live in `src/record/screen-guard.ts`** (which phrases a check covers, which are missing, the
  messages), so they are unit-tested without a browser; the fixture's JSON film gets a sentence-level phrase so the
  CI render job records it for real.
- **D8. marketing-kit 0.1.9** with an "Upgrading to 0.1.9" note; `schema/marketing.schema.json` regenerated.

## Phase 1: the per-sentence guard (TDD)

**Discipline:** TDD. **Files:** `src/record/screen-guard.ts` (new) and its test, `src/record/record.ts`,
`src/film.ts` (`Beat.screenGuard`), `src/config/schema.ts`, `src/config/config.ts`,
`src/config/actions-schema.ts` (the `checkScreen` description), `schema/marketing.schema.json`, `tests/config.test.ts`,
`tests/actions-schema.test.ts`, `examples/fixture/marketing.json`.

Steps: tests for the helper (phrases covered by `checkScreen` before and inside a sentence, missing phrases, the
sentence-end message) and for the schema (a sentence's list loads onto the beat; an opening sentence's list, an
empty one and a blank phrase are refused by path; a film with only sentence phrases loads with no video list and no
`checkScreen`; a film with no phrase anywhere is refused); then the code; regenerate the JSON schema.

Done when: the new tests fail without the code and pass with it; the fixture film records with its sentence phrase
(`MARKETING_KIT_RENDER=1` render test, locally); a sentence phrase the screen does not show stops `record` with exit
code 2 naming the sentence (checked by hand on the fixture); gates green.

## Phase 2: docs and version

**Discipline:** test-after. **Files:** `tools/marketing-kit/README.md`, `tools/marketing-kit/package.json`,
`package-lock.json`.

Steps: README `screenGuard` bullets (video and sentence), the `checkScreen` row, the config-time checks, the
voiceover section's rehearsal paragraph, "Upgrading to 0.1.9"; version 0.1.9.

Done when: gates green; CI green on the pull request (including the render job).

## Risks and rollback

- An existing config could stop loading: the video-level list keeps its rule when no sentence has phrases, and the
  config tests pin it. Rollback: revert the change; configs without sentence phrases are untouched.

## Progress

### Phase 1: the per-sentence guard

#### Automated
- [ ] 1.1 Helper and schema tests fail first, then pass
- [ ] 1.2 Fixture film records with a sentence-level phrase (render test, local)
- [ ] 1.3 Gates green (typecheck, lint, test)

#### Manual
- [ ] 1.4 A missing sentence phrase stops `record` with exit code 2 naming the sentence

### Phase 2: docs and version

#### Automated
- [ ] 2.1 README and version 0.1.9
- [ ] 2.2 Gates green (typecheck, lint, test)
