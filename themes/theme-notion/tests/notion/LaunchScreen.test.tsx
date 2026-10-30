// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";

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
