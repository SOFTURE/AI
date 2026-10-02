// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Button, getNextFocusTarget, Modal, ModalBody, ModalFooter, ModalForm, type ModalWidth, uiMessages } from "../src/index.js";

afterEach(cleanup);

function renderModal({
  subtitle,
  width,
  isPending = false,
  error,
  onClose = vi.fn(),
  locale,
}: { subtitle?: string; width?: ModalWidth; isPending?: boolean; error?: string; onClose?: () => void; locale?: "en" | "pl" } = {}) {
  render(
    <Modal title="Edit debt" subtitle={subtitle} width={width} onClose={onClose} isDismissible={!isPending} locale={locale}>
      <ModalForm action={() => undefined}>
        <ModalBody>
          <input name="name" aria-label="Name" />
        </ModalBody>
        <ModalFooter onCancel={onClose} isPending={isPending} error={error} locale={locale}>
          <Button type="submit" variant="primary">
            Save
          </Button>
        </ModalFooter>
      </ModalForm>
    </Modal>,
  );
  return { dialog: screen.getByRole("dialog"), onClose };
}

describe("Modal markup", () => {
  it("is a modal dialog labelled by its h2 title, with one heading", () => {
    const { dialog } = renderModal();
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading.textContent).toBe("Edit debt");
    expect(dialog.getAttribute("aria-labelledby")).toBe(heading.id);
    expect(screen.getAllByRole("heading")).toHaveLength(1);
  });

  it("is described by the subtitle, and by nothing without one", () => {
    const { dialog } = renderModal({ subtitle: "Monthly payment" });
    const describedBy = dialog.getAttribute("aria-describedby");
    expect(describedBy === null ? null : document.getElementById(describedBy)?.textContent).toBe("Monthly payment");
    cleanup();
    expect(renderModal().dialog.hasAttribute("aria-describedby")).toBe(false);
  });

  it("closes with an icon button named in the locale", () => {
    renderModal({ locale: "pl" });
    expect(screen.getByRole("button", { name: uiMessages.pl.modal.close }).getAttribute("data-variant")).toBe("icon");
    expect(screen.getByRole("button", { name: uiMessages.pl.modal.cancel })).toBeDefined();
  });

  it("renders into a portal on body, in header, body, footer order", () => {
    const { dialog } = renderModal();
    expect(dialog.parentElement?.parentElement).toBe(document.body);
    expect([...dialog.querySelectorAll("[data-modal-part]")].map((part) => part.getAttribute("data-modal-part"))).toEqual([
      "header",
      "body",
      "footer",
    ]);
  });

  it("scrolls only the body", () => {
    const { dialog } = renderModal();
    expect(dialog.querySelector('[data-modal-part="body"]')?.className).toContain("sft:overflow-y-auto");
    expect(dialog.parentElement?.className).not.toContain("overflow-y-auto");
  });

  it("puts Cancel before the primary action and the save error above them", () => {
    const { dialog } = renderModal({ error: "Could not save" });
    const footer = dialog.querySelector('[data-modal-part="footer"]');
    expect(footer?.firstElementChild?.getAttribute("role")).toBe("alert");
    expect([...(footer?.querySelectorAll("button") ?? [])].map((button) => button.textContent)).toEqual([uiMessages.en.modal.cancel, "Save"]);
  });

  it("reserves no room for an error without one", () => {
    expect(renderModal().dialog.querySelector('[role="alert"]')).toBeNull();
  });

  it("is a sheet from the bottom on a phone and centred from sm; the confirmation is narrow", () => {
    const { dialog } = renderModal();
    expect(dialog.className).toContain("sft:rounded-t-card");
    expect(dialog.className).toContain("sft:sm:rounded-card");
    expect(dialog.className).toContain("sft:sm:w-1/2");
    cleanup();
    expect(renderModal({ width: "confirmation" }).dialog.className).toContain("sft:sm:max-w-md");
  });

  it("makes the form span body and footer without a box of its own", () => {
    const { dialog } = renderModal();
    expect(dialog.querySelector("form")?.className).toBe("sft:contents");
  });
});

