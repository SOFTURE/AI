---
change_id: marketing-kit-render-disk-1014
verdict: approved
---

# Plan review: marketing-kit-render-disk-1014

- Covers the four asks: the tool check, the render check before the paid and slow steps, the docs, the `tempDir`
  option.
- Correctness: the threshold and the measurement match hyperframes' `checkDisk`, so the kit never refuses a render
  hyperframes would run, and an unreadable `statfs` passes as it does there.
- Ordering: the render check runs before `getMusic`, so a low disk never costs a music purchase.
- Compatibility: new optional options only; a machine with room behaves as before.
- Overlap with #1012: different functions of `pipeline.ts`; `index.ts`, README and CHANGELOG conflicts are additive.
- Approved without changes.
