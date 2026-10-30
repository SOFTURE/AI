// @vitest-environment happy-dom
// @vitest-environment-options {"settings":{"disableJavaScriptFileLoading":true,"disableCSSFileLoading":true,"handleDisabledFileLoadingAsSuccess":true}}
import { runInThisContext } from "node:vm";

import { buildLaunchProgressScript, launchProgress, resolveLaunchProgressConfig, type LaunchProgressConfig, type LaunchProgressPage } from "@softure-ai/pwa";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { FakeLaunchPage, LAUNCH_SCREEN_HTML, readLaunchScreen } from "./support/fake-launch-page.js";

const CONFIG: LaunchProgressConfig = { paintShare: 10, assetsShare: 60, timeShare: 29, timeConstantMs: 1_000, intervalMs: 100 };

beforeEach(() => {
  document.body.innerHTML = LAUNCH_SCREEN_HTML;
});

afterEach(() => {
  document.head.innerHTML = "";
  document.body.innerHTML = "";
});

describe("launchProgress", () => {
  it("starts at 0% before anything is painted or received", () => {
    const page = new FakeLaunchPage();

    launchProgress(page.asPage(), CONFIG);

    expect(readLaunchScreen()).toEqual({ valueNow: "0", valueText: null, transform: "translateX(-100%)", percent: "0%" });
  });

  it("adds the paint share, then the finished assets in proportion, on the bar, its indicator and the counter", () => {
    const page = new FakeLaunchPage();
    page.isPainted = true;
    launchProgress(page.asPage(), CONFIG);

    expect(readLaunchScreen()).toEqual({ valueNow: "10", valueText: "10%", transform: "translateX(-90%)", percent: "10%" });

    page.finish("/_next/static/css/app.css");
    page.fire();

    expect(readLaunchScreen().percent).toBe("40%");

    page.finish("/_next/static/chunks/main.js");
    page.fire();

    expect(readLaunchScreen()).toEqual({ valueNow: "70", valueText: "70%", transform: "translateX(-30%)", percent: "70%" });
  });

  it("counts the first timer tick as painted where the browser has no paint timing", () => {
    const page = new FakeLaunchPage();
    launchProgress(page.asPage(), CONFIG);

    page.fire();
    page.fire();

    expect(readLaunchScreen().percent).toBe("10%");
  });

  it("creeps with elapsed time and stops at 99%, where the timer ends", () => {
    const page = new FakeLaunchPage();
    page.isPainted = true;
    page.finish("/_next/static/css/app.css");
    page.finish("/_next/static/chunks/main.js");
    launchProgress(page.asPage(), CONFIG);

    page.now = 1_000;
    page.fire();
    // 10 + 60 + 29 × (1 − e⁻¹) = 88.33
    expect(readLaunchScreen().percent).toBe("88%");

    page.now = 60_000;
    page.fire();

    expect(readLaunchScreen().percent).toBe("99%");
    expect(page.intervals.size).toBe(0);
  });

  it("never falls back when a newly named asset is not received yet", () => {
    const page = new FakeLaunchPage();
    page.isPainted = true;
    page.finish("/_next/static/css/app.css");
    page.finish("/_next/static/chunks/main.js");
    launchProgress(page.asPage(), CONFIG);
    const script = document.createElement("script");
    script.src = "/_next/static/chunks/page.js";
    document.head.append(script);

    page.fire();

    expect(readLaunchScreen().percent).toBe("70%");
  });

  it("stops its timer once the page replaced the launch screen", () => {
    const page = new FakeLaunchPage();
    launchProgress(page.asPage(), CONFIG);
    expect(page.intervals.size).toBe(1);

    document.querySelector('[data-slot="launch-screen"]')?.remove();
    page.fire();

    expect(page.intervals.size).toBe(0);
  });

  it("does nothing outside a launch screen", () => {
    const page = new FakeLaunchPage();
    const loose = document.createElement("script");
    document.body.append(loose);

    launchProgress(page.asPage(loose), CONFIG);

    expect(page.intervals.size).toBe(0);
    expect(readLaunchScreen().percent).toBe("0%");
  });
});

describe("buildLaunchProgressScript", () => {
  it("runs as served: the function's text called with the page's globals and the JSON config", () => {
    const page = new FakeLaunchPage();
    page.isPainted = true;
    const fake = page.asPage();
    const source = buildLaunchProgressScript({ paintShare: 20, timeShare: 19 });

    // A fresh script from the text alone, with `document`, `performance` and `window` as the browser has them.
    const run = runInThisContext(`(function (document, performance, window) { ${source} })`) as (
      document: object,
      performance: LaunchProgressPage["performance"],
      window: LaunchProgressPage["timers"],
    ) => void;
    run({ currentScript: fake.script, querySelectorAll: document.querySelectorAll.bind(document), baseURI: document.baseURI }, fake.performance, fake.timers);

    expect(readLaunchScreen().percent).toBe("20%");
    expect(page.intervals.size).toBe(1);
  });

  it("never closes its own script element", () => {
    expect(buildLaunchProgressScript()).not.toContain("</");
  });
});

describe("resolveLaunchProgressConfig", () => {
  it("fills the defaults", () => {
    expect(resolveLaunchProgressConfig()).toEqual({ paintShare: 10, assetsShare: 60, timeShare: 29, timeConstantMs: 4_000, intervalMs: 100 });
  });

  it("takes the app's shares", () => {
    expect(resolveLaunchProgressConfig({ paintShare: 0, assetsShare: 80, timeShare: 20 })).toMatchObject({ paintShare: 0, assetsShare: 80, timeShare: 20 });
  });

  it.each([
    [{ paintShare: -1 }, "resolveLaunchProgressConfig: paintShare must be a number of 0 or more, got -1"],
    [{ assetsShare: Number.NaN }, "resolveLaunchProgressConfig: assetsShare must be a number of 0 or more, got NaN"],
    [{ timeShare: 40 }, "resolveLaunchProgressConfig: the shares add up to 110, more than 100"],
    [{ timeConstantMs: 0 }, "resolveLaunchProgressConfig: timeConstantMs must be a positive number, got 0"],
    [{ intervalMs: Number.POSITIVE_INFINITY }, "resolveLaunchProgressConfig: intervalMs must be a positive number, got Infinity"],
  ])("refuses %o", (options, message) => {
    expect(() => resolveLaunchProgressConfig(options)).toThrow(message);
  });
});
