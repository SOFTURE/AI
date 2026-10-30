---
change_id: marketing-kit-footage-worker-897
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and master (a27037f).

- Coverage of the issue: async spawns with `signal` and `onProgress` passed through `renderFootageFilm` (1, 2),
  partial files removed on abort (1), ffmpeg progress from `-progress pipe:1` (1), estimate in credits without
  normalize (3), `onCharge` with the provider's charge when reported (2), `findCachedStep` (3),
  `checkFootageTools` run by the CLI (4), container recipe used by CI (5).
- Shared cache-path helpers keep the estimate and the pipeline from drifting apart.
- Breaking: `probeFile`, `probeFootage`, `normalizeFootage` become async (0.x minor, released in the batch, noted in
  the CHANGELOG). Provider interfaces stay compatible (a plain `Buffer` is still accepted).
- Risk: the container job's image build time and Debian package names; mitigated by basing it on hyperframes' own
  Dockerfile.

Verdict: approved, no changes.
