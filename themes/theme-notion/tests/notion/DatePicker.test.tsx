// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { DatePicker, DateTimePicker } from "../../src/notion/DatePicker.js";
import { installDomShims } from "../gallery/dom.js";

beforeAll(installDomShims);

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/** Lets Radix's deferred focus and dismissable-layer listeners run. */
async function flush(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function trigger(): HTMLElement {
  const element = document.querySelector<HTMLElement>('[data-slot="date-picker-trigger"]');
  if (element === null) throw new Error("no date picker trigger");
  return element;
}

function dayButton(day: string): HTMLButtonElement {
  const element = document.querySelector<HTMLButtonElement>(`[data-day="${day}"]`);
  if (element === null) throw new Error(`no day ${day}`);
  return element;
}

function caption(): string | null | undefined {
  return document.querySelector('[data-slot="date-picker-caption"]')?.textContent;
}

function isOpen(): boolean {
  return document.querySelector('[data-slot="date-picker-calendar"]') !== null;
}

async function openPicker(): Promise<void> {
  fireEvent.click(trigger());
  await flush();
}

function press(key: string, options: { shiftKey?: boolean } = {}): void {
  const active = document.activeElement;
  if (active === null) throw new Error("nothing has focus");
  fireEvent.keyDown(active, { key, ...options });
}

function focusedDay(): string | null {
  return document.activeElement?.getAttribute("data-day") ?? null;
}

function select(label: string): HTMLSelectElement {
  return screen.getByRole("combobox", { name: label });
}

describe("DatePicker", () => {
  it("renders a trigger with the Input look, a touch height on a phone, the placeholder and an empty hidden input", () => {
    const html = renderToStaticMarkup(<DatePicker name="due" id="due" />);

    expect(html).toContain('data-slot="date-picker-trigger"');
    expect(html).toContain('type="button"');
    expect(html).toContain('id="due"');
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain("border-input bg-field");
    expect(html).toContain("max-md:h-touch-target");
    expect(html).toContain(">Pick a date<");
    expect(html).toContain('<input type="hidden" name="due" value=""/>');
  });

  it("shows the value in the app's locale with the time zone as a muted suffix, the same on any zone", () => {
    const html = renderToStaticMarkup(<DatePicker value="2026-11-26" locale="pl-PL" timeZone="Europe/Warsaw" name="due" />);

    expect(html).toContain(">26 lis 2026<");
    expect(html).toContain('data-slot="date-picker-time-zone"');
    expect(html).toContain(">Europe/Warsaw<");
    expect(html).toContain('value="2026-11-26"');
  });

  it("treats a value that is not a real day as empty", () => {
    const html = renderToStaticMarkup(<DatePicker value="2026-02-30" name="due" />);

    expect(html).toContain(">Pick a date<");
    expect(html).toContain('name="due" value=""');
  });

  it("opens a grid of the value's month with the chosen day selected and focused", async () => {
    render(<DatePicker defaultValue="2026-11-26" />);
    await openPicker();

    expect(screen.getByRole("grid").getAttribute("aria-labelledby")).toBe(document.querySelector('[data-slot="date-picker-caption"]')?.id);
    expect(caption()).toBe("November 2026");
    expect(focusedDay()).toBe("2026-11-26");
    expect(dayButton("2026-11-26").getAttribute("aria-label")).toBe("Thursday, November 26, 2026");
    expect(dayButton("2026-11-26").closest("td")?.getAttribute("aria-selected")).toBe("true");
    expect(dayButton("2026-11-25").closest("td")?.getAttribute("aria-selected")).toBe("false");
    expect(dayButton("2026-11-26").tabIndex).toBe(0);
    expect(dayButton("2026-11-25").tabIndex).toBe(-1);
    expect(dayButton("2026-11-26").className).toContain("max-md:size-touch-target");
    // Monday first: November 2026 starts on a Sunday, so the first week holds only the 1st, in its last column.
    expect([...document.querySelectorAll("thead th")].map((cell) => cell.textContent)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
    expect(document.querySelectorAll("tbody tr")[0]?.querySelectorAll("td")[6]?.querySelector("[data-day]")?.getAttribute("data-day")).toBe("2026-11-01");
  });

  it("moves by day, week, month and year with the keys, and to the week's start and end", async () => {
    render(<DatePicker defaultValue="2026-11-26" />);
    await openPicker();

    press("ArrowRight");
    await flush();
    expect(focusedDay()).toBe("2026-11-27");
    press("ArrowDown");
    await flush();
    expect(focusedDay()).toBe("2026-12-04");
    expect(caption()).toBe("December 2026");
    press("ArrowUp");
    press("ArrowLeft");
    await flush();
    expect(focusedDay()).toBe("2026-11-26");
    press("Home");
    await flush();
    expect(focusedDay()).toBe("2026-11-23");
    press("End");
    await flush();
    expect(focusedDay()).toBe("2026-11-29");
    press("PageDown");
    await flush();
    expect(focusedDay()).toBe("2026-12-29");
    press("PageUp", { shiftKey: true });
    await flush();
    expect(focusedDay()).toBe("2025-12-29");
    expect(caption()).toBe("December 2025");
  });

  it("chooses the day with Enter, closes, returns the value and fills the hidden input", async () => {
    const onValueChange = vi.fn();
    render(
      <form data-testid="form">
        <DatePicker defaultValue="2026-11-26" name="due" onValueChange={onValueChange} />
      </form>,
    );
    await openPicker();

    press("ArrowRight");
    await flush();
    fireEvent.click(dayButton("2026-11-27"));
    await flush();

    expect(onValueChange).toHaveBeenCalledWith("2026-11-27");
    expect(isOpen()).toBe(false);
    expect(trigger().textContent).toContain("Nov 27, 2026");
    expect(new FormData(screen.getByTestId<HTMLFormElement>("form")).get("due")).toBe("2026-11-27");
  });

  it("follows a controlled value", () => {
    function Controlled() {
      const [value, setValue] = useState<string | null>("2026-11-26");
      return (
        <>
          <DatePicker value={value} onValueChange={setValue} />
          <button type="button" onClick={() => setValue(null)}>
            Reset
          </button>
        </>
      );
    }
    render(<Controlled />);

    expect(trigger().textContent).toContain("Nov 26, 2026");
    fireEvent.click(screen.getByText("Reset"));
    expect(trigger().textContent).toContain("Pick a date");
  });

  it("disables the days and months outside min and max, and keeps the keys inside", async () => {
    render(<DatePicker defaultValue="2026-11-26" min="2026-11-24" max="2026-12-02" />);
    await openPicker();

    expect(dayButton("2026-11-23").disabled).toBe(true);
    expect(dayButton("2026-11-24").disabled).toBe(false);
    expect(screen.getByRole("button", { name: "Previous month" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "Next month" })).toHaveProperty("disabled", false);

    press("Home");
    await flush();
    expect(focusedDay()).toBe("2026-11-24");
    press("PageDown");
    await flush();
    expect(focusedDay()).toBe("2026-12-02");
    expect(screen.getByRole("button", { name: "Next month" })).toHaveProperty("disabled", true);
    expect(dayButton("2026-12-03").disabled).toBe(true);
  });

  it("pages months with the header buttons without choosing a day", async () => {
    const onValueChange = vi.fn();
    render(<DatePicker defaultValue="2026-11-26" onValueChange={onValueChange} />);
    await openPicker();

    fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    await flush();
    expect(caption()).toBe("December 2026");
    expect(dayButton("2026-12-26").tabIndex).toBe(0);
    fireEvent.click(screen.getByRole("button", { name: "Previous month" }));
    fireEvent.click(screen.getByRole("button", { name: "Previous month" }));
    await flush();
    expect(caption()).toBe("October 2026");
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("marks today in the app's time zone and focuses it when nothing is chosen", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    // 23:30 UTC on Nov 26 is already Nov 27 in Warsaw.
    vi.setSystemTime(new Date("2026-11-26T23:30:00Z"));
    render(<DatePicker timeZone="Europe/Warsaw" />);
    await openPicker();

    expect(focusedDay()).toBe("2026-11-27");
    expect(dayButton("2026-11-27").getAttribute("aria-current")).toBe("date");
    expect(dayButton("2026-11-26").hasAttribute("aria-current")).toBe(false);
  });

  it("starts the week on the given day", async () => {
    render(<DatePicker defaultValue="2026-11-26" weekStartsOn={0} />);
    await openPicker();

    expect([...document.querySelectorAll("thead th")].map((cell) => cell.textContent)).toEqual(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
    expect(document.querySelectorAll("tbody tr")[0]?.querySelectorAll("td")[0]?.querySelector("[data-day]")?.getAttribute("data-day")).toBe("2026-11-01");
  });
});

describe("DateTimePicker", () => {
  it("shows the date and time in the app's locale and the placeholder for no value", () => {
    expect(renderToStaticMarkup(<DateTimePicker value="2026-11-26T09:30" />)).toContain(">Nov 26, 2026, 9:30 AM<");
    expect(renderToStaticMarkup(<DateTimePicker value="2026-11-26T09:30" locale="pl-PL" />)).toContain(">26 lis 2026, 09:30<");
    expect(renderToStaticMarkup(<DateTimePicker name="at" />)).toContain(">Pick a date and time<");
  });

  it("keeps the picker open on a new day, keeps the time and closes on Done", async () => {
    const onValueChange = vi.fn();
    render(
      <form data-testid="form">
        <DateTimePicker defaultValue="2026-11-26T14:45" name="at" onValueChange={onValueChange} />
      </form>,
    );
    await openPicker();

    fireEvent.click(dayButton("2026-11-30"));
    await flush();
    expect(onValueChange).toHaveBeenLastCalledWith("2026-11-30T14:45");
    expect(isOpen()).toBe(true);

    fireEvent.change(select("Hours"), { target: { value: "8" } });
    expect(onValueChange).toHaveBeenLastCalledWith("2026-11-30T08:45");
    fireEvent.change(select("Minutes"), { target: { value: "5" } });
    expect(onValueChange).toHaveBeenLastCalledWith("2026-11-30T08:05");

    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    await flush();
    expect(isOpen()).toBe(false);
    expect(new FormData(screen.getByTestId<HTMLFormElement>("form")).get("at")).toBe("2026-11-30T08:05");
  });

  it("disables the time until a day is chosen, then starts from the default time", async () => {
    const onValueChange = vi.fn();
    render(<DateTimePicker onValueChange={onValueChange} defaultTime="10:00" />);
    await openPicker();

    expect(select("Hours").disabled).toBe(true);
    expect(select("Minutes").disabled).toBe(true);
    const today = focusedDay();
    if (today === null) throw new Error("no focused day");
    fireEvent.click(dayButton(today));
    expect(onValueChange).toHaveBeenLastCalledWith(`${today}T10:00`);
    expect(select("Hours").disabled).toBe(false);
  });

  it("offers minutes by the step and labels the hours in the locale", async () => {
    render(<DateTimePicker defaultValue="2026-11-26T09:30" minuteStep={15} />);
    await openPicker();

    expect([...select("Minutes").options].map((option) => option.textContent)).toEqual(["00", "15", "30", "45"]);
    expect(select("Hours").options[0]?.textContent).toBe("12 AM");
    expect(select("Hours").options[13]?.textContent).toBe("1 PM");
    expect(select("Hours").value).toBe("9");
    expect(select("Minutes").value).toBe("30");
  });

  it("disables the times before min on min's day and clamps a new day's time into the range", async () => {
    const onValueChange = vi.fn();
    render(<DateTimePicker defaultValue="2026-11-27T08:00" min="2026-11-26T13:20" minuteStep={15} onValueChange={onValueChange} />);
    await openPicker();

    fireEvent.click(dayButton("2026-11-26"));
    // 08:00 is before min, so the time moves to min rounded up to the step.
    expect(onValueChange).toHaveBeenLastCalledWith("2026-11-26T13:30");
    expect(select("Hours").options[12]?.disabled).toBe(true);
    expect(select("Hours").options[13]?.disabled).toBe(false);
    expect([...select("Minutes").options].map((option) => option.disabled)).toEqual([true, true, false, false]);
    expect(dayButton("2026-11-25").disabled).toBe(true);
  });

  it("shows the time zone next to the time field", async () => {
    render(<DateTimePicker defaultValue="2026-11-26T09:30" timeZone="Europe/Warsaw" />);
    await openPicker();

    expect(document.querySelector('[data-slot="date-picker-time"]')?.textContent).toContain("Europe/Warsaw");
  });
});
