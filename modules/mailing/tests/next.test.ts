// The Next adapter sends with the registered configuration.
import { clearSoftureConfig, registerSoftureConfig } from "@softure-ai/core/next";
import { closeSharedDatabases } from "@softure-ai/db";
import { sendMail } from "@softure-ai/mailing/next";
import { fakeMailProvider } from "@softure-ai/mailing/testing";
import { afterEach, describe, expect, it } from "vitest";
import { createConfig, MAIL } from "./support.js";

describe("sendMail from /next", () => {
  afterEach(async () => {
    clearSoftureConfig();
    await closeSharedDatabases();
  });

  it("sends through the provider of the registered configuration", async () => {
    const provider = fakeMailProvider();
    registerSoftureConfig(createConfig(provider));
    const result = await sendMail(MAIL, { idempotencyKey: "k1" });
    expect(result).toEqual({ ok: true, value: { id: provider.sent[0]?.id, provider: "fake" } });
    expect(provider.sent[0]?.idempotencyKey).toBe("k1");
  });

  it("sends transactional mail without opening the database", async () => {
    const provider = fakeMailProvider();
    const config = createConfig(provider);
    registerSoftureConfig({ ...config, database: { url: "unsupported://never-opened" } });
    expect((await sendMail(MAIL)).ok).toBe(true);
  });

  it("fails loudly when no configuration is registered", async () => {
    await expect(sendMail(MAIL)).rejects.toThrow("getSoftureConfig: no SOFTURE config is registered");
  });
});
