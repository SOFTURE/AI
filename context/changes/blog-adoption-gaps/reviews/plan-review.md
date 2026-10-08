# Plan review: blog-adoption-gaps

Reviewed: plan.md against change.md, issue #228 and the code on master `a0dbf19`. Mode: autonomous (findings
decided by the reviewer, fixes applied to plan.md).

## Findings

### 1. Warning: 410 links could carry an unsafe scheme

- **Evidence:** `buildGonePage` escapes text but an `href` of `javascript:…` stays a working link after escaping.
- **Impact:** a config typo becomes a script link on a public page.
- **Fix:** accept only site paths (`/…`, not `//…`) and `https://` URLs in the schema; refuse anything else at
  startup. **Decision:** accepted, the plan already states "site paths or https URLs"; Phase 2 tests a refused
  `javascript:` href.

### 2. Warning: the precision test must not depend on the session time zone

- **Evidence:** the suite runs with `TZ=America/New_York`; `published_at::text` prints in the database session's zone,
  so a literal comparison would test the zone, not the precision.
- **Fix:** compare in SQL: `published_at = '<input>'::timestamptz` and `extract(microseconds …)`, which are zone
  independent. **Decision:** accepted; Phase 3's test uses an equality in SQL instead of a printed literal.

### 3. Suggestion: `ArticleHistory` change is breaking

- **Evidence:** `ArticleHistory` is exported from `/server`; `publishArticle(ctx, input, { history })` takes it.
- **Impact:** an app that builds a history by hand stops compiling. No known app does (the documented path is
  `parseArticleHistory` / `--history`).
- **Decision:** accepted as planned (0.1.x, CHANGELOG states it). Keeping a parallel `Date` field would be a bag of
  optional fields for one release.

### 4. Suggestion: JSON-LD builders and escaping

- **Evidence:** the pages inject `serializeJsonLd` output with `dangerouslySetInnerHTML`; `serializeJsonLd` escapes
  `<` so text cannot close the script.
- **Fix:** the builders return `serializeJsonLd` output, never raw JSON, and README shows the `<script>` mount.
  **Decision:** accepted; noted in the plan's decision 3 ("serialized `<script>` content").

### 5. Checked, no finding

- `externalMarker: "none"` keeps `target`/`rel`/class: the security part (`noopener`) does not depend on the marker.
- Quality paths: `getBlogRoutes` already normalizes trailing slashes, the same shape `sitePath` produces; a root
  listing (`/`) is handled by the resolver as before.
- Builders and pages share code, so the metadata cannot drift (Phase 2 compares them in tests).
- Scope: only `modules/blog`; no open PR touches it.

## Verdict

Ready for implementation with findings 1 and 2 folded into the phases' tests.
