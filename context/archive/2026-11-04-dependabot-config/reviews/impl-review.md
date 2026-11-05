# Implementation review: dependabot-config

Verdict: approved.

- `.github/dependabot.yml` matches the plan: npm from `/` with a minor-and-patch group and a security group,
  `@softure-ai/*` ignored, limit 3; GitHub Actions for `/` and `/.github/actions/*` in one group; Docker for both
  Dockerfile folders, monthly, majors ignored; every entry `chore(deps)`.
- The repository test reads the tree, not a fixed list: a new Dockerfile or composite action fails it until the file
  covers it, and the `.tmpl` templates are not taken for Dockerfiles.
- Dependabot pull requests get no Actions secrets; the only secret the gates read (`STRIPE_SECRET_KEY`) makes its
  tests skip when empty, so they stay green. `AGENTS.md` says so.
- Gates: typecheck, lint and language green; `tests/repo` green.
