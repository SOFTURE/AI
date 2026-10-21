// The page's rows: every line in the app's copy, dates in the app's time zone, secrets nowhere.
import { connectionsMessages, type ConnectionView } from "@softure-ai/connections";
import { toConnectionPanelRows } from "@softure-ai/connections/next";
import { describe, expect, it } from "vitest";
import { createConfig, KEY_PROVIDERS, NOW } from "./support.js";

const en = connectionsMessages.en;
const config = createConfig([
  { kind: "oauth", id: "google", label: { en: "Google" }, authorizeUrl: "https://a.example/auth", tokenUrl: "https://a.example/token", clientId: "c", accounts: ["default", "work"] },
  ...KEY_PROVIDERS,
]);

const BASE: ConnectionView = {
  provider: "google",
  accountId: "default",
  kind: "oauth",
  label: "Google",
  status: "connected",
  scopes: ["mail.read", "calendar"],
  expiresAt: new Date("2026-10-21T13:00:00Z"),
  refreshExpiresAt: null,
  connectedAt: NOW,
  connectedBy: "u",
  refreshedAt: null,
  lastError: null,
  lastErrorAt: null,
};

describe("toConnectionPanelRows", () => {
  it("describes a connected OAuth account", () => {
    expect(toConnectionPanelRows([BASE], en, config)).toEqual([
      {
        provider: "google",
        accountId: "default",
        kind: "oauth",
        label: "Google",
        status: "connected",
        statusLabel: "Connected",
        details: ["Connected on Oct 21, 2026, 2:00 PM", "Not refreshed yet", "Access token expires on Oct 21, 2026, 3:00 PM", "Granted scopes: mail.read, calendar"],
        lastError: null,
        hint: null,
      },
    ]);
  });

  it("names a non-default account, the last problem and the refresh dates", () => {
    const [row] = toConnectionPanelRows(
      [{ ...BASE, accountId: "work", status: "expiring", scopes: [], refreshedAt: NOW, refreshExpiresAt: NOW, lastError: "connections.refresh_failed", lastErrorAt: NOW }],
      en,
      config,
    );
    expect(row?.statusLabel).toBe("Expiring");
    expect(row?.details).toEqual([
      "Account: work",
      "Connected on Oct 21, 2026, 2:00 PM",
      "Last refresh on Oct 21, 2026, 2:00 PM",
      "Access token expires on Oct 21, 2026, 3:00 PM",
      "Refresh token expires on Oct 21, 2026, 2:00 PM",
      "No scopes granted",
    ]);
    expect(row?.lastError).toBe("Last problem on Oct 21, 2026, 2:00 PM: Refreshing the access failed. It will be retried.");
  });

  it("gives a key provider its hint and no details before it is connected", () => {
    const [row] = toConnectionPanelRows([{ ...BASE, provider: "raindrop", kind: "api_key", label: "Raindrop", status: "not_connected", scopes: [], expiresAt: null, connectedAt: null }], en, config);
    expect(row).toMatchObject({ details: [], hint: "Settings, Integrations, Test token.", statusLabel: "Not connected" });
  });
});
