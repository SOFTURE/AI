---
change_id: deploy-bundle-banner-681
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and the package on master (627c69c).

- Scope covers every ask of the issue: the template's three banners, the README, a template test that bundles with
  observability 0.4.0 and runs `node --check`, and the observability CHANGELOG note.
- Correctness: the alias removes the only top-level binding the banner adds besides `require`; `require` is what the
  banner exists for and esbuild renames bundled locals that clash with it (seen in research), so it stays safe.
- Test: reading the banner from the rendered `Dockerfile` ties the test to the template; the "every command uses the
  same banner" case keeps migrate and ops covered without bundling each. The bundle runs in about 0.2 s.
- Compatibility: generated files change only in the banner; apps re-run `init --force` or edit their banners, which
  the README and CHANGELOG spell out.
- Risk: the new devDependency must not create a workspace cycle (observability depends on no SOFTURE package; checked).

Verdict: approved, no changes.
