// Public API of @softure-ai/connections: the module factory for softure.config.ts, its types, messages and
// tables. Database and provider work is in `@softure-ai/connections/server`, the Next.js adapter (the page, its
// actions, the callback route, request-scoped token reads) in `/next`, the panel in `/ui`, a fake provider in
// `/testing` and the `softure-connections` command in `/cli`.
import { defineModule, resolveMigrationsDir } from "@softure-ai/core";
import { connectionsMessages } from "./messages/index.js";
import { connectionsOptionsSchema } from "./options.js";
import { checkConnectionsTables } from "./server/health.js";
import { connectionsPrivacyContributor } from "./server/privacy.js";

export const MODULE_ID = "connections";

/**
 * Enables connected accounts in `softure.config.ts` (after `auth({ ... })`, which guards the page):
 * `connections({ providers: [{ kind: "oauth", id: "google", ... }, { kind: "api_key", id: "raindrop" }] })`.
 */
export const connections = defineModule({
  manifest: {
    id: MODULE_ID,
    version: "0.3.1",
    dependsOn: { auth: "^0.2.0" },
    dbSchema: "connections",
    tables: ["accounts", "oauth_states"],
    env: [
      {
        name: "SOFTURE_CONNECTIONS_KEYS",
        required: true,
        description: "Encryption keyring for stored tokens and keys: <id>:<base64 32 bytes>[,<id>:<key>...], the first one seals",
      },
    ],
    switches: [],
    routes: { page: "/admin/connections", callback: "/api/connections/callback" },
    mount: [
      { kind: "page", path: "app/admin/connections/page.tsx", export: "ConnectionsPage" },
      { kind: "route-handler", path: "app/api/connections/callback/route.ts", export: "completeConnectionRoute" },
    ],
    privacy: { exports: true, deletes: true },
  },
  messages: connectionsMessages,
  options: connectionsOptionsSchema,
  migrations: { dir: resolveMigrationsDir(import.meta.url, "../migrations/") },
  privacy: connectionsPrivacyContributor,
  health: checkConnectionsTables,
});

export type {
  AccessToken,
  ConnectionFormState,
  ConnectionKind,
  ConnectionStatus,
  ConnectionsErrorCode,
  ConnectionsFlowErrorCode,
  ConnectionsFormErrorCode,
  ConnectionsKeyErrorCode,
  ConnectionsTokenErrorCode,
  ConnectionView,
  ReconnectReason,
  ReconnectRequiredEvent,
  StoredCredential,
} from "./contract.js";
export { connectionsMessages, getConnectionsErrorMessage, type ConnectionsMessages } from "./messages/index.js";
export {
  ACCOUNT_ID_PATTERN,
  DEFAULT_ACCOUNT_ID,
  DEFAULT_CREDENTIAL_HEADER,
  DEFAULT_CREDENTIAL_SCHEME,
  MAX_ID_LENGTH,
  PROVIDER_ID_PATTERN,
  type ConnectionsOptions,
  type ConnectionsOptionsInput,
  type CredentialHeaderPlacement,
  type KeyProviderDefinition,
  type OAuthProviderDefinition,
  type OnReconnectRequiredHook,
  type ProviderDefinition,
  type ProviderDefinitionInput,
} from "./options.js";
export { accounts, oauthStates } from "./schema.js";
