import { describe, expect, it } from "vitest";
import { err, ok, type Result } from "@softure-ai/core";

function divide(a: number, b: number): Result<number, "math.division_by_zero"> {
  return b === 0 ? err("math.division_by_zero") : ok(a / b);
}

describe("Result", () => {
  it("carries the value on success", () => {
    const result = divide(6, 3);
    expect(result).toEqual({ ok: true, value: 2 });
  });

  it("carries the error code on failure", () => {
    const result = divide(1, 0);
    expect(result).toEqual({ ok: false, error: "math.division_by_zero" });
  });

  it("narrows on the ok flag", () => {
    const result = divide(1, 0);
    const described = result.ok ? `value ${result.value}` : `error ${result.error}`;
    expect(described).toBe("error math.division_by_zero");
  });

  it("returns an undefined value for ok() without arguments", () => {
    expect(ok()).toEqual({ ok: true, value: undefined });
  });
});
