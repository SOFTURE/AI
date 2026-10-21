# @softure-ai/connections

Connected accounts for a Next.js app that acts on behalf of its owner's own accounts at other services (a
mailbox, a calendar, a task manager, a time tracker, a code host). The app becomes an OAuth 2.0 **client** of
their APIs, or keeps their API keys, without writing the fragile parts again: the authorization code flow with a
one-time state and PKCE, encrypted storage, refresh before expiry without double refreshes, and a clear "needs
reconnect" state when a grant dies. It is the opposite direction of `@softure-ai/mcp-access`, which is an OAuth
server for clients that call the app.

## 1. What it provides

- **Providers from configuration**, three kinds: `oauth` (authorization code flow), `api_key` and `basic` (pasted
  by an admin). Each has one account (`default`) or several (`["work", "personal"]`).
- **A connect flow for Next.js**: the admin-only page `ConnectionsPage` lists every provider account with its
  status, last refresh, granted scopes, expiry and last problem, with connect / reconnect / disconnect buttons and
  key forms; `startConnectionAction` sends the browser to the provider; `completeConnectionRoute` is the callback.
- **Encrypted storage**: tokens, keys and the PKCE verifier are sealed with AES-256-GCM under the keyring in
  `SOFTURE_CONNECTIONS_KEYS`; each row stores its key id for rotation, and the ciphertext is bound to its row.
  Plaintext never reaches the database, a log line, an error code or the browser.
- **`getAccessToken(ctx, { provider, accountId? })`**: a `Result` with a usable token. Close to expiry it refreshes
  under the row's lease (two workers never spend one refresh token twice; the others wait and read the new token).
  `invalid_grant` becomes the terminal `connections.reconnect_required`; network failures, 429, 5xx and odd answers
  are the retryable `connections.refresh_failed`.
- **`getCredential`** for API keys and Basic, **`reportCredentialRejected`** when the app saw a 401, and
  **`getAuthorizationHeader`** for either.
- **`onReconnectRequired`**, a hook that runs once when a connection needs reconnecting, so the app can alert the
  owner (e.g. by mail through `@softure-ai/mailing`).
- A **privacy contributor**, a **health check**, the **`softure-connections`** command (`key`, `rotate-keys`) and a
  **fake OAuth provider** for tests (`@softure-ai/connections/testing`).

Provider-specific API clients are out of scope: the app calls the API with the token, for example through
`requestJson` of `@softure-ai/core`.

## 2. Installation

```bash
npm install @softure-ai/connections @softure-ai/auth @softure-ai/security @softure-ai/core @softure-ai/db @softure-ai/ui drizzle-orm
```

Peer dependencies: `next` 16, `react` 19, `drizzle-orm`, `@softure-ai/ui`. The module depends on `auth` (and auth
on `security`): a configuration without them fails at startup, so the page is never mounted without a role check.

## 3. Configuration

```ts
import { connections } from "@softure-ai/connections";

// in defineSoftureConfig({ modules: [...] }), after security(...) and auth(...):
connections({
  providers: [
    {
      kind: "oauth",
      id: "google",
      label: { en: "Google (Gmail, Calendar)" },
      authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      revokeUrl: "https://oauth2.googleapis.com/revoke",
      scopes: ["https://www.googleapis.com/auth/gmail.modify", "https://www.googleapis.com/auth/calendar"],
      clientIdEnv: "GOOGLE_CLIENT_ID",
      clientSecretEnv: "GOOGLE_CLIENT_SECRET",
      // Google issues a refresh token only with these.
      authorizeParams: { access_type: "offline", prompt: "consent" },
      // An app in "testing" mode: Google drops refresh tokens after 7 days.
      refreshTokenMaxAgeDays: 7,
    },
    {
      kind: "oauth",
      id: "github",
      authorizeUrl: "https://github.com/login/oauth/authorize",
      tokenUrl: "https://github.com/login/oauth/access_token",
      scopes: ["repo"],
      scopeSeparator: " ",
      clientIdEnv: "GITHUB_CLIENT_ID",
      clientSecretEnv: "GITHUB_CLIENT_SECRET",
    },
    { kind: "api_key", id: "raindrop", label: { en: "Raindrop" }, hint: { en: "Settings, Integrations, Create test token." } },
    { kind: "basic", id: "toggl", accounts: ["work", "personal"] },
  ],
  onReconnectRequired: async (event, ctx) => {
    // e.g. sendMail(ctx, { to: owner, subject: `Reconnect ${event.provider}` ... })
  },
}),
```

