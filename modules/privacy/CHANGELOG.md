# Changelog

Newest first. Each version lists what changed for an app that uses `@softure-ai/privacy`. When an app has run a version in
production, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done"). Versions before the first one below are described in their GitHub Releases (`privacy@x.y.z`).

## 0.1.10

- The export file name's day (`account-data-YYYY-MM-DD.json`) comes from `toCalendarDay` in `@softure-ai/core`
  instead of a local `en-CA` formatter. Same names; requires `@softure-ai/core` `^0.1.7` (#270).

## 0.1.9

- `copyAccount({ from, to, userId, commit?, exclude?, include?, onMissingReference? })` in `/server` copies one account
  with every row it owns from one database to another. The rows are found through foreign keys (CASCADE, RESTRICT or
  NO ACTION, transitively, from `auth.users`), plus the account's email-keyed consents, so module and app tables need
  no list. Values travel as text with their types (a `timestamptz` keeps its microseconds, NULL stays NULL); the copy
  is verified against the target and is a dry run unless `commit: true`. Refusals return `{ error, detail }` and write
  nothing (README section 11).
- `LegalFooter` takes `as="p"` or `as="span"`: an inline form for a line of text inside the app's own footer or form,
  with the links and separators as inline content (no `nav`, `ul` or `li`), the separator read as text (default
  `" · "`) and the `note` as a `span` after the links. The list form stays the default.
- `LegalDocument` names its contents navigation by an id from `useId()`, so two documents on one page no longer share
  `legal-contents-title`. `changesId` sets the change history anchor (default `legal-changes`), and `as` sets the root
  element (`article` default, `div`, `section`).

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
