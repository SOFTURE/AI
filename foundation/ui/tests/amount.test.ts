import { describe, expect, it } from "vitest";
import { formatAmountInput, getAmountErrorMessage, normalizeAmountInput, parseAmount, uiMessages } from "../src/index.js";

describe("parseAmount (pl)", () => {
  it.each([
    ["0", 0],
    ["5", 500],
    ["1234", 123_400],
    ["1 234,5", 123_450],
    ["1 234,56", 123_456],
    ["1 234.56", 123_456],
    ["12 345 678,90", 1_234_567_890],
    ["-1 200,00", -120_000],
    ["  42  ", 4200],
  ])("%j is %d cents", (text, cents) => {
    expect(parseAmount(text, "pl")).toEqual({ ok: true, value: cents });
  });

  it.each(["", " ", "abc", "1,234", "1 23", "01 234", "1,234.56", "1,999", "1.2.3", "12,345"])("rejects %j", (text) => {
    // "1,999" and "12,345": in Polish notation a comma is a decimal mark with at most two digits.
    expect(parseAmount(text, "pl")).toEqual({ ok: false, error: "ui.amount_invalid" });
  });

  it("turns negative zero into zero", () => {
    const result = parseAmount("-0,00", "pl");
    expect(result).toEqual({ ok: true, value: 0 });
    expect(Object.is(result.ok && result.value, -0)).toBe(false);
  });

  it("rejects an amount past the safe integer range, one cent past the limit included", () => {
    expect(parseAmount("99999999999999999999", "pl")).toEqual({ ok: false, error: "ui.amount_out_of_range" });
    expect(parseAmount("90071992547409,91", "pl")).toEqual({ ok: true, value: Number.MAX_SAFE_INTEGER });
    expect(parseAmount("90071992547409,92", "pl")).toEqual({ ok: false, error: "ui.amount_out_of_range" });
  });

  it("accepts the no-break spaces Intl puts between groups", () => {
    expect(parseAmount("1\u00a0234,56", "pl")).toEqual({ ok: true, value: 123_456 });
    expect(parseAmount("1\u202f234,56", "pl")).toEqual({ ok: true, value: 123_456 });
  });

  it("accepts the thin space typeset text puts between groups (#303)", () => {
    expect(parseAmount("1\u2009234,56", "pl")).toEqual({ ok: true, value: 123_456 });
    expect(parseAmount("12\u2009345\u2009678", "pl")).toEqual({ ok: true, value: 1_234_567_800 });
    expect(parseAmount("-1\u2009234.5", "pl")).toEqual({ ok: true, value: -123_450 });
  });

  it.each(["1\u200923,45", "12\u20093456", "1\u2009\u2009234"])("rejects a misplaced thin space in %j", (text) => {
    expect(parseAmount(text, "pl")).toEqual({ ok: false, error: "ui.amount_invalid" });
  });
});

describe("parseAmount (en)", () => {
  it.each([
    ["1234.5", 123_450],
    ["1,234.56", 123_456],
    ["1 234.56", 123_456],
    ["12,345,678", 1_234_567_800],
    ["1\u2009234.56", 123_456],
  ])("%j is %d cents", (text, cents) => {
    expect(parseAmount(text, "en")).toEqual({ ok: true, value: cents });
  });

  it.each(["1,5", "1,23,456", "1.234,56", "1 234,56", "1\u2009234,56"])("rejects %j", (text) => {
    expect(parseAmount(text, "en")).toEqual({ ok: false, error: "ui.amount_invalid" });
  });
});

describe("formatAmountInput", () => {
  it.each([
    [0, "0,00", "0.00"],
    [5, "0,05", "0.05"],
    [123_456, "1 234,56", "1,234.56"],
    [-120_000, "-1 200,00", "-1,200.00"],
    [100_000_000_00, "100 000 000,00", "100,000,000.00"],
  ])("%d cents", (cents, pl, en) => {
    expect(formatAmountInput(cents, "pl")).toBe(pl);
    expect(formatAmountInput(cents, "en")).toBe(en);
  });

  it("throws on a non-integer amount, naming the input", () => {
    expect(() => formatAmountInput(1.5, "en")).toThrow(/1\.5/);
  });

  it("round-trips through parseAmount at the safe integer limit", () => {
    const text = formatAmountInput(Number.MAX_SAFE_INTEGER, "pl");
    expect(parseAmount(text, "pl")).toEqual({ ok: true, value: Number.MAX_SAFE_INTEGER });
  });
});

describe("normalizeAmountInput", () => {
  it("formats text that parses and leaves other text as typed", () => {
    expect(normalizeAmountInput("1200", "pl")).toBe("1 200,00");
    expect(normalizeAmountInput("1200", "en")).toBe("1,200.00");
    expect(normalizeAmountInput("12x", "en")).toBe("12x");
    expect(normalizeAmountInput("", "en")).toBe("");
  });
});

describe("getAmountErrorMessage", () => {
  it("gives the message with an example in the locale's notation", () => {
    expect(getAmountErrorMessage("ui.amount_invalid", { locale: "pl" })).toBe(
      uiMessages.pl.errors.amount_invalid.replace("{example}", "1 234,56"),
    );
    expect(getAmountErrorMessage("ui.amount_invalid")).toBe(uiMessages.en.errors.amount_invalid.replace("{example}", "1,234.56"));
    expect(getAmountErrorMessage("ui.amount_out_of_range", { messages: { amount_out_of_range: "Too much." } })).toBe("Too much.");
  });
});
