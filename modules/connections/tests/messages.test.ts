import { connectionsMessages, getConnectionsErrorMessage, type ConnectionsFormErrorCode } from "@softure-ai/connections";
import { describe, expect, it } from "vitest";

// Every code a page, an action or a stored `last_error` can carry.
const CODES: ConnectionsFormErrorCode[] = [
  "connections.key_missing",
  "connections.key_invalid",
  "connections.key_unknown",
  "connections.secret_unreadable",
  "connections.unknown_provider",
  "connections.wrong_kind",
  "connections.not_connected",
  "connections.reconnect_required",
  "connections.refresh_failed",
  "connections.refresh_in_progress",
  "connections.client_rejected",
  "connections.provider_not_configured",
  "connections.state_invalid",
  "connections.consent_denied",
  "connections.authorization_failed",
  "connections.exchange_failed",
  "connections.credential_invalid",
  "auth.forbidden",
  "core.database_failed",
  "core.unexpected",
];

describe("connections messages", () => {
  it("have their own English copy for every code of the module", () => {
    for (const code of CODES) {
      const message = getConnectionsErrorMessage(connectionsMessages.en, code);
      expect(message, code).not.toBe("");
      expect(message === connectionsMessages.en.errors.core.unexpected, code).toBe(code.startsWith("core."));
    }
  });

  it("fall back to the generic failure for a code they do not know", () => {
    expect(getConnectionsErrorMessage(connectionsMessages.en, "connections.something_new")).toBe(connectionsMessages.en.errors.core.unexpected);
    expect(getConnectionsErrorMessage(connectionsMessages.en, "auth.toString")).toBe(connectionsMessages.en.errors.core.unexpected);
  });

  it("ship English as the only built-in language, with a label for every status", () => {
    expect(Object.keys(connectionsMessages)).toEqual(["en"]);
    expect(Object.keys(connectionsMessages.en.status)).toEqual(["connected", "expiring", "reconnect_required", "not_connected"]);
  });
});