| Option | Type | Default | Meaning |
| --- | --- | --- | --- |
| `providers` | `ProviderDefinition[]` | `[]` | The services the app connects to. |
| `providers[].kind` | `"oauth"` \| `"api_key"` \| `"basic"` | required | How the app authenticates there. |
| `providers[].id` | `string` | required | kebab-case, at most 64 characters; unique. |
| `providers[].label` | `{ en?, <locale>? }` | the id | The page's name for it. |
| `providers[].accounts` | `string[]` | `["default"]` | The accounts the app keeps at this provider (`[a-z0-9][a-z0-9_-]*`). |
| `providers[].authorizeUrl`, `tokenUrl` | `string` | required (oauth) | https, or http on localhost (an emulator). |
| `providers[].revokeUrl` | `string` | none | RFC 7009 endpoint, called best effort on disconnect. |
| `providers[].scopes` | `string[]` | `[]` | Requested scopes. |
| `providers[].scopeSeparator` | `" "` \| `","` | `" "` | How the scopes are joined in the authorize URL. |
| `providers[].clientId` / `clientIdEnv` | `string` | one required (oauth) | The client id, or the variable that holds it. |
| `providers[].clientSecretEnv` | `string` | none | The variable that holds the client secret; omit for a public client (then `pkce` must stay on). |
| `providers[].clientAuth` | `"body"` \| `"basic"` | `"body"` | Client credentials in the token request's form, or as HTTP Basic. |
| `providers[].authorizeParams` | `Record<string, string>` | `{}` | Extra authorize parameters; the ones the module sets (`state`, `scope`, …) are refused. |
| `providers[].pkce` | `boolean` | `true` | PKCE S256. |
| `providers[].rotatesRefreshToken` | `boolean` | `false` | The provider spends a refresh token on use; a refresh answer without a new one then ends the grant when its access token expires. |
| `providers[].refreshTokenMaxAgeDays` | `number` | none | Shows the connection as expiring before a refresh token the provider will drop (when the provider does not send `refresh_token_expires_in`). |
| `providers[].hint` | `{ en?, <locale>? }` | none | (api_key, basic) Where the admin finds the key. |
| `panelRole` | `string` | `"admin"` | The auth role that opens the page, connects and disconnects. |
| `refreshSkewSeconds` | `number` | `300` | A token this close to expiry is refreshed before it is handed out. |
| `expiringWithinHours` | `number` | `72` | A grant that dies within this many hours shows as expiring. |
| `refreshLeaseSeconds` | `number` | `30` | How long one worker holds a connection's refresh; must exceed `httpTimeoutMs`. |
| `refreshWait` | `{ attempts, intervalMs }` | `{ 40, 250 }` | How a caller waits while another worker refreshes. |
| `stateTtlMinutes` | `number` | `10` | How long an authorization may take, button to callback. |
| `httpTimeoutMs` | `number` | `10000` | Timeout of a token, exchange or revoke call. |
| `onReconnectRequired` | `(event, ctx) => void \| Promise<void>` | none | Section 10. |
| `fetch` | `FetchFunction` | global `fetch` | The token client's `fetch`; tests pass the fake provider's. |
| `routes` | `{ page, callback }` | `/admin/connections`, `/api/connections/callback` | Where the page and the callback are mounted. |
| `messages` | partial dictionaries per locale | built in | Copy overrides (section 9). |

**Register the redirect URI** `<appOrigin><routes.callback>` (by default
`https://your.app/api/connections/callback`) with every OAuth provider. It is built from `appOrigin` of the config,
never from a request header.

## 4. Mounting

```ts
// app/admin/connections/page.tsx: the page. Not found for anyone without panelRole, signed in or not.
export { ConnectionsPage as default } from "@softure-ai/connections/next";
export const dynamic = "force-dynamic";
```

