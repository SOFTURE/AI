// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type ActionResult,
  ConfirmActionButton,
  type ConfirmActionResult,
  CopyButton,
  DisclosureMenu,
  ExternalLink,
  getAnnouncedToast,
  getDismissalDate,
  getExternalRel,
  isDismissalActive,
  ModalTrigger,
  SEGMENT_ACTIVE_CLASS,
  SegmentedControl,
  TextField,
  uiMessages,
  useDismissed,
} from "../src/index.js";

// Issue #319: interaction components adopting apps kept re-writing, and a non-colour cue on the
// checked segment.

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("DisclosureMenu (#319.1)", () => {
  function renderMenu(closeKey = "/a") {
    const view = render(
      <>
        <DisclosureMenu label="Account" closeKey={closeKey}>
          <a href="#profile">Profile</a>
          <a href="#billing">Billing</a>
        </DisclosureMenu>
        <button type="button">Outside</button>
      </>,
    );
    const trigger = screen.getByRole("button", { name: "Account" });
    const panel = document.getElementById(trigger.getAttribute("aria-controls") ?? "");
    if (panel === null) throw new Error("the trigger controls no panel");
    return { ...view, trigger, panel };
  }

  it("is a button controlling a hidden panel that the button shows and hides", () => {
    const { trigger, panel } = renderMenu();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(panel.hidden).toBe(true);
    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(panel.hidden).toBe(false);
    fireEvent.click(trigger);
    expect(panel.hidden).toBe(true);
  });

  it("closes on Escape and returns focus to the trigger", () => {
    const { trigger, panel } = renderMenu();
    fireEvent.click(trigger);
    screen.getByRole("link", { name: "Profile" }).focus();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    expect(panel.hidden).toBe(true);
    expect(document.activeElement).toBe(trigger);
  });

  it("closes on an outside press heard in the capture phase, even when the target stops propagation", () => {
    const { trigger, panel } = renderMenu();
    fireEvent.click(trigger);
    const outside = screen.getByRole("button", { name: "Outside" });
    outside.addEventListener("pointerdown", (event) => event.stopPropagation());
    fireEvent.pointerDown(outside);
    expect(panel.hidden).toBe(true);
    expect(document.activeElement).not.toBe(trigger);
  });

  it("stays open on a press inside the panel and closes on a link click there", () => {
    const { trigger, panel } = renderMenu();
    fireEvent.click(trigger);
    fireEvent.pointerDown(panel);
    expect(panel.hidden).toBe(false);
    fireEvent.click(screen.getByRole("link", { name: "Billing" }));
    expect(panel.hidden).toBe(true);
  });

  it("closes when the closeKey (the route) changes", () => {
    const { trigger, panel, rerender } = renderMenu("/a");
    fireEvent.click(trigger);
    rerender(
      <>
        <DisclosureMenu label="Account" closeKey="/b">
          <a href="#profile">Profile</a>
        </DisclosureMenu>
        <button type="button">Outside</button>
      </>,
    );
    expect(panel.hidden).toBe(true);
  });

  it("closes when keyboard focus leaves, but not when a pointer moved focus inside", () => {
    const { trigger, panel } = renderMenu();
    fireEvent.click(trigger);
    fireEvent.pointerDown(panel);
    fireEvent.focusIn(document.body);
    expect(panel.hidden).toBe(false);
    fireEvent.keyDown(document.body, { key: "Tab" });
    fireEvent.focusIn(screen.getByRole("button", { name: "Outside" }));
    expect(panel.hidden).toBe(true);
  });

  it("names an icon-only trigger by its label", () => {
    render(
      <DisclosureMenu label="Menu" isLabelHidden icon={<svg aria-hidden="true" />}>
        <a href="#x">X</a>
      </DisclosureMenu>,
    );
    const trigger = screen.getByRole("button", { name: "Menu" });
    expect(trigger.textContent).toBe("");
  });
});

