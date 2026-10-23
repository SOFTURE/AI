// The Next.js adapter of @softure-ai/connections: the page, its server actions, the OAuth callback route and
// request-scoped token reads (docs/02-module-standard.md §8).
export { disconnectAction, saveCredentialAction, startConnectionAction } from "./actions.js";
export { CONNECTED_PARAM, ERROR_PARAM, readPageNotice, type PageNotice } from "./notice.js";
export { getConnectionsContext } from "./context.js";
export { getConnectionsMessages } from "./messages.js";
export { ConnectionsPage, type ConnectionsPageProps } from "./pages.js";
export { toConnectionPanelRows } from "./panel-rows.js";
export { completeConnectionRoute } from "./route.js";
export { getAccessToken, getCredential, requestWithConnection } from "./tokens.js";
