// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { formatDecimal, MoneyField, normalizeDecimalInput, parseAmount, parseDecimal, TextField } from "../src/index.js";

// Issue #320: controlled `TextField`/`MoneyField` for live calculators, and the fixed-point parser
// behind `parseAmount` with any scale (percent in basis points, rates in millionths).

afterEach(cleanup);

describe("parseDecimal (#320)", () => {
  it("reads percent as basis points with scale 2 and rates as millionths with scale 6", () => {
    expect(parseDecimal("12,5", "pl", { scale: 2 })).toEqual({ ok: true, value: 1250 });
    expect(parseDecimal("7.25", "en", { scale: 2 })).toEqual({ ok: true, value: 725 });
    expect(parseDecimal("0,000123", "pl", { scale: 6 })).toEqual({ ok: true, value: 123 });
    expect(parseDecimal("1,5", "pl", { scale: 6 })).toEqual({ ok: true, value: 1_500_000 });
  });

  it("uses the same grammar as parseAmount: groups, signs, either decimal mark in pl", () => {
    expect(parseDecimal("1 234,5", "pl", { scale: 3 })).toEqual({ ok: true, value: 1_234_500 });
    expect(parseDecimal("1,234.5", "en", { scale: 3 })).toEqual({ ok: true, value: 1_234_500 });
    expect(parseDecimal("-0,5", "pl", { scale: 1 })).toEqual({ ok: true, value: -5 });
    expect(parseDecimal("-0,0", "pl", { scale: 1 })).toEqual({ ok: true, value: 0 });
  });

  it("refuses more fraction digits than the scale, and any fraction at scale 0", () => {
    expect(parseDecimal("1,234", "pl", { scale: 2 })).toEqual({ ok: false, error: "ui.decimal_invalid" });
    expect(parseDecimal("1,5", "pl", { scale: 0 })).toEqual({ ok: false, error: "ui.decimal_invalid" });
    expect(parseDecimal("15", "pl", { scale: 0 })).toEqual({ ok: true, value: 15 });
  });

  it("refuses empty text, letters and misplaced groups", () => {
    for (const text of ["", " ", "abc", "1 23,4", "12 3456", "1.234,5"]) {
      expect(parseDecimal(text, "pl", { scale: 2 })).toEqual({ ok: false, error: "ui.decimal_invalid" });
    }
  });

  it("refuses a value past the safe integer range, one unit past the limit included", () => {
    expect(parseDecimal("9007199254740991", "en", { scale: 0 })).toEqual({ ok: true, value: Number.MAX_SAFE_INTEGER });
    expect(parseDecimal("9007199254740992", "en", { scale: 0 })).toEqual({ ok: false, error: "ui.decimal_out_of_range" });
    expect(parseDecimal("9007199254,740992", "pl", { scale: 6 })).toEqual({ ok: false, error: "ui.decimal_out_of_range" });
  });

  it("throws on a scale that is not an integer from 0 to 15, naming it", () => {
    expect(() => parseDecimal("1", "en", { scale: 1.5 })).toThrow(/scale.*1\.5/);
    expect(() => parseDecimal("1", "en", { scale: 16 })).toThrow(/scale.*16/);
    expect(() => parseDecimal("1", "en", { scale: -1 })).toThrow(/scale.*-1/);
  });

  it("is what parseAmount runs with scale 2, keeping the amount error codes", () => {
    expect(parseAmount("1 234,56", "pl")).toEqual(parseDecimal("1 234,56", "pl", { scale: 2 }));
    expect(parseAmount("1,234", "pl")).toEqual({ ok: false, error: "ui.amount_invalid" });
    expect(parseAmount("99999999999999999999", "pl")).toEqual({ ok: false, error: "ui.amount_out_of_range" });
  });
});