describe("ConfirmActionButton (#319.2)", () => {
  function renderConfirm(action: () => Promise<ConfirmActionResult>, onSuccess = vi.fn()) {
    render(
      <ConfirmActionButton
        label="Delete account"
        title="Delete this account?"
        description="All data is removed. This cannot be undone."
        confirmLabel="Delete"
        successMessage="Deleted"
        action={action}
        onSuccess={onSuccess}
      />,
    );
    return { trigger: screen.getByRole("button", { name: "Delete account" }), onSuccess };
  }

  it("opens a confirmation dialog stating the stakes, without running the action", () => {
    const action = vi.fn(() => Promise.resolve<ConfirmActionResult>({ ok: true }));
    const { trigger } = renderConfirm(action);
    expect(trigger.getAttribute("data-variant")).toBe("danger");
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Delete this account?" });
    expect(dialog.textContent).toContain("This cannot be undone.");
    expect(action).not.toHaveBeenCalled();
  });

  it("on success closes and announces the server's message, else successMessage", async () => {
    const { trigger, onSuccess } = renderConfirm(() => Promise.resolve({ ok: true, message: "Account deleted" }));
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await flush();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(getAnnouncedToast()?.message).toBe("Account deleted");
    expect(onSuccess).toHaveBeenCalledOnce();
    cleanup();

    const second = renderConfirm(() => Promise.resolve({ ok: true }));
    fireEvent.click(second.trigger);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await flush();
    expect(getAnnouncedToast()?.message).toBe("Deleted");
  });

  it("on failure stays open with the error, which does not expire", async () => {
    vi.useFakeTimers();
    const { trigger, onSuccess } = renderConfirm(() => Promise.resolve({ ok: false, error: "Account has open loans." }));
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await flush();
    expect(screen.getByRole("alert").textContent).toBe("Account has open loans.");
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.getByRole("dialog")).toBeDefined();
    expect(screen.getByRole("alert").textContent).toBe("Account has open loans.");
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("turns a rejected action into the package's error copy", async () => {
    const report = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { trigger } = renderConfirm(() => Promise.reject(new TypeError("Failed to fetch")));
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await flush();
    expect(screen.getByRole("alert").textContent).toBe(uiMessages.en.confirmAction.failed);
    expect(report).toHaveBeenCalledOnce();
  });

  it("cannot be dismissed while the action runs", async () => {
    let finish: (result: ConfirmActionResult) => void = () => undefined;
    const { trigger } = renderConfirm(() => new Promise((resolve) => (finish = resolve)));
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await flush();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByRole("dialog")).toBeDefined();
    expect(screen.getByRole<HTMLButtonElement>("button", { name: uiMessages.en.modal.cancel }).disabled).toBe(true);
    await act(async () => {
      finish({ ok: true });
      await Promise.resolve();
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("ModalTrigger and ActionFormModal (#319.3)", () => {
  function renderTrigger(action: (formData: FormData) => Promise<ActionResult>) {
    render(
      <ModalTrigger label="Add debt" title="New debt" action={action} getErrorMessage={(code) => code} submitLabel="Save" successMessage="Added">
        <TextField id="n" name="name" label="Name" />
      </ModalTrigger>,
    );
    return screen.getByRole("button", { name: "Add debt" });
  }

  async function submit() {
    const form = screen.getByRole("dialog").querySelector("form");
    if (form === null) throw new Error("the dialog holds no form");
    await act(async () => {
      fireEvent.submit(form);
      await Promise.resolve();
    });
    await flush();
  }

  it("is a bordered icon button that opens the form in a dialog", () => {
    const trigger = renderTrigger(() => Promise.resolve({ ok: true }));
    expect(trigger.getAttribute("data-variant")).toBe("icon");
    expect(trigger.getAttribute("aria-haspopup")).toBe("dialog");
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog", { name: "New debt" })).toBeDefined();
    expect(screen.getByLabelText("Name")).toBeDefined();
  });

  it("closes after a successful save, announces it and returns focus to the trigger", async () => {
    const trigger = renderTrigger(() => Promise.resolve({ ok: true }));
    trigger.focus();
    fireEvent.click(trigger);
    await submit();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(getAnnouncedToast()?.message).toBe("Added");
    expect(document.activeElement).toBe(trigger);
  });

  it("stays open after a rejected save, with the error", async () => {
    const trigger = renderTrigger(() => Promise.resolve({ ok: false, error: "app.save_failed" }));
    fireEvent.click(trigger);
    await submit();
    expect(screen.getByRole("dialog")).toBeDefined();
    expect(screen.getByRole("alert").textContent).toBe("app.save_failed");
  });

  it("closes on Cancel", () => {
    fireEvent.click(renderTrigger(() => Promise.resolve({ ok: true })));
    fireEvent.click(screen.getByRole("button", { name: uiMessages.en.modal.cancel }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("CopyButton (#319.4)", () => {
  const originalSecure = Object.getOwnPropertyDescriptor(window, "isSecureContext");
  const originalClipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");

  function setClipboard({ isSecure, writeText }: { isSecure: boolean; writeText?: (text: string) => Promise<void> }) {
    Object.defineProperty(window, "isSecureContext", { configurable: true, value: isSecure });
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: writeText === undefined ? undefined : { writeText } });
  }

  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    if (originalSecure !== undefined) Object.defineProperty(window, "isSecureContext", originalSecure);
    if (originalClipboard !== undefined) Object.defineProperty(navigator, "clipboard", originalClipboard);
  });

  it("copies the value, says Copied (also to the live region) and goes back to idle", async () => {
    vi.useFakeTimers();
    const writeText = vi.fn(() => Promise.resolve());
    setClipboard({ isSecure: true, writeText });
    render(<CopyButton value="sk-123" />);
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    await flush();
    expect(writeText).toHaveBeenCalledWith("sk-123");
    expect(screen.getByRole("button", { name: "Copied" })).toBeDefined();
    expect(screen.getByRole("status").textContent).toBe("Copied");
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByRole("button", { name: "Copy" })).toBeDefined();
    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("without a secure context shows the failed state and a selected field with the value", async () => {
    setClipboard({ isSecure: false });
    const onCopy = vi.fn();
    render(<CopyButton value="sk-123" onCopy={onCopy} locale="pl" />);
    fireEvent.click(screen.getByRole("button", { name: uiMessages.pl.copyButton.copy }));
    await flush();
    expect(screen.getByRole("button", { name: uiMessages.pl.copyButton.failed })).toBeDefined();
    const field = screen.getByLabelText<HTMLInputElement>(uiMessages.pl.copyButton.manualLabel);
    expect(field.value).toBe("sk-123");
    expect(field.readOnly).toBe(true);
    expect(document.activeElement).toBe(field);
    expect(screen.getByText(uiMessages.pl.copyButton.manualHint)).toBeDefined();
    expect(onCopy).toHaveBeenCalledWith("failed");
  });

  it("falls back to copying by hand when the clipboard refuses the write", async () => {
    setClipboard({ isSecure: true, writeText: () => Promise.reject(new Error("NotAllowedError")) });
    render(<CopyButton value="sk-123" isIconOnly />);
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    await flush();
    expect(screen.getByRole("button", { name: "Copy failed" }).getAttribute("data-variant")).toBe("icon");
    expect(screen.getByLabelText<HTMLInputElement>("Text to copy").value).toBe("sk-123");
  });
});

describe("ExternalLink (#319.5)", () => {
  it("opens a new tab with noopener noreferrer and a screen-reader note", () => {
    render(
      <ExternalLink href="https://example.com" rel="author">
        Docs
      </ExternalLink>,
    );
    const link = screen.getByRole("link");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("author noopener noreferrer");
    expect(link.textContent).toBe(`Docs ${uiMessages.en.externalLink.newTab}`);
    expect(link.querySelector("span")?.className).toBe("sft:sr-only");
  });

  it("names the new tab in the locale and keeps each rel token once", () => {
    render(
      <ExternalLink href="https://example.com" locale="pl">
        Blog
      </ExternalLink>,
    );
    expect(screen.getByRole("link").textContent).toBe(`Blog ${uiMessages.pl.externalLink.newTab}`);
    expect(getExternalRel(" noopener  nofollow ")).toBe("noopener nofollow noreferrer");
    expect(getExternalRel(undefined)).toBe("noopener noreferrer");
  });
});

describe("useDismissed (#319.6)", () => {
  function Banner({ days = 7 }: { days?: number }) {
    const { isDismissed, dismiss, restore } = useDismissed("banner.trial", days);
    return (
      <>
        {isDismissed ? null : <p>Trial ends soon</p>}
        <button type="button" onClick={dismiss}>
          Dismiss
        </button>
        <button type="button" onClick={restore}>
          Restore
        </button>
      </>
    );
  }

  beforeEach(() => {
    window.localStorage.clear();
  });

  it("stores the local date only and hides the notice", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 9, 23, 30));
    render(<Banner />);
    expect(screen.getByText("Trial ends soon")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByText("Trial ends soon")).toBeNull();
    expect(window.localStorage.getItem("banner.trial")).toBe("2026-10-09");
  });

  it("keeps the notice hidden for N calendar days, then shows it again", () => {
    window.localStorage.setItem("banner.trial", "2026-10-02");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 8, 12));
    render(<Banner />);
    expect(screen.queryByText("Trial ends soon")).toBeNull();
    cleanup();
    vi.setSystemTime(new Date(2026, 9, 9, 0, 1));
    render(<Banner />);
    expect(screen.getByText("Trial ends soon")).toBeDefined();
  });

  it("restore forgets the dismissal", () => {
    window.localStorage.setItem("banner.trial", getDismissalDate(new Date()));
    render(<Banner />);
    expect(screen.queryByText("Trial ends soon")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Restore" }));
    expect(screen.getByText("Trial ends soon")).toBeDefined();
    expect(window.localStorage.getItem("banner.trial")).toBeNull();
  });

  it("with blocked storage shows the notice and still dismisses it for the page", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const block = () => {
      throw new DOMException("blocked", "SecurityError");
    };
    // Restored here, not only by the file's afterEach: a Storage.prototype spy left over would break the next test.
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(block);
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(block);
    try {
      render(<Banner />);
      expect(screen.getByText("Trial ends soon")).toBeDefined();
      fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
      expect(screen.queryByText("Trial ends soon")).toBeNull();
    } finally {
      getItem.mockRestore();
      setItem.mockRestore();
    }
  });

  it("isDismissalActive reads only date-only values and counts calendar days", () => {
    const now = new Date(2026, 9, 9, 8);
    expect(isDismissalActive({ value: "2026-10-09", days: 1, now })).toBe(true);
    expect(isDismissalActive({ value: "2026-10-08", days: 1, now })).toBe(false);
    expect(isDismissalActive({ value: "2026-10-03", days: 7, now })).toBe(true);
    expect(isDismissalActive({ value: "2026-10-02", days: 7, now })).toBe(false);
    expect(isDismissalActive({ value: "2026-10-09T08:00:00Z", days: 7, now })).toBe(false);
    expect(isDismissalActive({ value: "true", days: 7, now })).toBe(false);
    expect(isDismissalActive({ value: null, days: 7, now })).toBe(false);
    expect(isDismissalActive({ value: "2026-10-10", days: 7, now })).toBe(false);
  });
});

describe("SegmentedControl non-colour cue (#319)", () => {
  it("marks the checked segment with an inset ring as well as the accent fill", () => {
    function Period() {
      const [value, setValue] = useState<"month" | "year">("month");
      return (
        <SegmentedControl
          legend="Period"
          value={value}
          onChange={setValue}
          options={[
            { value: "month", label: "Month" },
            { value: "year", label: "Year" },
          ]}
        />
      );
    }
    render(<Period />);
    const option = screen.getByLabelText("Month").closest("label");
    const classes = (option?.className ?? "").split(" ");
    expect(classes).toEqual(expect.arrayContaining(["sft:has-checked:bg-accent-fill", "sft:has-checked:ring-1", "sft:has-checked:ring-inset", "sft:has-checked:ring-foreground"]));
    expect(SEGMENT_ACTIVE_CLASS.split(" ")).toEqual(expect.arrayContaining(["sft:bg-accent-fill", "sft:ring-1", "sft:ring-inset", "sft:ring-foreground"]));
  });
});
