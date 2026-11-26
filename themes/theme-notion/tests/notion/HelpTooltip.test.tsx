// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HelpTooltip } from "../../src/notion/HelpTooltip.js";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function renderHelp(): HTMLElement {
  render(
    <HelpTooltip label="Help for Email" hintId="email-hint">
      Use your work address.
    </HelpTooltip>,
  );
  return screen.getByRole("button", { name: "Help for Email" });
}

function isOpen(button: HTMLElement): boolean {
  return button.getAttribute("data-state") !== "closed";
}

/** Lets Radix's zero-delay open timer and the dismissable layer's deferred listeners run. */
async function flush(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe("HelpTooltip", () => {
  it("renders a ghost icon button named Help, a touch target on a phone, with the hint hidden for aria-describedby", () => {
    const html = renderToStaticMarkup(<HelpTooltip hintId="email-hint">Use your work address.</HelpTooltip>);

    expect(html).toContain('data-slot="help-tooltip-trigger"');
    expect(html).toContain('aria-label="Help"');
    expect(html).toContain('type="button"');
    expect(html).toContain('data-variant="ghost"');
    expect(html).toContain("max-md:size-touch-target");
    expect(html).toContain('<span id="email-hint" data-slot="help-tooltip-hint" class="sr-only">Use your work address.</span>');
  });

  it("stays open after a press whose pointer left and came back before the release (#1503)", async () => {
    const button = renderHelp();

    fireEvent.pointerMove(button, { pointerType: "mouse" });
    await flush();
    expect(isOpen(button)).toBe(true);

    fireEvent.pointerDown(button, { pointerType: "mouse" });
    fireEvent.pointerLeave(button, { pointerType: "mouse" });
    fireEvent.pointerMove(button, { pointerType: "mouse" });
    await flush();
    fireEvent.pointerUp(button, { pointerType: "mouse" });
    fireEvent.click(button);
    await flush();

    expect(isOpen(button)).toBe(true);
    expect(screen.getByRole("tooltip").textContent).toBe("Use your work address.");
  });

  it("opens on a tap and stays open on a second tap", async () => {
    const button = renderHelp();

    fireEvent.pointerDown(button, { pointerType: "touch" });
    fireEvent.pointerUp(button, { pointerType: "touch" });
    fireEvent.pointerLeave(button, { pointerType: "touch" });
    fireEvent.click(button);
    await flush();
    expect(isOpen(button)).toBe(true);

    fireEvent.pointerDown(button, { pointerType: "touch" });
    fireEvent.click(button);
    await flush();
    expect(isOpen(button)).toBe(true);
  });

  it("opens on focus and closes on blur", async () => {
    const button = renderHelp();

    fireEvent.focus(button);
    await flush();
    expect(isOpen(button)).toBe(true);

    fireEvent.blur(button);
    await flush();
    expect(isOpen(button)).toBe(false);
  });

  it("closes on Escape", async () => {
    const button = renderHelp();
    fireEvent.click(button);
    await flush();
    expect(isOpen(button)).toBe(true);

    fireEvent.keyDown(document.body, { key: "Escape" });
    await flush();
    expect(isOpen(button)).toBe(false);
  });

  it("closes on a press outside", async () => {
    const button = renderHelp();
    fireEvent.click(button);
    await flush();
    expect(isOpen(button)).toBe(true);

    fireEvent.pointerDown(document.body, { pointerType: "mouse" });
    await flush();
    expect(isOpen(button)).toBe(false);
  });

  it("tells the app when it opens and closes", async () => {
    const onOpenChange = vi.fn<(isOpen: boolean) => void>();
    render(
      <HelpTooltip onOpenChange={onOpenChange} hintId="hint">
        Hint
      </HelpTooltip>,
    );
    const button = screen.getByRole("button", { name: "Help" });

    fireEvent.click(button);
    await flush();
    fireEvent.keyDown(document.body, { key: "Escape" });
    await flush();

    expect(onOpenChange.mock.calls).toEqual([[true], [false]]);
  });

  it("gives the hidden hint a generated id when the app gives none", () => {
    render(<HelpTooltip>Hint</HelpTooltip>);

    const hint = document.querySelector('[data-slot="help-tooltip-hint"]');
    expect(hint?.id).toMatch(/.+/);
    expect(hint?.textContent).toBe("Hint");
  });
});
