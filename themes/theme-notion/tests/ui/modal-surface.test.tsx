// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from "../../src/ui/alert-dialog.js";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../../src/ui/dialog.js";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "../../src/ui/sheet.js";

afterEach(cleanup);

const SHEET_SIDES = ["top", "right", "bottom", "left"] as const;

function readSlotClasses(slot: string): string[] {
  return (document.querySelector(`[data-slot="${slot}"]`)?.getAttribute("class") ?? "").split(/\s+/);
}

function expectRaisedSurface(classes: readonly string[]): void {
  expect(classes).toEqual(expect.arrayContaining(["bg-popover", "text-popover-foreground"]));
  expect(classes).not.toContain("bg-background");
}

describe("modal surfaces", () => {
  it("paints DialogContent on popover, so a dark dialog stands out from the dimmed page", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Rename</DialogTitle>
          <DialogDescription>Pick a new name.</DialogDescription>
        </DialogContent>
      </Dialog>,
    );

    expectRaisedSurface(readSlotClasses("dialog-content"));
  });

  it("paints AlertDialogContent on popover", () => {
    render(
      <AlertDialog open>
        <AlertDialogContent>
          <AlertDialogTitle>Delete the page?</AlertDialogTitle>
          <AlertDialogDescription>It goes to the trash.</AlertDialogDescription>
        </AlertDialogContent>
      </AlertDialog>,
    );

    expectRaisedSurface(readSlotClasses("alert-dialog-content"));
  });

  it.each(SHEET_SIDES)("paints SheetContent on popover from the %s side", (side) => {
    render(
      <Sheet open>
        <SheetContent side={side}>
          <SheetTitle>Menu</SheetTitle>
          <SheetDescription>Pages and settings.</SheetDescription>
        </SheetContent>
      </Sheet>,
    );

    expectRaisedSurface(readSlotClasses("sheet-content"));
  });
});
