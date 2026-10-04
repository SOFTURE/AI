# Plan: marketing-kit-font-files-description

Input: change.md, research.md. Complexity: small.

## Goal
The JSON Schema of `marketing.json` tells a project that `brand.fonts.<kind>.files` covers the family's weights and
styles, that one weight and style may take several subset files (Fontsource `latin` and `latin-ext`, each with its
`unicodeRange`), and how each output picks among them: the film by `unicodeRange`, OG images in the listed order.

**Out of scope:** behaviour changes (none needed, research §Summary); the README (§OG images already documents
subset files); other schema keys; publishing.

## Approach
**Starting point:** the `.describe()` of `files` in `fontSchema` (research §Summary).

**Chosen:** replace the text with: "The files of the family: one or more per weight and style, e.g. Fontsource's
latin and latin-ext subsets of one weight, each with its unicodeRange. The film picks the file of a character by
unicodeRange; OG images try the files in the listed order. None: only the fallback is used." Then regenerate the
JSON Schema.
Rejected: describing subsets on `unicodeRange` only - the array description is what says "one per weight", and an
editor shows it on `files`.

**Key decisions:**
| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Where | the `files` description | the outcome names it | roadmap FU-29 |
| Example names | Fontsource `latin`, `latin-ext` | the README's example; no FIRE font names | research §Constraints |
| Version bump | none | the package is unpublished `0.0.0` (MK-8 publishes) | plan |

## Phase 1: The font files description admits subset files
**Discipline:** test-after (documentation; the drift test is the check). **Files:**
`tools/marketing-kit/src/config/schema.ts`, `tools/marketing-kit/schema/marketing.schema.json`

1. `schema.ts`: the new `.describe()` text.
2. Run `npm run schema -w @softure-ai/marketing-kit`; both font entries of the generated file change.
3. Run `npx vitest run tools/marketing-kit/tests/schema.test.ts` from the root: drift and descriptions pass.

**Done when:**
- Automated: `tests/schema.test.ts` passes on the regenerated file, and the old text appears nowhere in the package
  (`grep "one per weight" tools/marketing-kit` finds nothing).
- Automated: Gates green (typecheck, lint, test) and `npm run build`.

## Risks and rollback
- Text only; no config changes its meaning.
- Rollback: revert the phase commit.

## Decisions (auto)
- Complexity → small (one description, one generated file).
- Framing skipped (change.md Notes).

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: The font files description admits subset files

#### Automated
- [ ] 1.1 `tests/schema.test.ts` passes on the regenerated file and the old text is gone
- [ ] 1.2 Gates green (typecheck, lint, test) and build
