---
change_id: marketing-kit-overlay-polish
title: "marketing-kit: centred overlays on the frame's axis, chips as a countdown, the note centred by default"
status: archived
roadmap_item: null
issue: null
branch: claude/marketing-kit-overlay-polish
created: 2026-11-16
updated: 2026-11-16
---

## Intent

An adopting app's owner reviewed a draft and found every centred overlay (a place card, a title bar, a row of chips)
sitting left of the frame's middle while the captions were centred, in the draft, the render and the app's previews.
The chips ("where? / how long? / risks?") looked plain: three identical pills that do not say which point is being
talked about; they should read as a countdown of the points as they are said. The paper note with a tick sat in a
corner by default.

## Context

- Measured on the owner's screenshots: the cards' centre about 4 % of the width left of the frame's centre. Cause:
  `placeCard`, `placeEndWord` and `placeChipRow` centred inside the platform safe zone (`CAPTION_SAFE_ZONES`, left 60,
  right 120 to 150), whose middle is left of the frame's; the captions take the wider side on both edges.
- Lists already time their points (`item_words`, `item_at`, `stagger`); chips entered in turn only when asked.

## Constraints

- Nothing that fitted before may be refused (an app's stored cuts must keep drafting).
- Draft (ASS) and render (HTML) stay alike; the motion stays calm, as a human editor would cut it.

## Notes

- Frame skipped: the cause was measured and the owner named the outcome.
