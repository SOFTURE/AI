// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RadioGroup, RadioGroupItem } from "../../src/index.js";

afterEach(cleanup);

function renderDays({ onValueChange = vi.fn() }: { onValueChange?: (value: string) => void } = {}) {
  return render(
    <RadioGroup defaultValue="tue" aria-label="Day" onValueChange={onValueChange}>
      <RadioGroupItem value="mon" aria-label="Monday" />
      <RadioGroupItem value="tue" aria-label="Tuesday" />
      <RadioGroupItem value="wed" aria-label="Wednesday" />
    </RadioGroup>,
  );
}

describe("RadioGroup", () => {
  it("marks the group and its items with the shadcn slots", () => {
    renderDays();

    expect(screen.getByRole("radiogroup", { name: "Day" }).dataset["slot"]).toBe("radio-group");
    expect(screen.getAllByRole("radio").map((item) => item.dataset["slot"])).toEqual([
      "radio-group-item",
      "radio-group-item",
      "radio-group-item",
    ]);
  });

  it("draws the dot only in the checked item, which carries data-state checked", () => {
    renderDays();
    const [monday, tuesday] = screen.getAllByRole("radio");

    expect(tuesday?.dataset["state"]).toBe("checked");
    expect(tuesday?.getAttribute("aria-checked")).toBe("true");
    expect(tuesday?.querySelector('[data-slot="radio-group-indicator"] svg')).not.toBeNull();
    expect(monday?.dataset["state"]).toBe("unchecked");
    expect(monday?.querySelector('[data-slot="radio-group-indicator"]')).toBeNull();
  });

  // Radix moves the focus in a timeout after the key, and checks the item that receives it.
  it("moves the choice with the arrow keys", async () => {
    const onValueChange = vi.fn();
    renderDays({ onValueChange });
    const tuesday = screen.getByRole("radio", { name: "Tuesday" });

    tuesday.focus();
    fireEvent.keyDown(tuesday, { key: "ArrowDown" });

    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("radio", { name: "Wednesday" })));
    expect(onValueChange).toHaveBeenLastCalledWith("wed");
    expect(screen.getByRole("radio", { name: "Wednesday" }).dataset["state"]).toBe("checked");
    expect(tuesday.dataset["state"]).toBe("unchecked");

    fireEvent.keyDown(screen.getByRole("radio", { name: "Wednesday" }), { key: "ArrowUp" });

    await waitFor(() => expect(document.activeElement).toBe(tuesday));
    expect(onValueChange).toHaveBeenLastCalledWith("tue");
    expect(tuesday.dataset["state"]).toBe("checked");
  });

  it("draws the item like the checkbox: 16 px, 1.5 px muted border, primary when checked, ring-2 focus", () => {
    renderDays();
    const classes = (screen.getByRole("radio", { name: "Tuesday" }).getAttribute("class") ?? "").split(" ");

    expect(classes).toEqual(
      expect.arrayContaining([
        "size-4",
        "rounded-full",
        "border-[1.5px]",
        "border-muted-foreground",
        "data-[state=checked]:border-primary",
        "focus-visible:ring-2",
        "focus-visible:ring-ring",
        "aria-invalid:border-destructive",
      ]),
    );
    expect(classes).not.toContain("shadow-xs");
  });
});
