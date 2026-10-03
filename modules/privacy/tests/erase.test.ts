// The deletion: every contributor in one transaction, in an order that respects foreign keys, and
// nothing of the user left in any table of any schema afterwards.
import { eraseUserData } from "@softure-ai/privacy/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestPrivacy, findTraces, retention, seedUser, type SeededUser, type TestPrivacy } from "./support.js";

/** Where a seeded user shows up: every table that can hold user data. */
const SEEDED_TRACES = [
  "auth.password_resets.user_id",
  "auth.sessions.user_id",
  "auth.user_roles.user_id",
  "auth.users.email",
  "auth.users.id",
  "features.switches.updated_by",
  "notes.notes.body",
  "notes.notes.user_id",
  "public.profiles.display_name",
  "public.profiles.user_id",
];

describe("eraseUserData", () => {
  let test: TestPrivacy;
  let ada: SeededUser;
  let bob: SeededUser;

  const tracesOf = (user: SeededUser) => findTraces(test.database, [user.id, user.email]);

  beforeEach(async () => {
    test = await createTestPrivacy();
    ada = await seedUser(test, "ada@example.com");
    bob = await seedUser(test, "bob@example.com");
    // Ada sets the switch last, so the switches row names her.
    await test.database.client.query("UPDATE features.switches SET updated_by = $1", [ada.id]);
  });
  afterEach(async () => {
    retention.isHolding = false;
    await test.database.close();
    vi.restoreAllMocks();
  });

  it("finds the seeded user in every table that can hold user data before the deletion", async () => {
    expect(await tracesOf(ada)).toEqual(SEEDED_TRACES);
  });

  it("leaves no column in any schema holding the user's id or email", async () => {
    expect(await eraseUserData(test.ctx, ada.id)).toEqual({ ok: true, value: undefined });
    expect(await tracesOf(ada)).toEqual([]);
  });

  it("keeps every row of other users, and the switch's state", async () => {
    await eraseUserData(test.ctx, ada.id);
    expect(await tracesOf(bob)).toEqual(SEEDED_TRACES.filter((trace) => trace !== "features.switches.updated_by"));
    const switches = await test.database.client.query("SELECT name, enabled, updated_by FROM features.switches");
    expect(switches.rows).toEqual([{ name: "app.beta", enabled: true, updated_by: null }]);
  });

  it("deletes nothing when a contributor refuses, and logs which one and why", async () => {
    const log = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    retention.isHolding = true;
    expect(await eraseUserData(test.ctx, ada.id)).toEqual({ ok: false, error: "privacy.deletion_refused" });
    expect(await tracesOf(ada)).toEqual(SEEDED_TRACES);
    expect(log).toHaveBeenCalledWith('@softure-ai/privacy: contributor "profile" refused the deletion: profile.retention_hold; nothing was deleted');
  });

  it("rolls back every contributor when one throws, and lets the error propagate", async () => {
    // auth deletes last, so a trigger that fails its delete runs after every other contributor.
    await test.database.client.exec(
      "CREATE FUNCTION auth.refuse_delete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'blocked'; END $$;" +
        "CREATE TRIGGER refuse_delete BEFORE DELETE ON auth.users FOR EACH ROW EXECUTE FUNCTION auth.refuse_delete()",
    );
    await expect(eraseUserData(test.ctx, ada.id)).rejects.toThrow(/^Failed query: delete from "auth"."users"/);
    expect(await tracesOf(ada)).toEqual(SEEDED_TRACES);
  });

  it("succeeds for a user who has nothing left", async () => {
    await eraseUserData(test.ctx, ada.id);
    expect(await eraseUserData(test.ctx, ada.id)).toEqual({ ok: true, value: undefined });
  });
});
