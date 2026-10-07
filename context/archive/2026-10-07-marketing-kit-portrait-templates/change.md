---
change_id: marketing-kit-portrait-templates
title: "Portrait social templates in marketing-kit: a big number and a carousel slide"
status: archived
roadmap_item: MK-12
branch: claude/project-thread-b533bx
created: 2026-10-07
updated: 2026-10-07
archived_at: 2026-10-07
---

## Intent

An app that adopts `@softure-ai/marketing-kit` makes the static posts of a social series (Instagram feed, TikTok photo
mode, Facebook album) from its `marketing.json` with no design work: a **big-number** card whose number is the hero of
a 1080×1350 portrait frame, and a **carousel** template that renders a numbered run of slides ("1/6") from one entry
with a shared look. Both use the brand the kit already loads (colours, logo, fonts) and refuse copy that does not fit,
as the OG templates do.

## Context

Source: GitHub issue SOFTURE/AI#150 (filed by the owner 2026-10-07), from FIRE_TRACKER TR-27
(`context/marketing/social-strategia.md`, `social-bank-tresci.md`): three of FIRE's six social series are static
posts ("One number", "Myth or fact" as a 5-6 slide carousel, "Glossary in 30 seconds" as a 3-slide carousel), about
25 posts until 2026-12-31.

What FIRE measured on 0.1.7: `headline-cta` at `size: [1080, 1350]` renders without an error, but the copy sits in a
narrow band in the middle with empty space above and below, and the figures are small. Cause in the template code:
`src/og/templates/context.ts` scales every size by `width / 1200`, and `frame.ts` centres the content column, so a
taller frame adds only empty bands and a 1080-wide portrait draws the copy 10% smaller than the 1200×630 card.

## Constraints

- Owns: `tools/marketing-kit/src/og/` (templates, rendering of one slide), `src/config/schema.ts` and
  `schema/marketing.schema.json`, `src/cli/og.ts`, tests, the package README and `examples/`.
- Backward compatible: `headline-cta` and `headline-chart` at 1200×630 render byte for byte as in 0.1.7 (the
  committed snapshots stay unchanged).
- The brand stays the kit's: no new colour or font configuration; the same glyph checks apply.
- Copy limits are enforced by the schema: copy that would overflow is refused, not shrunk silently.
- Tests render through Satori/resvg locally; no network.
- The package version bumps (0.1.8); the owner publishes.
- FIRE_TRACKER is read only from this repo; its adoption is FIRE's own change.

## Notes

- Decision (auto): placement → **work now**, main roadmap `charts-followups`, ID **MK-12** (the issue suggests it;
  MK-11 is the last MK on `master`). Not a CF item: like MK-10 and MK-11, the request comes from FIRE's adoption, not
  from a gap found while delivering charts; an MK ID also cannot collide with CF numbers taken in parallel threads.
- Decision (auto): one entry of the `carousel` template produces N files `<id>-1.png`…`<id>-N.png` (research §3).
- Research done ([`research.md`](research.md)).
- Framing skipped: the problem, its cause in the code and the wanted outcome are measured and stated in the issue;
  what remains are design choices (carousel shape, size presets, a source line), settled in research and the plan.
- Archived 2026-10-07: `big-number` and `carousel` portrait templates, `size` presets, one file per carousel slide,
  an optional source line; `headline-cta` and `headline-chart` unchanged byte for byte. marketing-kit 0.1.8 waits for
  the owner's release. Closes issue #150.
