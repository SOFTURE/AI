// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Button } from "../../src/ui/button.js";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../../src/ui/dialog.js";
import { Input } from "../../src/ui/input.js";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "../../src/ui/sheet.js";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../src/ui/tooltip.js";

afterEach(cleanup);

function HelpTooltip() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button">Help</button>
      </TooltipTrigger>
      <TooltipContent>Which provider runs the routine.</TooltipContent>
    </Tooltip>
  );
}

function renderForm(container: "dialog" | "sheet", body: React.ReactNode, onOpenAutoFocus?: (event: Event) => void) {
  const handler = onOpenAutoFocus === undefined ? {} : { onOpenAutoFocus };
  if (container === "dialog") {
    render(
      <TooltipProvider>
        <Dialog open>
          <DialogContent {...handler}>
            <DialogTitle>Add routine</DialogTitle>
            <DialogDescription>Pick a provider.</DialogDescription>
            {body}
          </DialogContent>
        </Dialog>
      </TooltipProvider>,
    );
    return;
  }
  render(
    <TooltipProvider>
      <Sheet open>
        <SheetContent {...handler}>
          <SheetTitle>Add routine</SheetTitle>
          <SheetDescription>Pick a provider.</SheetDescription>
          {body}
        </SheetContent>
      </Sheet>
    </TooltipProvider>,
  );
}

describe.each(["dialog", "sheet"] as const)("%s content auto-focus", (container) => {
  it("focuses the first field, not a tooltip trigger before it, and shows no tooltip", () => {
    renderForm(
      container,
      <>
        <HelpTooltip />
        <Input aria-label="Provider" />
      </>,
    );

    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Provider" }));
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("skips a disabled or hidden input", () => {
    renderForm(
      container,
      <>
        <HelpTooltip />
        <input type="hidden" name="id" value="7" />
        <Input aria-label="Locked" disabled />
        <textarea aria-label="Notes" />
      </>,
    );

    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Notes" }));
  });

  it("focuses a combobox as a field", () => {
    renderForm(
      container,
      <>
        <HelpTooltip />
        <button type="button" role="combobox" aria-label="Provider" aria-expanded="false" aria-controls="none">
          Provider
        </button>
      </>,
    );

    expect(document.activeElement).toBe(screen.getByRole("combobox", { name: "Provider" }));
  });

  it("keeps the default focus when the content has no field", () => {
    renderForm(container, <Button>Continue</Button>);

    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Continue" }));
  });

  it("leaves the focus to the app's onOpenAutoFocus that prevents the default", () => {
    renderForm(
      container,
      <>
        <Button>Skip</Button>
        <Input aria-label="Provider" />
      </>,
      (event) => event.preventDefault(),
    );

    expect(document.activeElement).not.toBe(screen.getByRole("textbox", { name: "Provider" }));
  });

  it("still shows the tooltip when the trigger gets keyboard focus", () => {
    renderForm(
      container,
      <>
        <HelpTooltip />
        <Input aria-label="Provider" />
      </>,
    );

    fireEvent.focus(screen.getByRole("button", { name: "Help" }));

    expect(screen.getByRole("tooltip")).toBeTruthy();
  });
});
