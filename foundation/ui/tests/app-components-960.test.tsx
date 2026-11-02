// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  InstallBar,
  type InstallBarProps,
  LaunchScreen,
  MiniProgress,
  ProgressBar,
  RouteLoading,
  TopLoadingBar,
  UpdatePrompt,
  clampProgressValue,
} from "../src/index.js";

afterEach(cleanup);

const INSTALL_COPY = {
  title: "Install the app",
  description: "Open it from your home screen.",
  install: "Install",
  shareStep: "Tap Share",
  addStep: "Tap Add to Home Screen",
  close: "Close",
} as const;

function renderInstallBar(props: Partial<InstallBarProps> = {}) {
  const onInstall = vi.fn();
  const onClose = vi.fn();
  render(<InstallBar offer="browser_prompt" onInstall={onInstall} onClose={onClose} {...INSTALL_COPY} {...props} />);
  return { onInstall, onClose };
}

describe("ProgressBar", () => {
  it("reports a clamped value on 0–100 and moves the full-width indicator by translateX", () => {
    render(<ProgressBar value={140} label="Loading" />);
    const bar = screen.getByRole("progressbar", { name: "Loading" });
    expect([bar.getAttribute("aria-valuenow"), bar.getAttribute("aria-valuemin"), bar.getAttribute("aria-valuemax")]).toEqual(["100", "0", "100"]);
    expect(bar.getAttribute("data-state")).toBe("complete");
    const indicator = bar.querySelector<HTMLElement>('[data-slot="progress-indicator"]');
    expect(indicator?.style.transform).toBe("translateX(-0%)");
  });

  it("is indeterminate without a value: no aria-valuenow, no transform, the sliding classes on the indicator", () => {
    render(<ProgressBar label="Loading" />);
    const bar = screen.getByRole("progressbar");
    expect(bar.hasAttribute("aria-valuenow")).toBe(false);
    expect(bar.getAttribute("data-state")).toBe("indeterminate");
    const indicator = bar.querySelector<HTMLElement>('[data-slot="progress-indicator"]');
    expect(indicator?.getAttribute("style")).toBeNull();
    expect(indicator?.className.split(" ")).toEqual(
      expect.arrayContaining(["sft:data-[state=indeterminate]:animate-indeterminate", "sft:motion-reduce:data-[state=indeterminate]:animate-none"]),
    );
  });

  it("draws a hairline without a track, and only the app's classes when unstyled", () => {
    const hairline = renderToStaticMarkup(<ProgressBar value={10} label="Loading" size="hairline" />);
    expect(hairline).toContain("sft:h-0.5 sft:rounded-none sft:bg-transparent");
    const bare = renderToStaticMarkup(<ProgressBar value={10} label="Loading" unstyled classNames={{ root: "app-bar" }} />);
    expect(bare).toContain('class="app-bar"');
    expect(bare).not.toContain("sft:");
  });

  it("reads a non-finite value as 0", () => {
    expect([clampProgressValue(Number.NaN), clampProgressValue(-5), clampProgressValue(42.5)]).toEqual([0, 0, 42.5]);
  });
});

describe("MiniProgress", () => {
  it("reports the share and the rounded percent as its value text, the label drawn twice and hidden", () => {
    render(<MiniProgress value={37.6} aria-label="Saved" />);
    const bar = screen.getByRole("progressbar", { name: "Saved" });
    expect([bar.getAttribute("aria-valuenow"), bar.getAttribute("aria-valuetext")]).toEqual(["37.6", "38%"]);
    const labels = bar.querySelectorAll('[data-slot="mini-progress-label"]');
    expect([...labels].map((label) => [label.getAttribute("aria-hidden"), label.textContent])).toEqual([
      ["true", "38%"],
      ["true", "38%"],
    ]);
    expect((labels[1] as HTMLElement).style.clipPath).toBe("inset(0 62.4% 0 0)");
    expect(bar.querySelector<HTMLElement>('[data-slot="mini-progress-indicator"]')?.style.width).toBe("37.6%");
  });

  it("paints the fill by tone, with the label on the fill in the matching text colour", () => {
    const accent = renderToStaticMarkup(<MiniProgress value={50} />);
    expect(accent).toContain("sft:bg-accent-fill");
    expect(accent).toContain("sft:text-on-accent");
    const danger = renderToStaticMarkup(<MiniProgress value={50} tone="danger" label="12,000" />);
    expect(danger).toContain('data-tone="danger"');
    expect(danger).toContain("sft:bg-danger");
    expect(danger).toContain("sft:text-background");
    expect(danger).toContain('aria-valuetext="12,000"');
  });

  it("leaves the value text to the bar when the label is not a string", () => {
    render(<MiniProgress value={20} label={<strong>20 of 100</strong>} />);
    expect(screen.getByRole("progressbar").hasAttribute("aria-valuetext")).toBe(false);
  });
});

