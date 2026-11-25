# Implementation review: prepush-manifest-scope

Verdict: approve. Matches the plan: `getPushTestScope` keeps the related run for ordinary changes and, for a full-suite
file, takes `getTestScope` of `scripts/ci/affected.mjs` with the lockfile reach read from the merge base, so the local
gate runs what the pull request's CI test job runs. A shared root file, a repository tool in the lockfile, an
unreadable lockfile or a git error still run the whole suite. The git read of the base lockfile has a large enough
buffer (the default 1 MB would have failed and fallen back to the full suite). The published preset is untouched.
