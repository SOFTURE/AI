// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../../src/ui/dialog.js";

afterEach(cleanup);

function readClasses(element: Element | null | undefined): string[] {
  return (element?.getAttribute("class") ?? "").split(/\s+/);
}

function renderDialog(closeButtonSize?: "default" | "touch") {
  render(
    <Dialog open>
      <DialogContent {...(closeButtonSize === undefined ? {} : { closeButtonSize })}>
        <DialogTitle>Rename</DialogTitle>
        <DialogDescription>Pick a new name.</DialogDescription>
      </DialogContent>
    </Dialog>,
  );
  return readClasses(screen.getByRole("button", { name: "Close" }));
}

describe("DialogContent", () => {
  it("keeps the bare 16 px close icon at the corner by default", () => {
    const classes = renderDialog();

    expect(classes).toEqual(expect.arrayContaining(["top-4", "right-4"]));
    expect(classes).not.toContain("size-touch-target");
  });

  it("draws a 44 x 44 close button centred on the same icon at the touch size", () => {
    const classes = renderDialog("touch");

    expect(classes).toEqual(expect.arrayContaining(["size-touch-target", "top-0.5", "right-0.5", "inline-flex", "items-center", "justify-center"]));
    expect(classes).not.toContain("top-4");
    expect(classes).not.toContain("right-4");
  });
});
