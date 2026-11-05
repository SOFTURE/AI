# Plan review: dependabot-config

Verdict: approved.

- Scope matches `change.md`: the three ecosystems, grouping, a pull request limit, the commit prefix, a repository
  test and the `AGENTS.md` note.
- CI load: at most one grouped npm pull request, one Actions pull request and up to three single major bumps a week,
  plus monthly Docker updates; within "a few runs a week".
- The test guards drift: a new Dockerfile or composite action that the file does not cover fails `npm test`.
