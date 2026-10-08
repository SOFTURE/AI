# Changelog

Newest first. Each version lists what changed for an app that uses `@softure-ai/privacy`. When an app has run a version in
production, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done"). Versions before the first one below are described in their GitHub Releases (`privacy@x.y.z`).

## 0.1.8

- `importConsent(ctx, { ...RecordConsentInput, recordedAt, documentVersion? })` records a consent or withdrawal given
  before the app adopted the ledger: at a past time (not after now) and, optionally, to an older document version,
  which `hasConsent` reads as not current.

## 0.1.7

- `LegalDocument` fits a page frame that owns the title: `title` is optional (no `<h1>` without it), and the meta line
  is either `version` + `effectiveFrom` as before or the app's own `meta` node (`meta={null}` for none). The `<header>`
  renders only when it has content.
- Change history entries may leave out `version` and `date`; the entry is then its summary alone.
- `LegalDocument` takes `contentsTitleAs` (`h2`, `h3`, `p`) and `listChangesInContents`, and wraps the sections and
  the history in a new `body` slot (one more `div`; the default classes keep the spacing), so the contents can sit in
  a side column.
- `LegalFooter` takes `as` (`footer`, `div`, `nav`) to fit inside the app's own footer, and an optional `separator`
  between links (new `separator` slot).

## 0.1.6

- Adapters use the configured database handle; `@softure-ai/ui` is a peer dependency.