describe("LaunchScreen and TopLoadingBar", () => {
  it("renders the launch screen with the slots the pwa counter drives, at 0%", () => {
    render(<LaunchScreen name="Workspace" iconSrc="/icons/icon-192.png" label="Loading Workspace" script="window.counted = true;" />);
    const root = document.querySelector('[data-slot="launch-screen"]');
    expect(root?.querySelector('[data-slot="launch-screen-icon"]')?.getAttribute("alt")).toBe("");
    expect(root?.querySelector('[data-slot="launch-screen-name"]')?.textContent).toBe("Workspace");
    expect(screen.getByRole("progressbar", { name: "Loading Workspace" }).getAttribute("aria-valuenow")).toBe("0");
    const percent = root?.querySelector('[data-slot="launch-screen-percent"]');
    expect([percent?.textContent, percent?.getAttribute("aria-hidden")]).toEqual(["0%", "true"]);
    expect(root?.querySelector("script")?.textContent).toBe("window.counted = true;");
  });

  it("adds the app's class to a slot, and draws the top bar as a hairline that never takes the pointer", () => {
    const launch = renderToStaticMarkup(<LaunchScreen name="Workspace" iconSrc="/i.png" label="Loading" classNames={{ bar: "app-bar", name: "app-name" }} />);
    expect(launch).toContain("sft:w-48 app-bar");
    expect(launch).toContain("sft:text-lg sft:font-semibold app-name");
    const top = renderToStaticMarkup(<TopLoadingBar label="Loading" />);
    expect(top).toMatch(/data-slot="top-loading-bar" class="[^"]*sft:pointer-events-none[^"]*sft:fixed/);
    expect(top).toContain('data-size="hairline"');
    expect(top).toContain('data-state="indeterminate"');
  });
});

describe("RouteLoading", () => {
  it("streams both screens and lets CSS pick one, also when unstyled", () => {
    for (const unstyled of [false, true]) {
      const html = renderToStaticMarkup(
        <RouteLoading name="Workspace" iconSrc="/i.png" label="Loading" launchScript="a()" barScript="b()" unstyled={unstyled} />,
      );
      expect(html).toMatch(/data-slot="launch-screen" class="[^"]*sft:md:\[@media\(display-mode:browser\)\]:hidden/);
      expect(html).toMatch(/data-slot="top-loading-bar" class="[^"]*sft:hidden sft:md:\[@media\(display-mode:browser\)\]:block/);
      expect(html).toContain("<script>a()</script>");
      expect(html).toContain("<script>b()</script>");
    }
  });

  it("passes each screen its own slot classes", () => {
    const html = renderToStaticMarkup(
      <RouteLoading name="W" iconSrc="/i.png" label="Loading" classNames={{ launchScreen: { percent: "app-percent" }, topLoadingBar: { indicator: "app-line" } }} />,
    );
    expect(html).toContain("app-percent");
    expect(html).toMatch(/data-slot="progress-indicator"[^>]*class="[^"]*app-line/);
  });
});

describe("UpdatePrompt", () => {
  it("renders nothing while closed", () => {
    expect(renderToStaticMarkup(<UpdatePrompt open={false} title="t" description="d" reload="r" onReload={() => undefined} />)).toBe("");
  });

  it("is a polite status with the reload action at the touch height on a phone", () => {
    const onReload = vi.fn();
    render(<UpdatePrompt open title="A new version is ready" description="Reload to use it." reload="Reload" onReload={onReload} />);
    const status = screen.getByRole("status");
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(status.textContent).toContain("A new version is ready");
    const button = screen.getByRole("button", { name: "Reload" });
    expect(button.className.split(" ")).toEqual(expect.arrayContaining(["sft:min-h-11", "sft:md:min-h-0"]));
    fireEvent.click(button);
    expect(onReload).toHaveBeenCalledTimes(1);
  });

  it("stays inside the safe-area insets", () => {
    const html = renderToStaticMarkup(<UpdatePrompt open title="t" description="d" reload="r" onReload={() => undefined} />);
    for (const side of ["right", "bottom", "left"]) expect(html).toContain(`env(safe-area-inset-${side})`);
  });
});

describe("InstallBar", () => {
  it("renders nothing for the offer none", () => {
    expect(renderToStaticMarkup(<InstallBar offer="none" onInstall={() => undefined} onClose={() => undefined} {...INSTALL_COPY} />)).toBe("");
  });

  it("offers the browser's prompt and a 44 px close button, each calling its action", () => {
    const { onInstall, onClose } = renderInstallBar();
    expect(screen.getByRole("status").textContent).toContain("Install the app");
    fireEvent.click(screen.getByRole("button", { name: "Install" }));
    const close = screen.getByRole("button", { name: "Close" });
    expect(close.getAttribute("data-size")).toBe("lg");
    fireEvent.click(close);
    expect([onInstall.mock.calls.length, onClose.mock.calls.length]).toEqual([1, 1]);
  });

  it("shows the two iOS steps instead of a button, with decorative icons", () => {
    renderInstallBar({ offer: "ios_steps" });
    expect(screen.queryByRole("button", { name: "Install" })).toBeNull();
    const steps = [...document.querySelectorAll('[data-slot="install-bar-steps"] li')];
    expect(steps.map((step) => step.textContent)).toEqual(["Tap Share", "Tap Add to Home Screen"]);
    expect(steps.every((step) => step.querySelector("svg")?.getAttribute("aria-hidden") === "true")).toBe(true);
    expect(document.querySelector('[data-slot="install-bar"]')?.getAttribute("data-offer")).toBe("ios_steps");
  });

  it("takes the app's classes per slot and keeps only them when unstyled", () => {
    renderInstallBar({ unstyled: true, classNames: { panel: "app-panel", close: "app-close", action: "app-action" } });
    expect(screen.getByRole("status").className).toBe("app-panel");
    expect(screen.getByRole("button", { name: "Close" }).className).toBe("app-close");
    expect(screen.getByRole("button", { name: "Install" }).className).toBe("app-action");
  });
});
