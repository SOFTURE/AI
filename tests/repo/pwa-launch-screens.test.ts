// @vitest-environment happy-dom
// The contract between `@softure-ai/pwa`'s launch counter and the loading screens of `@softure-ai/ui`: the counter
// finds its root and parts by `data-slot`, so a slot renamed on either side fails here, not in an app.
import { launchProgress, type LaunchProgressConfig, type LaunchProgressPage } from "@softure-ai/pwa";
import { LaunchScreen, TopLoadingBar } from "@softure-ai/ui";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";

const CONFIG: LaunchProgressConfig = { paintShare: 10, assetsShare: 60, timeShare: 29, timeConstantMs: 1_000, intervalMs: 100 };

afterEach(() => {
  document.body.innerHTML = "";
});

// A painted page with no assets and a stopped clock: the counter's first value is the paint share.
function getPaintedPage(): LaunchProgressPage {
  return {
    script: document.querySelector("script"),
    document,
    performance: {
      now: () => 0,
      getEntriesByType: (type: string) => (type === "paint" ? [{ name: "first-paint" } as PerformanceEntry] : []),
      getEntriesByName: () => [],
    },
    timers: { setInterval: () => 1, clearInterval: () => undefined },
  };
}

function readBar(): { valueNow: string | null; state: string | null; transform: string } {
  const bar = document.querySelector('[data-slot="progress"]');
  return {
    valueNow: bar?.getAttribute("aria-valuenow") ?? null,
    state: bar?.getAttribute("data-state") ?? null,
    transform: document.querySelector<HTMLElement>('[data-slot="progress-indicator"]')?.style.transform ?? "",
  };
}

describe("pwa launch counter on @softure-ai/ui's loading screens", () => {
  it("moves the launch screen's bar, indicator and percentage", () => {
    document.body.innerHTML = renderToStaticMarkup(createElement(LaunchScreen, { name: "Workspace", iconSrc: "/i.png", label: "Loading", script: "" }));

    launchProgress(getPaintedPage(), CONFIG);

    expect(readBar()).toEqual({ valueNow: "10", state: "loading", transform: "translateX(-90%)" });
    expect(document.querySelector('[data-slot="launch-screen-percent"]')?.textContent).toBe("10%");
  });

  it("makes the indeterminate top bar determinate with its first value", () => {
    document.body.innerHTML = renderToStaticMarkup(createElement(TopLoadingBar, { label: "Loading", script: "" }));
    expect(readBar()).toEqual({ valueNow: null, state: "indeterminate", transform: "" });

    launchProgress(getPaintedPage(), { ...CONFIG, rootSlot: "top-loading-bar" });

    expect(readBar()).toEqual({ valueNow: "10", state: "loading", transform: "translateX(-90%)" });
    expect(document.querySelector('[data-slot="progress-indicator"]')?.getAttribute("data-state")).toBe("loading");
  });
});
