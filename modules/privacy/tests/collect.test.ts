// The export: every contributor's part for one user, in one file, without secrets, bounded in size.
import { err, ok } from "@softure-ai/core";
import { collectUserData } from "@softure-ai/privacy/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createConfig, createTestPrivacy, NOW, profileContributor, seedUser, type SeededUser, type TestPrivacy } from "./support.js";

describe("collectUserData", () => {
  let test: TestPrivacy;
  let ada: SeededUser;
  let bob: SeededUser;

  beforeEach(async () => {
    test = await createTestPrivacy();
    ada = await seedUser(test, "ada@example.com");
    bob = await seedUser(test, "bob@example.com");
  });
  afterEach(async () => {
    await test.database.close();
    vi.restoreAllMocks();
  });

  it("holds every contributor's part of the user's data, under its id, in export order", async () => {
    const result = await collectUserData(test.ctx, ada.id);
    if (!result.ok) throw new Error(result.error);
    const { document } = result.value;
    expect(document).toMatchObject({ format: "softure.privacy-export", version: 1, userId: ada.id, exportedAt: NOW.toISOString() });
    expect(Object.keys(document.data)).toEqual(["auth", "feature-switches", "notes", "privacy", "profile"]);
    expect(document.data["auth"]).toMatchObject({
      account: { id: ada.id, email: "ada@example.com" },
      roles: [{ role: "admin", grantedAt: NOW }],
      sessions: [{ createdAt: NOW }],
      passwordReset: { createdAt: NOW },
    });
    expect(document.data["feature-switches"]).toEqual({ lastSetSwitches: [] });
    expect(document.data["notes"]).toEqual({ notes: ["note of ada@example.com"] });
    expect(document.data["privacy"]).toEqual({
      consents: [
        { purpose: "terms", granted: true, document: { id: "terms", version: "2026-09-01" }, source: "registration", recordedAt: NOW, subject: "account" },
        {
          purpose: "privacy-policy",
          granted: true,
          document: { id: "privacy-policy", version: "2026-09-01" },
          source: "registration",
          recordedAt: NOW,
          subject: "account",
        },
      ],
    });
    expect(document.data["profile"]).toEqual({ displayName: "name of ada@example.com" });
  });

  it("names the switches the user set last, not the ones someone else changed after them", async () => {
    // seedUser had Bob set app.beta after Ada.
    const result = await collectUserData(test.ctx, bob.id);
    if (!result.ok) throw new Error(result.error);
    expect(result.value.document.data["feature-switches"]).toEqual({ lastSetSwitches: [{ name: "app.beta", isEnabled: true, updatedAt: NOW }] });
  });

  it("serialises dates as ISO strings and leaves out password and token hashes", async () => {
    const result = await collectUserData(test.ctx, ada.id);
    if (!result.ok) throw new Error(result.error);
    const parsed = JSON.parse(result.value.json) as { data: { auth: { account: { createdAt: string } } } };
    expect(parsed.data.auth.account.createdAt).toBe(NOW.toISOString());
    expect(result.value.json).not.toContain("scrypt$");
    const hashes = await test.database.client.query<{ token_hash: string }>(
      "SELECT token_hash FROM auth.sessions UNION ALL SELECT token_hash FROM auth.password_resets",
    );
    for (const { token_hash } of hashes.rows) expect(result.value.json).not.toContain(token_hash);
    expect(result.value.json).not.toContain(bob.email);
  });

  it("gives an unknown user an export with empty parts", async () => {
    const result = await collectUserData(test.ctx, "00000000-0000-4000-8000-000000000000");
    if (!result.ok) throw new Error(result.error);
    expect(result.value.document.data["auth"]).toEqual({ account: null, roles: [], sessions: [], passwordReset: null });
    expect(result.value.document.data["notes"]).toEqual({ notes: [] });
    expect(result.value.document.data["privacy"]).toEqual({ consents: [] });
  });

  it("fails the whole export when one contributor fails, and logs which one", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const config = createConfig({ contributors: [{ id: "billing", exportUserData: () => Promise.resolve(err("billing.unavailable")) }] });
    const failing = await createTestPrivacy(config);
    try {
      expect(await collectUserData(failing.ctx, ada.id)).toEqual({ ok: false, error: "privacy.export_failed" });
      expect(log).toHaveBeenCalledWith('@softure-ai/privacy: contributor "billing" failed the export: billing.unavailable');
    } finally {
      await failing.database.close();
    }
  });

  it("refuses an export larger than export.maxBytes", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const config = createConfig({
      contributors: [profileContributor, { id: "history", exportUserData: () => Promise.resolve(ok({ events: "x".repeat(2048) })) }],
      export: { maxBytes: 2048 },
    });
    const large = await createTestPrivacy(config);
    try {
      expect(await collectUserData(large.ctx, ada.id)).toEqual({ ok: false, error: "privacy.export_too_large" });
    } finally {
      await large.database.close();
    }
  });

  it("lets a database failure propagate", async () => {
    await test.database.client.exec("DROP TABLE notes.notes");
    await expect(collectUserData(test.ctx, ada.id)).rejects.toThrow(/notes/);
  });
});
