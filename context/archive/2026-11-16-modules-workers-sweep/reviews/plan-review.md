# Plan review: modules-workers-sweep

- **Warning (accepted, fixed in plan):** allowing `node:fs` weakens the guard for future code. Mitigation: the
  comment states the virtual-disk semantics, docs/07 states the rule "no app files on the request path", and the two
  readers on a request path get Workers tests. Splitting tooling exports into new subpaths would break apps.
- **Warning (accepted):** a module whose request entry reaches `jobs` is left undeclared, so the matrix must say
  "after RP-4" for those entries, not "yes".
- **Suggestion (accepted):** pwa throwing on Workers without `SOFTURE_BUILD_VERSION` is a behaviour an app sees; the
  CHANGELOG names the variable and RP-8's deploy sets it.
- Verdict: ready to implement.
