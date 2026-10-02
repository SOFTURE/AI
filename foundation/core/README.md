# @softure-ai/core

**Status:** wave 0 · not implemented

The contract every module stands on:
- `defineSoftureConfig`: application configuration validated with zod;
- `defineModule`: manifest, dependencies, migrations, routes, switches, GDPR contributors;
- `Result<T, ErrorCode>`;
- `Clock` (injected `now`);
- i18n (dictionaries + partial overrides, `locale`, `timezone`);
- `safeError`.

The `next/` subfolder holds the configuration registry for server actions and `createSoftureHandlers`.

**Source in FIRE_TRACKER:** the `database?`/`now` convention (`src/app/actions/architecture.test.ts`),
`src/lib/safe-error.ts`, `src/lib/plural.ts`.
Standard: [docs/02-module-standard.md](../../docs/02-module-standard.md).