```ts
// app/api/connections/callback/route.ts: the OAuth callback; it answers 303 to the page.
export { completeConnectionRoute as GET } from "@softure-ai/connections/next";
```

The connect, key and disconnect buttons are server actions, registered when the page imports them: nothing more to
mount. An app with its own page shell composes the same parts:

```tsx
import { requireRole } from "@softure-ai/auth/next";
import { disconnectAction, getConnectionsContext, getConnectionsMessages, saveCredentialAction, startConnectionAction, toConnectionPanelRows } from "@softure-ai/connections/next";
import { listConnections } from "@softure-ai/connections/server";
import { ConnectionsPanel } from "@softure-ai/connections/ui";

const views = await listConnections(await getConnectionsContext(config));
<ConnectionsPanel
  rows={toConnectionPanelRows(views, getConnectionsMessages(config), config)}
  actions={{ start: startConnectionAction, save: saveCredentialAction, disconnect: disconnectAction }}
  messages={getConnectionsMessages(config)}
/>;
```

**Using a connection** from server code:

```ts
import { getAccessToken } from "@softure-ai/connections/next"; // or /server with your own ctx (a job, a script)
import { requestJson } from "@softure-ai/core";

const token = await getAccessToken({ provider: "google" });
if (!token.ok) return token; // connections.reconnect_required is terminal; refresh_failed and refresh_in_progress retry
const inbox = await requestJson({
  url: "https://gmail.googleapis.com/gmail/v1/users/me/messages",
  headers: { authorization: `Bearer ${token.value.accessToken}` },
});
if (!inbox.ok && inbox.status === 401) await reportCredentialRejected(ctx, { provider: "google" });
```

`getCredential({ provider: "raindrop" })` answers `{ kind: "api_key", apiKey }` or `{ kind: "basic", username,
password }`; `getAuthorizationHeader(credential)` turns either (or `{ kind: "oauth", accessToken }`) into the header.

The server functions in `/server` take `{ db, clock, config, env? }`; `env` defaults to `process.env` (the keyring
and the client secrets), so a worker outside Next builds the context the same way as `getConnectionsContext` does.

## 5. Migrations and tables

Schema `connections`, one migration (`0001_create_accounts_and_states.sql`):

- `accounts`: one row per provider account: `kind`, `status` (`connected` or `reconnect_required`), `key_id`,
  `credentials` (the sealed payload), `token_type`, `scopes`, `has_refresh_token`, `expires_at`,
  `refresh_expires_at`, `connected_at`, `connected_by` (auth user id, no foreign key), `refreshed_at`, `last_error`
  (a code) and `last_error_at`, and the refresh lease (`lease_id`, `lease_until`). Unique on
  `(provider, account_id)`; checks on every enum, id shape and pair of columns.
- `oauth_states`: authorizations in flight: the state's sha256 (never the state), the sealed PKCE verifier, the
  admin who started it and an expiry. One-time; expired rows go when a new authorization starts.

`softure migrate` applies it with the other modules (after auth).

## 6. Environment variables

| Variable | Required | What it does |
| --- | --- | --- |
| `SOFTURE_CONNECTIONS_KEYS` | yes, at runtime | The keyring: `<id>:<base64 of 32 bytes>[,<id>:<key>…]`. The first key seals; every listed key opens. |
| the providers' `clientIdEnv` / `clientSecretEnv` | for each OAuth provider | Read when a flow or a refresh needs them; a missing one shows on the page as `connections.provider_not_configured`. |

None of them is read at build time, so `next build` runs without them.

**Make a key:** `npx softure-connections key 2026q4` prints `2026q4:<key>`; store it as a secret.

**Rotate a key:** put the new entry first (`new:<key>,old:<key>`), deploy, run
`npx softure-connections rotate-keys` (a dry run that counts) and then `rotate-keys --commit`, which re-seals every
connection under the new key and drops authorizations in flight. When it reports nothing left, remove the old
entry. A connection whose key is no longer in the keyring answers `connections.key_unknown` and needs a reconnect.
Apps whose config Node cannot load directly use `runConnectionsCli` from `@softure-ai/connections/cli` in a script,
like `softure-mcp`.

