# Plan review: release-stage-tarball-path

Date: 2026-10-05 · Verdict: approved

- Cause reproduced locally with the same npm spec parsing; the fix is the documented local-path form.
- Later jobs checked for the same pattern: GitHub Packages publishes `./unpacked/package`, the GitHub
  Release passes the path to `gh`, which takes plain paths. Only the stage command needed it.
