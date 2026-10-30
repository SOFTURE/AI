// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "../../src/ui/dialog.js";

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

function renderSizedDialog(size?: "default" | "wide") {
  render(
    <Dialog open>
      <DialogContent {...(size === undefined ? {} : { size })}>
        <DialogTitle>Add a note</DialogTitle>
        <DialogDescription>The note goes under the list.</DialogDescription>
      </DialogContent>
    </Dialog>,
  );
  return readClasses(document.querySelector('[data-slot="dialog-content"]'));
}

describe("DialogContent size", () => {
  it("caps the dialog at max-w-lg from sm by default", () => {
    const classes = renderSizedDialog();

    expect(classes).toEqual(expect.arrayContaining(["max-w-[calc(100%-2rem)]", "sm:max-w-lg"]));
    expect(classes).not.toContain("lg:max-w-1/2");
  });

  it("draws a wide dialog half the viewport wide from lg, max-w-lg below and the phone gutter", () => {
    const classes = renderSizedDialog("wide");

    expect(classes).toEqual(expect.arrayContaining(["max-w-[calc(100%-2rem)]", "sm:max-w-lg", "lg:max-w-1/2"]));
  });
});

function renderFooter(closeLabel?: string) {
  render(
    <Dialog open>
      <DialogContent showCloseButton={false}>
        <DialogTitle>Add a note</DialogTitle>
        <DialogDescription>The note goes under the list.</DialogDescription>
        <DialogFooter showCloseButton {...(closeLabel === undefined ? {} : { closeLabel })} />
      </DialogContent>
    </Dialog>,
  );
}

describe("DialogFooter close button", () => {
  it("names the button with the app's closeLabel", () => {
    renderFooter("Anuluj");

    expect(screen.getByRole("button").textContent).toBe("Anuluj");
  });

  it("names the button with the package's message by default", () => {
    renderFooter();

    expect(screen.getByRole("button").textContent).toBe("Close");
  });
});
