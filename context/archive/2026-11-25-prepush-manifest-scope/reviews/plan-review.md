# Plan review: prepush-manifest-scope

Verdict: approve. The narrowed local scope is exactly the scope the pull request's CI test job runs, so nothing that
CI would test is skipped before the push; shared root files, root tools in the lockfile and any failure still run the
full suite. The published preset stays unchanged, which keeps apps without CI scoping safe. Explicit paths avoid
Vitest's package.json rerun trigger.
