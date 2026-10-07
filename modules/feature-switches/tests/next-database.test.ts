// The Next adapter reads through the app's configured handle (`database.handle`) when the app set one,
// never through a second handle on `database.url`.
import { defineSoftureConfig } from "@softure-ai/core";
import { clearSoftureConfig, registerSoftureConfig } from "@softure-ai/core/next";
import { closeConfiguredDatabases, createPgliteHandle } from "@softure-ai/db";
import { isEnabled } from "@softure-ai/feature-switches/next";
import { setSwitch } from "@softure-ai/feature-switches/server";
import { afterEach, describe, expect, it } from "vitest";
import { createTestSwitches } from "./support.js";

describe("isEnabled with database.handle", () => {
  afterEach(async () => {
    clearSoftureConfig();
    await closeConfiguredDatabases();
  });

  it("reads the switch stored in the app's database", async () => {
    const { ctx, database, config } = await createTestSwitches();
    await setSwitch(ctx, { name: "billing.checkout_enabled", isEnabled: true, actorId: null });
    let calls = 0;
    registerSoftureConfig(
      defineSoftureConfig({
        ...config,
        // Nothing listens on port 1: a read through the url would fail and give the fail mode (false).
        database: {
          url: "postgresql://nobody@127.0.0.1:1/none",
          handle: async () => {
            calls += 1;
            return createPgliteHandle(database.client);
          },
        },
      }),
    );

    expect(await isEnabled("billing.checkout_enabled")).toBe(true);
    expect(calls).toBe(1);
  });
});
