import { describe, expect, it } from "vitest";
import { formatPercent } from "@softure-ai/core";

describe("formatPercent fractionDigits", () => {
  it("prints exactly the requested number of fraction digits", () => {
    expect(formatPercent(1900, "en", { fractionDigits: 2 })).toBe("19.00%");
    expect(formatPercent(450, "en", { fractionDigits: 2 })).toBe("4.50%");
    expect(formatPercent(2060, "en", { fractionDigits: 0 })).toBe("21%");
    expect(formatPercent(1, "en", { fractionDigits: 3 })).toBe("0.010%");
  });

  it("combines with signed and tight", () => {
    expect(formatPercent(2060, "en", { fractionDigits: 1, signed: true })).toBe("+20.6%");
    expect(formatPercent(300, "en", { fractionDigits: 1, signed: true })).toBe("+3.0%");
    expect(formatPercent(-300, "en", { fractionDigits: 1, signed: true, tight: true })).toBe("-3.0%");
    expect(formatPercent(1900, "pl", { fractionDigits: 2, tight: true })).toBe("19,00%");
  });

  it("never signs a value that rounds to zero at the chosen precision", () => {
    expect(formatPercent(-0.4, "en", { fractionDigits: 1 })).toBe("0.0%");
    expect(formatPercent(-0.4, "en", { fractionDigits: 1, signed: true })).toBe("0.0%");
    expect(formatPercent(0.4, "en", { fractionDigits: 1, signed: true })).toBe("0.0%");
    expect(formatPercent(-0, "en", { fractionDigits: 2, signed: true })).toBe("0.00%");
    expect(formatPercent(-4, "en", { fractionDigits: 0 })).toBe("0%");
  });

  it("keeps the default of at most two digits without the option", () => {
    expect(formatPercent(1900, "en")).toBe("19%");
    expect(formatPercent(2060, "en")).toBe("20.6%");
    expect(formatPercent(1, "en")).toBe("0.01%");
    expect(formatPercent(1, "en", {})).toBe("0.01%");
  });

  it.each([-1, 1.5, 21, Number.NaN, Number.POSITIVE_INFINITY])("rejects fractionDigits %s", (fractionDigits) => {
    expect(() => formatPercent(1250, "en", { fractionDigits })).toThrow(
      new RangeError(`formatPercent: fractionDigits ${String(fractionDigits)} is not an integer from 0 to 20`),
    );
  });
});
