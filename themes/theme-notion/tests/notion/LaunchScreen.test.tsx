// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LaunchScreen } from "../../src/notion/LaunchScreen.js";

afterEach(cleanup);

const PROPS = { name: "Fire", iconSrc: "/pwa/icons/icon-192.png", label: "Loading" };

describe("LaunchScreen", () => {
  it("shows the app's icon, name, a named progress bar at 0 and the percentage", () => {
    const { container } = render(<LaunchScreen {...PROPS} />);
    const bar = screen.getByRole("progressbar", { name: "Loading" });

    expect(container.querySelector('[data-slot="launch-screen-icon"]')?.getAttribute("src")).toBe("/pwa/icons/icon-192.png");
    expect(container.querySelector('[data-slot="launch-screen-icon"]')?.getAttribute("alt")).toBe("");
    expect(screen.getByText("Fire").getAttribute("data-slot")).toBe("launch-screen-name");
    expect(bar.getAttribute("aria-valuenow")).toBe("0");
    expect(container.querySelector('[data-slot="launch-screen-percent"]')?.textContent).toBe("0%");
    expect(container.querySelector('[data-slot="launch-screen-percent"]')?.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelector("script")).toBeNull();
  });

  it("fills the screen on the theme's background and foreground", () => {
    const { container } = render(<LaunchScreen {...PROPS} />);
    const root = container.querySelector('[data-slot="launch-screen"]');

    expect(root?.className.split(" ")).toEqual(expect.arrayContaining(["fixed", "inset-0", "bg-background", "text-foreground"]));
  });

  it("streams the counter script inside the screen, where it finds the slots it moves", () => {
    const html = renderToString(<LaunchScreen {...PROPS} script="window.__launch = 1;" />);
    const document = new DOMParser().parseFromString(html, "text/html");
    const script = document.querySelector("script");
    const root = script?.closest('[data-slot="launch-screen"]');

    expect(script?.textContent).toBe("window.__launch = 1;");
    expect(root?.querySelector('[data-slot="progress"]')).not.toBeNull();
    expect(root?.querySelector('[data-slot="progress-indicator"]')).not.toBeNull();
    expect(root?.querySelector('[data-slot="launch-screen-percent"]')).not.toBeNull();
  });
});

describe("LaunchScreen's counter script outside the server's HTML", () => {
  it("draws no script, and no warning, when a client-side navigation renders it", () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { container } = render(<LaunchScreen {...PROPS} script="window.__launch = 1;" />);

    expect(container.querySelector("script")).toBeNull();
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });

  it("keeps the streamed script through hydration without a warning", () => {
    const container = document.createElement("div");
    container.innerHTML = renderToString(<LaunchScreen {...PROPS} script="window.__launch = 1;" />);
    document.body.append(container);
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);

    let root: ReturnType<typeof hydrateRoot> | null = null;
    act(() => {
      root = hydrateRoot(container, <LaunchScreen {...PROPS} script="window.__launch = 1;" />);
    });

    expect(errors).not.toHaveBeenCalled();
    act(() => root?.unmount());
    container.remove();
    errors.mockRestore();
  });
});