describe("Modal behaviour", () => {
  it("moves focus into the panel when it opens", () => {
    const { dialog } = renderModal();
    expect(document.activeElement).toBe(dialog);
  });

  it("cycles Tab and Shift+Tab inside the dialog", () => {
    const { dialog } = renderModal();
    const close = screen.getByRole("button", { name: uiMessages.en.modal.close });
    const save = screen.getByRole("button", { name: "Save" });
    save.focus();
    fireEvent.keyDown(save, { key: "Tab" });
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(close, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(save);
    dialog.focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(document.activeElement).toBe(close);
  });

  it("closes on Escape, the close button and Cancel", () => {
    const { onClose } = renderModal();
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: uiMessages.en.modal.close }));
    fireEvent.click(screen.getByRole("button", { name: uiMessages.en.modal.cancel }));
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("ignores an Escape handled inside (an open select list closes first)", () => {
    const { onClose } = renderModal();
    const escape = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    escape.preventDefault();
    document.dispatchEvent(escape);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes on a backdrop click only when the press started on the backdrop", () => {
    const { dialog, onClose } = renderModal();
    const backdrop = dialog.parentElement ?? dialog;
    fireEvent.mouseDown(dialog);
    fireEvent.click(backdrop);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.mouseDown(backdrop);
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("does not close while a save runs: Escape, backdrop and buttons do nothing", () => {
    const { dialog, onClose } = renderModal({ isPending: true });
    fireEvent.keyDown(document, { key: "Escape" });
    const backdrop = dialog.parentElement ?? dialog;
    fireEvent.mouseDown(backdrop);
    fireEvent.click(backdrop);
    expect(screen.getByRole<HTMLButtonElement>("button", { name: uiMessages.en.modal.close }).disabled).toBe(true);
    expect(screen.getByRole<HTMLButtonElement>("button", { name: uiMessages.en.modal.cancel }).disabled).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("makes the page inert and locks its scroll while open, keeping live regions reachable", () => {
    function Page() {
      const [isOpen, setIsOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setIsOpen(true)}>
            Open
          </button>
          {isOpen ? (
            <Modal title="T" onClose={() => setIsOpen(false)}>
              <ModalBody>body</ModalBody>
            </Modal>
          ) : null}
        </>
      );
    }
    const live = document.createElement("div");
    live.setAttribute("role", "status");
    document.body.append(live);
    const { container } = render(<Page />);
    const opener = screen.getByRole("button", { name: "Open" });
    opener.focus();
    fireEvent.click(opener);
    expect(container.inert).toBe(true);
    expect(live.inert).toBe(false);
    expect(document.body.style.overflow).toBe("hidden");
    act(() => {
      fireEvent.keyDown(document, { key: "Escape" });
    });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(container.inert).toBe(false);
    expect(document.body.style.overflow).toBe("");
    expect(document.activeElement).toBe(opener);
    live.remove();
  });

  it("closes only the top dialog of a nested pair on Escape", () => {
    const outer = vi.fn();
    const inner = vi.fn();
    render(
      <>
        <Modal title="Outer" onClose={outer}>
          <ModalBody>outer</ModalBody>
        </Modal>
        <Modal title="Inner" onClose={inner}>
          <ModalBody>inner</ModalBody>
        </Modal>
      </>,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(inner).toHaveBeenCalledOnce();
    expect(outer).not.toHaveBeenCalled();
  });

  it("restores the page when two dialogs close out of order", () => {
    function Page({ isFirstOpen, isSecondOpen }: { isFirstOpen: boolean; isSecondOpen: boolean }) {
      return (
        <>
          <main>page</main>
          {isFirstOpen ? (
            <Modal title="First" onClose={() => undefined}>
              <ModalBody>first</ModalBody>
            </Modal>
          ) : null}
          {isSecondOpen ? (
            <Modal title="Second" onClose={() => undefined}>
              <ModalBody>second</ModalBody>
            </Modal>
          ) : null}
        </>
      );
    }
    const { container, rerender } = render(<Page isFirstOpen isSecondOpen={false} />);
    rerender(<Page isFirstOpen isSecondOpen />);
    rerender(<Page isFirstOpen={false} isSecondOpen />);
    expect(container.inert).toBe(true);
    expect(document.body.style.overflow).toBe("hidden");
    rerender(<Page isFirstOpen={false} isSecondOpen={false} />);
    expect(container.inert).toBe(false);
    expect(document.body.style.overflow).toBe("");
  });

  it("reaches one radio per group with Tab: the checked one", () => {
    render(
      <Modal title="T" onClose={() => undefined}>
        <ModalBody>
          <input type="radio" name="period" value="month" aria-label="Month" />
          <input type="radio" name="period" value="year" aria-label="Year" defaultChecked />
          <input type="radio" name="period" value="all" aria-label="All" />
        </ModalBody>
      </Modal>,
    );
    const close = screen.getByRole("button", { name: uiMessages.en.modal.close });
    const year = screen.getByRole("radio", { name: "Year" });
    year.focus();
    fireEvent.keyDown(year, { key: "Tab" });
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(close, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(year);
  });
});

describe("getNextFocusTarget", () => {
  const elements = ["first", "middle", "last"];

  it("wraps Tab on the last element to the first", () => {
    expect(getNextFocusTarget(elements, "last", false)).toBe("first");
  });

  it("wraps Shift+Tab on the first element to the last", () => {
    expect(getNextFocusTarget(elements, "first", true)).toBe("last");
  });

  it("from the panel itself goes to the first, or with Shift+Tab to the last", () => {
    expect(getNextFocusTarget(elements, "panel", false)).toBe("first");
    expect(getNextFocusTarget(elements, "panel", true)).toBe("last");
  });

  it("leaves a move in the middle to the browser", () => {
    expect(getNextFocusTarget(elements, "middle", false)).toBeNull();
    expect(getNextFocusTarget(elements, "middle", true)).toBeNull();
  });

  it("has no target in an empty list", () => {
    expect(getNextFocusTarget([], "x", false)).toBeNull();
  });
});
