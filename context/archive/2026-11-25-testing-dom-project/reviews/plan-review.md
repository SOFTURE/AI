# Plan review: testing-dom-project

Verdict: approve. The split by file name is the issue's proposal and the only one that survives `mergeConfig`
concatenating `include`: the research measured that a project's own `include` cannot narrow the inherited one, and
that the extension-anchored extglob in `exclude` does, without pruning folders. The default path (`dom` unset) keeps
the config byte for byte, so no app changes. The acceptance (Enter, arrows, Escape, focus) is checked by a real Vitest
run of a scratch app, not by the config shape alone. Optional peers keep the install of apps without DOM tests as it is.
