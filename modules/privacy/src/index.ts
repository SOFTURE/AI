// Public API of @softure-ai/privacy: the module factory for softure.config.ts, its types, messages,
// rate limit buckets and the consents table. The registry, export, deletion and the consent ledger
// are in `@softure-ai/privacy/server`, the Next.js adapter (page, export route, delete action) in
// `/next`, the delete form and the legal document shell in `/ui`.
import { defineModule, resolveMigrationsDir } from "@softure-ai/core";
import { privacyMessages } from "./messages/index.js";
import { privacyOptionsSchema } from "./options.js";
import { privacyConsentsContributor } from "./server/consents-contributor.js";
import { checkConsentsTable } from "./server/health.js";

export const MODULE_ID = "privacy";

/**
 * Rate limit buckets privacy consumes, with defaults to spread into `security({ buckets })`, both
 * per user: `privacy-export` (downloads) and `privacy-delete` (deletion attempts, each one a
 * password check).
 */
export const PRIVACY_RATE_LIMIT_BUCKETS = {
  "privacy-export": { limit: 5, windowMinutes: 60 },
  "privacy-delete": { limit: 5, windowMinutes: 15 },
} as const;

/**
 * Enables the GDPR export, self-service account deletion and the consent ledger in
 * `softure.config.ts` (after `auth({ ... })`):
 * `privacy({ documents: [{ id: "terms", version: "2026-10-01" }], contributors: [{ id: "profile", exportUserData, deleteUserData }] })`.
 * Every enabled module with user data contributes its own part; `contributors` adds the app's.
 */
export const privacy = defineModule({
  manifest: {
    id: MODULE_ID,
    version: "0.1.5",
    dependsOn: { auth: "^0.1.0", security: "^0.1.0" },
    dbSchema: "privacy",
    tables: ["consents"],
    env: [],
    switches: [],
    routes: { account: "/account/privacy", export: "/api/privacy/export", afterDelete: "/" },
    mount: [
      { kind: "page", path: "app/account/privacy/page.tsx", export: "PrivacyPage" },
      { kind: "route-handler", path: "app/api/privacy/export/route.ts", export: "exportRoute" },
    ],
    privacy: { exports: true, deletes: true },
  },
  messages: privacyMessages,
  options: privacyOptionsSchema,
  migrations: { dir: resolveMigrationsDir(import.meta.url, "../migrations/") },
  privacy: privacyConsentsContributor,
  health: checkConsentsTable,
});

export {
  INITIAL_DELETE_ACCOUNT_STATE,
  type ConsentRecord,
  type ConsentState,
  type ConsentSubject,
  type DeleteAccountErrorCode,
  type DeleteAccountField,
  type DeleteAccountFormState,
  type PrivacyErrorCode,
  type PrivacyExport,
} from "./contract.js";
export { getPrivacyErrorMessage, privacyMessages, type PrivacyMessages } from "./messages/index.js";
export {
  CONTRIBUTOR_ID_PATTERN,
  DEFAULT_EXPORT_MAX_BYTES,
  DOCUMENT_VERSION_PATTERN,
  type AppPrivacyContributor,
  type LegalDocumentDeclaration,
  type PrivacyOptions,
  type PrivacyOptionsInput,
} from "./options.js";
export { consents, privacySchema } from "./schema.js";
