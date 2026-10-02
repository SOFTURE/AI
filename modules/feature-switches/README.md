# @softure-ai/feature-switches

**Status:** wave 1 · not implemented · depends on: core, db, ui, auth

A registry of switches declared by the application and by modules (name, label, description, default value,
`failMode: open|closed`, environment override), `isEnabled(name)`, `setSwitch`, and a generic admin
panel listing every switch, protected by **`authorize` (admin role)**.

**Tables:** `features.switches(name, enabled, updated_at, updated_by*)`

**Source in FIRE_TRACKER:** `src/db/feature-switches.ts`, `src/app/actions/{switches,manage-switches,switches-contract}.ts`,
`src/components/switch-manager.tsx`, `src/app/(app)/przelaczniki/`.

> The panel and the toggle action require an admin authorization hook; the module refuses to mount them without one.

\* new
