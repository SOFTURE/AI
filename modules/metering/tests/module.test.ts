// The module definition: its manifest, its options and the constraints of its table.
import { readFileSync } from "node:fs";
import { toModuleJson } from "@softure-ai/core";
import { getMeteringErrorMessage, metering, meteringMessages } from "@softure-ai/metering";
import { checkChargesTable } from "@softure-ai/metering/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestMetering, NOW, type TestMetering } from "./support.js";

describe("the metering module", () => {
  it("ships a module.json equal to its manifest", () => {
    const moduleJson: unknown = JSON.parse(readFileSync(new URL("../module.json", import.meta.url), "utf8"));
    expect(moduleJson).toEqual(toModuleJson(metering));
  });

  it("keeps the package version and the manifest version in step", () => {
    const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string };
    expect(metering.manifest.version).toBe(manifest.version);
  });

  it("fills in the defaults: no providers, reservations held for an hour, budgets for the whole provider", () => {
    expect(metering().options).toEqual({ providers: [], reservationTtlSeconds: 3600 });
    expect(metering({ providers: [{ id: "elevenlabs", unit: "credits", budgets: [{ period: "day", limit: 5 }] }] }).options.providers).toEqual([
      { id: "elevenlabs", unit: "credits", budgets: [{ period: "day", limit: 5, perAccount: false }] },
    ]);
  });

  it("refuses options it cannot run with, listing every problem", () => {
    expect(() =>
      metering({
        providers: [
          { id: "ElevenLabs", unit: "credits" },
          // @ts-expect-error: a JavaScript config can name a unit that does not exist.
          { id: "search", unit: "euros" },
          { id: "speech", unit: "seconds", budgets: [{ period: "day", limit: 0 }] },
          { id: "speech", unit: "seconds" },
          { id: "music", unit: "seconds", budgets: [{ period: "month", limit: 5 }, { period: "month", limit: 9 }] },
        ],
        reservationTtlSeconds: 0,
      }),
    ).toThrow(
      [
        'Invalid SOFTURE configuration in module "metering":',
        "- options.providers.0.id: must be lower case words joined by . _ or -, e.g. elevenlabs",
        '- options.providers.1.unit: Invalid option: expected one of "credits"|"usd"|"characters"|"seconds"|"tokens"|"requests"',
        "- options.providers.2.budgets.0.limit: Too small: expected number to be >0",
        "- options.reservationTtlSeconds: Too small: expected number to be >=1",
      ].join("\n"),
    );
  });

  it("refuses a provider declared twice and two budgets of one period and scope", () => {
    expect(() =>
      metering({
        providers: [
          { id: "speech", unit: "seconds" },
          { id: "speech", unit: "seconds" },
          { id: "music", unit: "seconds", budgets: [{ period: "month", limit: 5 }, { period: "month", limit: 9 }, { period: "month", limit: 2, perAccount: true }] },
        ],
      }),
    ).toThrow(
      [
        'Invalid SOFTURE configuration in module "metering":',
        '- options.providers.1.id: "speech" is declared twice',
        "- options.providers.2.budgets.1: a month budget for the whole provider is declared twice",
      ].join("\n"),
    );
  });

  it("ships English copy for every error code", () => {
    expect(Object.keys(meteringMessages)).toEqual(["en"]);
    expect(getMeteringErrorMessage("metering.budget_exceeded")).toBe("The spending limit for this service is reached. Try again after it resets.");
    expect(getMeteringErrorMessage("metering.reservation_not_found")).toBe("This charge was already settled or released.");
  });
});

describe("the charges table", () => {
  let test: TestMetering;

  beforeEach(async () => {
    test = await createTestMetering();
  });
  afterEach(async () => {
    await test.database.close();
  });

  const insert = (columns: Record<string, unknown>) => {
    const row = { provider: "speech", unit: "seconds", amount: "1", status: "settled", created_at: NOW, settled_at: NOW, expires_at: null, ...columns };
    const names = Object.keys(row);
    return test.database.client.query(
      `INSERT INTO metering.charges (${names.join(", ")}) VALUES (${names.map((_, index) => `$${String(index + 1)}`).join(", ")})`,
      Object.values(row),
    );
  };

  it("accepts a settled charge and a reservation", async () => {
    await expect(insert({})).resolves.toBeDefined();
    await expect(insert({ status: "reserved", settled_at: null, expires_at: NOW })).resolves.toBeDefined();
  });

  it.each([
    ["an uppercase provider", { provider: "Speech" }],
    ["an unknown unit", { unit: "euros" }],
    ["a negative amount", { amount: "-1" }],
    ["an empty step", { step: "" }],
    ["an empty account", { account_id: "" }],
    ["attributes that are not an object", { attributes: "[]" }],
    ["an unknown status", { status: "pending" }],
    ["a reservation without an expiry", { status: "reserved", settled_at: null }],
    ["a settled charge with an expiry", { expires_at: NOW }],
    ["a settled charge without a settle time", { settled_at: null }],
  ])("refuses %s", async (_name, columns) => {
    await expect(insert(columns)).rejects.toThrow();
  });

  it("answers the health check once migrated", async () => {
    await expect(checkChargesTable(test.ctx)).resolves.toEqual({ ok: true, value: undefined });
  });
});
