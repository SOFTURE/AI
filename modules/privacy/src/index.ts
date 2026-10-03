// Public API of @softure-ai/privacy: the module factory for softure.config.ts, its types, messages
// and rate limit buckets. The registry, export and deletion are in `@softure-ai/privacy/server`,
// the Next.js adapter (page, export route, delete action) in `/next`, the delete form in `/ui`.
import { defineModule } from "@softure-ai/core";
import { privacyMessages } from "./messages/index.js";
import { privacyOptionsSchema } from "./options.js";

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
 * Enables the GDPR export and self-service account deletion in `softure.config.ts` (after
 * `auth({ ... })`): `privacy({ contributors: [{ id: "profile", exportUserData, deleteUserData }] })`.
 * Every enabled module with user data contributes its own part; `contributors` adds the app's.
 */
export const privacy = defineModule({
  manifest: {
    id: MODULE_ID,
    version: "0.0.0",
    dependsOn: { auth: "^0.0.0", security: "^0.0.0" },
    dbSchema: null,
    tables: [],
    env: [],
    switches: [],
    routes: { account: "/account/privacy", export: "/api/privacy/export", afterDelete: "/" },
    mount: [
      { kind: "page", path: "app/account/privacy/page.tsx", export: "PrivacyPage" },
      { kind: "route-handler", path: "app/api/privacy/export/route.ts", export: "exportRoute" },
    ],
    privacy: { exports: false, deletes: false },
  },
  messages: privacyMessages,
  options: privacyOptionsSchema,
});

export {
  INITIAL_DELETE_ACCOUNT_STATE,
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
  type AppPrivacyContributor,
  type PrivacyOptions,
  type PrivacyOptionsInput,
} from "./options.js";
