# Plan review: llm-embeddings-pglite-extensions

Verdict: approved, no blocking findings.

- Checked: `embedMany` splits by `maxEmbeddingsPerCall` and retries only `APICallError`s marked retryable, so the
  adapters decide retryability (408, 429, 5xx, network, a throwing binding) and a 401 fails at once.
- Checked: PGlite's `loadDataDir` copies need the same `extensions` as the template, or a query on a `vector` column
  of a copy fails; the plan passes them to both.
- Suggestion (accepted): validate vector length against `dimensions`, so a misconfigured model never writes vectors a
  fixed-size column refuses later, with a clearer code.
- Suggestion (accepted): the template name of the run-wide store includes the extension names only when there are
  some, so existing stored templates keep their names.
