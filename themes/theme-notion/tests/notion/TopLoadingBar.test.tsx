// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";

import { RouteLoading } from "../../src/notion/RouteLoading.js";
import { TopLoadingBar } from "../../src/notion/TopLoadingBar.js";

afterEach(cleanup);

describe("TopLoadingBar", () => {
  it("is a thin, square bar on a transparent track along the top edge that no pointer hits", () => {
    const { container } = render(<TopLoadingBar label="Loading" />);
    const root = container.querySelector('[data-slot="top-loading-bar"]');
    const bar = screen.getByRole("progressbar", { name: "Loading" });

    expect(root?.className.split(" ")).toEqual(["pointer-events-none", "fixed", "inset-x-0", "top-0", "z-50"]);
    expect(bar.className.split(" ")).toEqual(expect.arrayContaining(["h-0.5", "rounded-none", "bg-transparent"]));
    expect(bar.className.split(" ")).not.toContain("rounded-full");
    expect(container.querySelector("script")).toBeNull();
  });

  it("slides indeterminately without a value", () => {
    render(<TopLoadingBar label="Loading" />);
    const bar = screen.getByRole("progressbar", { name: "Loading" });

    expect(bar.getAttribute("data-state")).toBe("indeterminate");
    expect(bar.getAttribute("aria-valuenow")).toBeNull();
  });

  it("shows the app's value when it knows one", () => {
    render(<TopLoadingBar label="Loading" value={30} />);

    expect(screen.getByRole("progressbar", { name: "Loading" }).getAttribute("aria-valuenow")).toBe("30");
  });

  it("streams the counter script inside the bar, where rootSlot top-loading-bar finds it", () => {
    const html = renderToString(<TopLoadingBar label="Loading" script="window.__bar = 1;" />);
    const document = new DOMParser().parseFromString(html, "text/html");
    const script = document.querySelector("script");

    expect(script?.textContent).toBe("window.__bar = 1;");
    expect(script?.closest('[data-slot="top-loading-bar"]')?.querySelector('[data-slot="progress-indicator"]')).not.toBeNull();
  });
});

describe("RouteLoading", () => {
  it("streams both states, the launch screen for phones and installed apps, the bar for wide browser tabs", () => {
    const html = renderToString(<RouteLoading name="Fire" iconSrc="/icon.png" label="Loading" launchScript="window.__launch = 1;" barScript="window.__bar = 1;" />);
    const document = new DOMParser().parseFromString(html, "text/html");
    const launch = document.querySelector('[data-slot="launch-screen"]');
    const bar = document.querySelector('[data-slot="top-loading-bar"]');

    expect(launch?.className.split(" ")).toEqual(expect.arrayContaining(["flex", "md:[@media(display-mode:browser)]:hidden"]));
    expect(bar?.className.split(" ")).toEqual(expect.arrayContaining(["hidden", "md:[@media(display-mode:browser)]:block"]));
    expect(launch?.querySelector("script")?.textContent).toBe("window.__launch = 1;");
    expect(bar?.querySelector("script")?.textContent).toBe("window.__bar = 1;");
  });
});
