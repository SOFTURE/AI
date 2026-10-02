// @vitest-environment happy-dom
import { act, cleanup, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { announceToast, getAnnouncedToast, isAnnouncementNew, isToastVisible, ToastHost } from "../src/index.js";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("isToastVisible", () => {
  it("shows a fresh confirmation", () => {
    expect(isToastVisible("Saved", 1, null)).toBe(true);
  });

  it("hides the confirmation once its token has expired", () => {
    expect(isToastVisible("Saved", 1, 1)).toBe(false);
  });

  it("shows the same message again on the next save", () => {
    expect(isToastVisible("Saved", 2, 1)).toBe(true);
  });

  it("shows nothing without a message", () => {
    expect(isToastVisible(undefined, 1, null)).toBe(false);
    expect(isToastVisible("", 1, null)).toBe(false);
  });
});

describe("announceToast", () => {
  it("makes two identical announcements two different toasts", () => {
    announceToast("Saved");
    const first = getAnnouncedToast();
    announceToast("Saved");
    const second = getAnnouncedToast();
    expect(first?.message).toBe("Saved");
    expect(second?.token).toBe((first?.token ?? 0) + 1);
  });

  it("renders an empty live region on the server, even after an announcement", () => {
    announceToast("Saved");
    expect(renderToStaticMarkup(<ToastHost />)).toMatch(/^<div role="status" aria-live="polite" aria-atomic="true" class="[^"]*"><\/div>$/);
  });
});

describe("isAnnouncementNew", () => {
  it("shows an announcement newer than the host", () => {
    expect(isAnnouncementNew({ message: "x", token: 5 }, 4)).toBe(true);
  });

  it("does not replay an announcement made before the host mounted", () => {
    expect(isAnnouncementNew({ message: "x", token: 5 }, 5)).toBe(false);
  });

  it("has nothing to show without announcements", () => {
    expect(isAnnouncementNew(null, 0)).toBe(false);
  });
});

describe("ToastHost", () => {
  it("shows a new announcement in the live region and hides it after the duration", () => {
    vi.useFakeTimers();
    announceToast("Before mount");
    render(<ToastHost durationMs={1000} />);
    const region = screen.getByRole("status");
    expect(region.textContent).toBe("");
    act(() => announceToast("Saved"));
    expect(region.textContent).toBe("Saved");
    expect(region.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    act(() => {
      vi.advanceTimersByTime(999);
    });
    expect(region.textContent).toBe("Saved");
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(region.textContent).toBe("");
  });
});
