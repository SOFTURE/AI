// The switch-reader contract: one enabled module answers switch reads for the others, and a module
// that asks falls back to its own default when nothing answers.
import { createTestClock, defineSoftureConfig, findSwitchReader, readSwitch, type ModuleContext, type SwitchReader } from "@softure-ai/core";
import { describe, expect, it, vi } from "vitest";
import { catchConfigError, createTestModule } from "./support.js";

const BASE = { locale: "en", timezone: "Europe/Warsaw", appOrigin: "https://app.example.com" } as const;

function createContext(modules: Parameters<typeof defineSoftureConfig>[0]["modules"]): ModuleContext {
  return { db: null, clock: createTestClock(new Date("2026-10-03T12:00:00Z")), config: defineSoftureConfig({ ...BASE, modules }) };
}

describe("readSwitch", () => {
  it("answers undeclared when no enabled module provides a reader", async () => {
    const ctx = createContext([createTestModule({ id: "asker" })]);
    expect(findSwitchReader(ctx.config)).toBeNull();
    expect(await readSwitch(ctx, "asker.closed")).toEqual({ kind: "undeclared" });
  });

  it("asks the provider with the caller's context and returns its reading", async () => {
    const reader = vi.fn<SwitchReader>((_context, name) => Promise.resolve(name === "asker.closed" ? { kind: "value", isEnabled: true } : { kind: "undeclared" }));
    const ctx = createContext([createTestModule({ id: "asker" }), createTestModule({ id: "provider", switchReader: reader })]);

    expect(await readSwitch(ctx, "asker.closed")).toEqual({ kind: "value", isEnabled: true });
    expect(await readSwitch(ctx, "asker.other")).toEqual({ kind: "undeclared" });
    expect(reader).toHaveBeenCalledWith(ctx, "asker.closed");
    expect(findSwitchReader(ctx.config)).toBe(reader);
  });

  it("passes a provider's off value through instead of falling back", async () => {
    const reader: SwitchReader = () => Promise.resolve({ kind: "value", isEnabled: false });
    const ctx = createContext([createTestModule({ id: "provider", switchReader: reader })]);
    expect(await readSwitch(ctx, "provider.flag")).toEqual({ kind: "value", isEnabled: false });
  });

  it("refuses a config with two providers, naming both", () => {
    const reader: SwitchReader = () => Promise.resolve({ kind: "undeclared" });
    const error = catchConfigError(() =>
      defineSoftureConfig({
        ...BASE,
        modules: [createTestModule({ id: "first", switchReader: reader }), createTestModule({ id: "second", switchReader: reader })],
      }),
    );
    expect(error.issues).toEqual(["modules: only one module may provide the switch reader; first, second all do"]);
  });
});
