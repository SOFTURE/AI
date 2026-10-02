# @softure-ai/template-module

Template for a SOFTURE AI package. It follows the layout of
[docs/02-module-standard.md §2](../../docs/02-module-standard.md) and keeps the twelve README
sections of §11, so agents find the same things in the same places in every module.

**To start a package:** copy this folder to `modules/<name>/` (or `foundation/<name>/`), then
rename `template-module` everywhere (package name, `module.json` id, error codes), remove
`"private": true`, and run `npm install` at the repository root. The root tests check the result
(`tests/repo/packages.test.ts`). Add `"./styles.css"` to `exports` once the package has styles
(the CSS build arrives with `@softure-ai/ui`).

## 1. What it provides

One sentence: the capability this module gives an app.

## 2. Installation

```bash
npm install @softure-ai/template-module
```

## 3. Configuration

The full configuration type and an example `softure.config.ts` entry.

## 4. Mounting

Route handlers, pages and middleware the app mounts, one line each.

## 5. Migrations and tables

The Postgres schema, its tables and the migrations in `migrations/`.

## 6. Environment variables

Each variable, whether it is required, and what it does.

## 7. Switches

Runtime switches this module declares in `module.json`.

## 8. Appearance

Slots (`classNames`) per component and the `--sft-*` tokens they use.

## 9. Copy

Message keys in `src/messages/`, with complete `pl` and `en` dictionaries.

## 10. Hooks

Extension hooks the app may supply (`onRegistered`, `authorize`, ...).

## 11. GDPR

What the module exports and deletes for a user.

## 12. Limitations

Known gaps and what the module deliberately does not do.

## Build

`npm run build -w templates/package` runs `tsc -p tsconfig.build.json`: ESM and `.d.ts` per
source file in `dist/`, with `"use client"` and `"use server"` directives kept. In this repository
the export condition `@softure-ai/source` points tests and type checks at `src/`, so nothing needs
building first.