## 7. Switches

None.

## 8. Appearance

`ConnectionsPanel` (`@softure-ai/connections/ui`) takes `classNames` for the slots `root`, `notice`, `list`, `item`,
`header`, `title`, `status`, `details`, `detail`, `hint`, `actions` and `empty`, and `unstyled`. It is built from
`@softure-ai/ui` (`Button`, `TextField`, `PasswordField`, `FormError`, and `Card` on the page) and uses only its
`--sft-*` tokens: the status reads `success` when connected, `warning` when expiring, `danger` when it needs a
reconnect. The module ships no CSS of its own; import `@softure-ai/ui/styles.css` as for every module.

## 9. Copy

`src/messages/en.ts`: `page` (title, lead, empty, connected notice), `status` (one label per status), `details`
(the lines under each account), `actions`, `fields`, and `errors` per code (`errors.connections.*`, `auth.forbidden`,
`core.*`). Override keys per locale with `connections({ messages: { en: { page: { title: "Accounts" } } } })`, or
pass a whole translation under another locale. `getConnectionsErrorMessage(messages, code)` gives the copy for a
code, the generic failure for an unknown one.

## 10. Hooks

`onReconnectRequired(event, ctx)` runs after `reconnect_required` is stored for a connection that was connected,
once per transition (the next calls answer the code without running it again). `event` is
`{ provider, accountId, kind, reason, at }` with `reason`:

- `invalid_grant`: the provider refused the refresh token (consent revoked, a testing-mode app's 7-day limit, a
  rotated token reused);
- `expired`: the access token expired and there is no refresh token;
- `rejected`: the app called `reportCredentialRejected` (a 401 from the API).

A hook that throws is logged by error kind and never fails the call; the state is stored either way. A new connect
(or a new key) brings the connection back to `connected`.

## 11. GDPR

A connection belongs to the app (the owner's account elsewhere), not to the admin who clicked connect.

- **Export**: the connections the user made (`provider`, `accountId`, `connectedAt`) and their pending
  authorizations. Never a token or a key.
- **Delete**: clears the user from `connected_by` and keeps every connection; deletes the user's pending
  authorizations. `exportConnectionsUserData` and `deleteConnectionsUserData` take `{ db }` only.

## 12. Limitations

- No provider-specific API clients; the app calls the API with the token.
- Only the authorization code flow (with or without PKCE). No device flow, no client credentials grant, no OpenID
  Connect ID token checks: the module stores what the token endpoint answers.
- One redirect URI for every provider (`appOrigin` + `routes.callback`).
- `getAccessToken` waits for another worker's refresh by polling (`refreshWait`); a caller that cannot wait sets
  `attempts: 0` and handles `connections.refresh_in_progress` as retryable.
- Revocation on disconnect is best effort: the connection is deleted even when the provider does not answer.
- A refresh that outlives its lease (a provider slower than `refreshLeaseSeconds`) still answers the new token but
  does not store it; keep `httpTimeoutMs` well under the lease (startup refuses a lease shorter than the timeout).

## Testing an app with it

```ts
import { createFakeOAuthProvider, createTestKeyring } from "@softure-ai/connections/testing";

const fake = createFakeOAuthProvider({ rotatesRefreshToken: true });
// connections({ providers: [fake.definition], fetch: fake.fetch }), ctx.env = { ...createTestKeyring(), ...fake.env }
const started = await startAuthorization(ctx, { provider: "fake", actorId });
const callback = fake.consent(started.value.url); // the user clicks "Allow"
await completeAuthorization(ctx, { params: { state: callback.searchParams.get("state"), code: callback.searchParams.get("code"), error: null }, actorId });
fake.revokeGrant(); // the next refresh answers invalid_grant
fake.failNext("unavailable", "rate_limited"); // the next token calls fail
```

## Build

`npm run build -w modules/connections` runs `tsc -p tsconfig.build.json`. Releasing:
[scripts/release/README.md](../../scripts/release/README.md).
