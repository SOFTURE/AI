// The adapters: llm's usage records and marketing-kit's footage charges recorded in the ledger.
import { createFootageChargeRecorder, createLlmUsageRecorder, getSpend, recordLlmUsage } from "@softure-ai/metering/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestMetering, listRows, NOW, type TestMetering } from "./support.js";

const USAGE = {
  provider: "openrouter",
  model: "anthropic/claude-haiku",
  costUsd: 0.0125,
  at: new Date("2026-10-15T11:59:00Z"),
  attributes: { accountId: "a", feature: "summary" },
};

describe("the llm usage adapter", () => {
  let test: TestMetering;

  beforeEach(async () => {
    test = await createTestMetering();
  });
  afterEach(async () => {
    await test.database.close();
  });

  it("records a priced call as a usd charge of its account, keeping the model and the other attributes", async () => {
    const recorded = await recordLlmUsage(test.ctx, USAGE);
    expect(recorded.value).toEqual({ id: expect.any(String) as string });
    const rows = await test.database.client.query<{ unit: string; amount: string; account_id: string; step: string; attributes: unknown; created_at: Date }>(
      "SELECT unit, amount::text AS amount, account_id, step, attributes, created_at FROM metering.charges",
    );
    expect(rows.rows).toEqual([
      {
        unit: "usd",
        amount: "0.01250000",
        account_id: "a",
        step: "anthropic/claude-haiku",
        attributes: { feature: "summary", model: "anthropic/claude-haiku" },
        created_at: USAGE.at,
      },
    ]);
  });

  it("records nothing for a call without a cost", async () => {
    expect(await recordLlmUsage(test.ctx, { ...USAGE, costUsd: null })).toEqual({ ok: true, value: null });
    expect(await listRows(test.database)).toEqual([]);
  });

  it("serves as onUsage under another provider id and step", async () => {
    const onUsage = createLlmUsageRecorder(test.ctx, { provider: "openrouter", step: "summarize" });
    await onUsage({ ...USAGE, provider: "openai", attributes: {} });
    expect(await listRows(test.database)).toEqual(["openrouter settled 0.0125 - summarize"]);
  });

  it("refuses a provider that does not bill in usd", async () => {
    await expect(recordLlmUsage(test.ctx, USAGE, { provider: "elevenlabs" })).rejects.toThrow(
      'recordLlmUsage: provider "elevenlabs" bills in credits, and model costs are in usd',
    );
  });
});

describe("the footage charge recorder", () => {
  let test: TestMetering;

  beforeEach(async () => {
    test = await createTestMetering();
  });
  afterEach(async () => {
    await test.database.close();
  });

  it("records seconds for a provider billed in seconds and credits for one billed in credits", async () => {
    const recorder = createFootageChargeRecorder(test.ctx, { accountId: "a", attributes: { filmId: "f1" } });
    recorder.onCharge({ step: "transcribe", item: "clip-1", provider: "speech", units: 12.5 });
    recorder.onCharge({ step: "isolate", item: "clip-1", provider: "elevenlabs", units: 12.5, credits: 300 });
    await recorder.flush();

    expect((await listRows(test.database)).sort()).toEqual(["elevenlabs settled 300 a isolate", "speech settled 12.5 a transcribe"]);
    const attributes = await test.database.client.query<{ attributes: unknown }>("SELECT attributes FROM metering.charges ORDER BY provider");
    expect(attributes.rows.map((row) => row.attributes)).toEqual([
      { filmId: "f1", item: "clip-1" },
      { filmId: "f1", item: "clip-1" },
    ]);
    expect((await getSpend(test.ctx, { provider: "speech", period: "day" })).value.spent).toBe(12.5);
    expect(test.clock.now()).toEqual(NOW);
  });

  it("prices credits from the rate when the provider reports none", async () => {
    const recorder = createFootageChargeRecorder(test.ctx, { creditsPerSecond: 20, accountId: "a" });
    recorder.onCharge({ step: "music", item: "film", provider: "elevenlabs", units: 30 });
    await recorder.flush();
    expect(await listRows(test.database)).toEqual(["elevenlabs settled 600 a music"]);
  });

  it("reports a failed write on flush, after the other writes finished", async () => {
    const recorder = createFootageChargeRecorder(test.ctx, { accountId: "a" });
    recorder.onCharge({ step: "music", item: "film", provider: "elevenlabs", units: 30 });
    recorder.onCharge({ step: "transcribe", item: "clip-1", provider: "speech", units: 5 });
    await expect(recorder.flush()).rejects.toThrow(
      'createFootageChargeRecorder: the music charge of "elevenlabs" reports no credits; pass creditsPerSecond',
    );
    expect(await listRows(test.database)).toEqual(["speech settled 5 a transcribe"]);
    // A flush reports each failure once.
    await expect(recorder.flush()).resolves.toBeUndefined();
  });

  it("refuses a provider billed in a unit footage does not report", async () => {
    const recorder = createFootageChargeRecorder(test.ctx);
    recorder.onCharge({ step: "transcribe", item: "clip-1", provider: "search", units: 5 });
    await expect(recorder.flush()).rejects.toThrow('createFootageChargeRecorder: provider "search" bills in requests; footage charges are in seconds or credits');
  });
});
