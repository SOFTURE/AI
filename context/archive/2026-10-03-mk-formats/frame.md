# Frame: mk-formats

Input: change.md, research.md. Shape: scope (an unknown that decides what is built).

## Request as stated

> `format` per video: `9:16`, `1:1` or `16:9`. Frame size, device viewport placement, camera targets and
> caption layout come from a geometry table, not constants. The end card and persona card adapt per format.
> Unknowns: whether 16:9 needs a desktop viewport recording or a framed phone.

## Observation, premise, direction

- Observation: the kit renders 9:16 only; feeds and YouTube/LinkedIn want 1:1 and 16:9.
- Premise: the same film (script, scene, recording, voiceover) can be laid out in another frame.
- Direction: a per-format geometry table read by the composition.

## Premise check

Holds for a framed phone: the composition places a recorded phone screen and moves a camera over it;
nothing in the recording depends on the frame (camera scales in the log are relative to the phone,
`record.ts:288-310`). It does not hold for a desktop 16:9 video: that is a different recording.

## Framings

1. **Framed phone in every format** (geometry table in `compose/`). One recording, three outputs; the
   phone shrinks to fit 1:1 and sits left in 16:9 with copy on the right. Cost: small, compose only.
2. **Desktop recording for 16:9.** A second recording per film with a desktop viewport and a browser
   frame instead of a phone. Cost: record changes (MK-3's area), desktop scenes per project, a second
   voiceover timing. Value only for products whose story is the desktop app.
3. **Geometry in `marketing.json`.** Let a project override the table. Nobody asked for it yet; the
   table can be exposed later without breaking the contract.

## Decision

Framing 1. The roadmap row says "geometry from config"; the item outcome says "a geometry table, not
constants", which framing 1 delivers. A desktop recording (framing 2) and a configurable table
(framing 3) go to the followups roadmap as gaps, not into this change.
