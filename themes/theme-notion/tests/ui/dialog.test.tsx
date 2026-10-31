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

function renderSizedDialog(size?: "sm" | "default" | "wide" | "lg") {
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

  it("keeps the default and wide dialogs' height by content, with no height class", () => {
    for (const size of [undefined, "wide"] as const) {
      const classes = renderSizedDialog(size);

      expect(classes.filter((name) => /(^|:)(min-|max-)?h-/.test(name))).toEqual([]);
      expect(classes).toContain("grid");
      cleanup();
    }
  });

  it("centres a large popup with a quarter of the viewport free on every side from lg", () => {
    const classes = renderSizedDialog("lg");

    expect(classes).toEqual(expect.arrayContaining(["lg:max-w-1/2", "lg:h-1/2", "lg:min-h-96", "top-[50%]", "left-[50%]"]));
  });

  it("draws a large popup three quarters of the viewport from sm and inside the phone gutter below", () => {
    const classes = renderSizedDialog("lg");

    expect(classes).toEqual(expect.arrayContaining(["max-w-[calc(100%-2rem)]", "h-[calc(100dvh-2rem)]", "sm:max-w-3/4", "sm:h-3/4"]));
    expect(classes).not.toContain("sm:max-w-lg");
  });

  it("stacks a large popup's content in a column that scrolls inside its fixed height", () => {
    const classes = renderSizedDialog("lg");

    expect(classes).toEqual(expect.arrayContaining(["flex", "flex-col", "overflow-y-auto"]));
    expect(classes).not.toContain("grid");
  });

  it("draws a small popup narrower than the default, its height by content up to the viewport's gutter", () => {
    const classes = renderSizedDialog("sm");

    expect(classes).toEqual(expect.arrayContaining(["max-w-[calc(100%-2rem)]", "sm:max-w-md", "max-h-[calc(100dvh-2rem)]", "overflow-y-auto"]));
    expect(classes).not.toContain("sm:max-w-lg");
    expect(classes).not.toContain("lg:max-w-1/2");
    expect(classes.filter((name) => /(^|:)h-/.test(name))).toEqual([]);
  });

  it("lets the app's className override a size's class", () => {
    render(
      <Dialog open>
        <DialogContent size="lg" className="gap-0 p-0">
          <DialogTitle>Edit</DialogTitle>
          <DialogDescription>Change the fields.</DialogDescription>
        </DialogContent>
      </Dialog>,
    );
    const classes = readClasses(document.querySelector('[data-slot="dialog-content"]'));

    expect(classes).toEqual(expect.arrayContaining(["gap-0", "p-0", "lg:h-1/2"]));
    expect(classes).not.toContain("p-6");
    expect(classes).not.toContain("gap-4");
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