describe("formatDecimal (#320)", () => {
  it("writes the scaled integer grouped, with the scale's fraction digits", () => {
    expect(formatDecimal(1250, "pl", { scale: 2 })).toBe("12,50");
    expect(formatDecimal(123_456_789, "en", { scale: 3 })).toBe("123,456.789");
    expect(formatDecimal(-5, "pl", { scale: 6 })).toBe("-0,000005");
    expect(formatDecimal(1_234_567, "pl", { scale: 0 })).toBe("1 234 567");
  });

  it("trims trailing zeros down to minFractionDigits", () => {
    expect(formatDecimal(1250, "pl", { scale: 2, minFractionDigits: 0 })).toBe("12,5");
    expect(formatDecimal(1200, "pl", { scale: 2, minFractionDigits: 0 })).toBe("12");
    expect(formatDecimal(1_500_000, "en", { scale: 6, minFractionDigits: 2 })).toBe("1.50");
    expect(formatDecimal(1_234_567, "en", { scale: 6, minFractionDigits: 2 })).toBe("1.234567");
  });

  it("round-trips through parseDecimal at the safe integer limit", () => {
    const text = formatDecimal(Number.MAX_SAFE_INTEGER, "pl", { scale: 6 });
    expect(parseDecimal(text, "pl", { scale: 6 })).toEqual({ ok: true, value: Number.MAX_SAFE_INTEGER });
  });

  it("throws on a non-integer value or bad options, naming the input", () => {
    expect(() => formatDecimal(1.5, "en", { scale: 2 })).toThrow(/1\.5/);
    expect(() => formatDecimal(1, "en", { scale: 2, minFractionDigits: 3 })).toThrow(/minFractionDigits.*3/);
  });

  it("normalizeDecimalInput formats text that parses and leaves other text as typed", () => {
    expect(normalizeDecimalInput("12,5", "pl", { scale: 2 })).toBe("12,50");
    expect(normalizeDecimalInput("12.5", "pl", { scale: 2, minFractionDigits: 0 })).toBe("12,5");
    expect(normalizeDecimalInput("12,555", "pl", { scale: 2 })).toBe("12,555");
  });
});

function ControlledText({ onChange }: { onChange: (value: string) => void }) {
  const [value, setValue] = useState("5");
  return (
    <>
      <TextField
        name="rate"
        label="Rate"
        inputMode="decimal"
        suffix="%"
        value={value}
        onValueChange={(next) => {
          setValue(next);
          onChange(next);
        }}
      />
      <output>{value}</output>
    </>
  );
}

describe("controlled TextField (#320)", () => {
  it("shows the value and reports every edit", () => {
    const onChange = vi.fn();
    render(<ControlledText onChange={onChange} />);
    const input = screen.getByLabelText<HTMLInputElement>("Rate");
    expect(input.value).toBe("5");
    fireEvent.change(input, { target: { value: "5,5" } });
    expect(onChange).toHaveBeenLastCalledWith("5,5");
    expect(screen.getByText("5,5").tagName).toBe("OUTPUT");
    expect(input.value).toBe("5,5");
  });

  it("follows a value the parent changes", () => {
    const { rerender } = render(<TextField name="n" label="N" value="1" onValueChange={() => undefined} />);
    rerender(<TextField name="n" label="N" value="2" onValueChange={() => undefined} />);
    expect(screen.getByLabelText<HTMLInputElement>("N").value).toBe("2");
  });

  it("stays uncontrolled without value, and still reports edits to onValueChange", () => {
    const onValueChange = vi.fn();
    render(<TextField name="n" label="N" defaultValue="a" onValueChange={onValueChange} />);
    const input = screen.getByLabelText<HTMLInputElement>("N");
    fireEvent.change(input, { target: { value: "ab" } });
    expect(onValueChange).toHaveBeenCalledWith("ab");
    expect(input.value).toBe("ab");
  });
});

describe("controlled MoneyField (#320)", () => {
  it("shows the value as given and reports edits", () => {
    const onValueChange = vi.fn();
    render(<MoneyField name="amount" label="Amount" locale="pl" value="1234,5" onValueChange={onValueChange} />);
    const input = screen.getByLabelText<HTMLInputElement>("Amount");
    expect(input.value).toBe("1234,5");
    fireEvent.change(input, { target: { value: "1234,56" } });
    expect(onValueChange).toHaveBeenLastCalledWith("1234,56");
  });

  it("reports the formatted amount on blur, and nothing for text it cannot parse", () => {
    const onValueChange = vi.fn();
    const { rerender } = render(<MoneyField name="amount" label="Amount" locale="pl" value="1234,5" onValueChange={onValueChange} />);
    fireEvent.blur(screen.getByLabelText("Amount"));
    expect(onValueChange).toHaveBeenLastCalledWith("1 234,50");
    onValueChange.mockClear();
    rerender(<MoneyField name="amount" label="Amount" locale="pl" value="12x" onValueChange={onValueChange} />);
    fireEvent.blur(screen.getByLabelText("Amount"));
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("keeps the uncontrolled field formatting itself on blur", () => {
    render(<MoneyField name="amount" label="Amount" locale="pl" defaultValue="1234,5" />);
    const input = screen.getByLabelText<HTMLInputElement>("Amount");
    expect(input.value).toBe("1 234,50");
    fireEvent.change(input, { target: { value: "99" } });
    fireEvent.blur(input);
    expect(input.value).toBe("99,00");
  });
});
