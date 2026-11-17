// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { COPY_BUTTON_RESET_MS, CopyButton } from "../../src/notion/CopyButton.js";

const writeText = vi.fn<(text: string) => Promise<void>>();

beforeEach(() => {
  writeText.mockReset();
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("CopyButton", () => {
  it("renders a secondary button that says Copy, with a hidden icon and no value in its name", () => {
    const html = renderToStaticMarkup(<CopyButton value="https://example.test/api/mcp" />);

    expect(html.startsWith("<button")).toBe(true);
    expect(html).toContain('data-slot="copy-button"');
    expect(html).toContain('data-variant="secondary"');
    expect(html).toContain('type="button"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('<span aria-live="polite">Copy</span>');
    expect(html).not.toContain("example.test");
    expect(html).not.toContain("data-copied");
  });

  it("writes the value, says Copied, tells the app, then goes back after two seconds", async () => {
    vi.useFakeTimers();
    writeText.mockResolvedValue(undefined);
    const onCopied = vi.fn();
    render(<CopyButton value="https://example.test/api/mcp" label="Copy the URL" copiedLabel="URL copied" onCopied={onCopied} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy the URL" }));
      await Promise.resolve();
    });

    expect(writeText).toHaveBeenCalledWith("https://example.test/api/mcp");
    expect(onCopied).toHaveBeenCalledTimes(1);
    const button = screen.getByRole("button", { name: "URL copied" });
    expect(button.dataset["copied"]).toBe("");

    act(() => {
      vi.advanceTimersByTime(COPY_BUTTON_RESET_MS);
    });
    expect(screen.getByRole("button", { name: "Copy the URL" }).dataset["copied"]).toBeUndefined();
  });

  it("says Copied in English when the app gives no word", async () => {
    writeText.mockResolvedValue(undefined);
    render(<CopyButton value="x" />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy" }));
      await Promise.resolve();
    });

    expect(screen.getByRole("button", { name: "Copied" })).toBeDefined();
  });

  it("stays as it was when the browser refuses the write", async () => {
    writeText.mockRejectedValue(new Error("denied"));
    const onCopied = vi.fn();
    render(<CopyButton value="secret-free value" onCopied={onCopied} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy" }));
      await Promise.resolve();
    });

    expect(onCopied).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Copy" }).dataset["copied"]).toBeUndefined();
  });

  it("keeps the app's variant, size and classes", () => {
    const html = renderToStaticMarkup(<CopyButton value="x" variant="outline" size="sm" className="w-full" />);

    expect(html).toContain('data-variant="outline"');
    expect(html).toContain('data-size="sm"');
    expect(html).toContain("w-full");
  });
});
