import {
  type AppPromptSlot as UiAppPromptSlot,
  type ClassNames,
  InstallBar,
  type InstallBarSlot as UiInstallBarSlot,
  LaunchScreen,
  type LaunchScreenSlot as UiLaunchScreenSlot,
  MiniProgress,
  type MiniProgressSlot as UiMiniProgressSlot,
  RouteLoading,
  UpdatePrompt,
} from "@softure-ai/ui";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  type AppPromptSlot,
  INSTALL_BAR_LOOK,
  type InstallBarSlot,
  LAUNCH_SCREEN_LOOK,
  type LaunchScreenSlot,
  MINI_PROGRESS_LOOK,
  type MiniProgressSlot,
  ROUTE_LOADING_LOOK,
  UPDATE_PROMPT_LOOK,
} from "../src/index.js";

// The theme names ui's slots without a runtime import of ui; each pair must stay the same set.
type IsSameSet<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const SLOT_SETS_MATCH: [
  IsSameSet<AppPromptSlot, UiAppPromptSlot>,
  IsSameSet<InstallBarSlot, UiInstallBarSlot>,
  IsSameSet<LaunchScreenSlot, UiLaunchScreenSlot>,
  IsSameSet<MiniProgressSlot, UiMiniProgressSlot>,
] = [true, true, true, true];

function getClasses(markup: string, dataSlot: string): string[] {
  const match = new RegExp(`data-slot="${dataSlot}"[^>]*class="([^"]*)"`).exec(markup);
  return (match?.[1] ?? "").split(" ");
}

const INSTALL_COPY = { title: "Install", description: "From the home screen", install: "Install", shareStep: "Share", addStep: "Add", close: "Close" };

describe("app component look maps", () => {
  it("name exactly ui's slots", () => {
    expect(SLOT_SETS_MATCH).toEqual([true, true, true, true]);
    const prompt: ClassNames<UiAppPromptSlot> = UPDATE_PROMPT_LOOK;
    const launch: ClassNames<UiLaunchScreenSlot> = LAUNCH_SCREEN_LOOK;
    expect([prompt, launch]).toEqual([UPDATE_PROMPT_LOOK, LAUNCH_SCREEN_LOOK]);
  });

  it("draws the prompts flat, rising in, with the title on the subsection step and an accent icon", () => {
    const markup = renderToStaticMarkup(<UpdatePrompt open title="Update" description="Reload" reload="Reload" onReload={() => undefined} classNames={UPDATE_PROMPT_LOOK} />);
    expect(getClasses(markup, "update-prompt-panel")).toEqual(expect.arrayContaining(["shadow-none", "prompt-enter", "sft:bg-surface-raised", "sft:border-border"]));
    expect(markup).toContain("text-subsection font-bold");
    expect(markup).toContain("text-accent");
    expect(markup).toMatch(/<button[^>]*data-variant="primary"[^>]*class="[^"]*sft:min-h-11 sft:md:min-h-0 border-0"/);
  });

  it("gives the install bar the prompt's look and the close button's focus ring at its edge", () => {
    const markup = renderToStaticMarkup(<InstallBar offer="ios_steps" onInstall={() => undefined} onClose={() => undefined} classNames={INSTALL_BAR_LOOK} {...INSTALL_COPY} />);
    expect(getClasses(markup, "install-bar-panel")).toContain("prompt-enter");
    expect(getClasses(markup, "install-bar-steps")).toContain("text-body-sm");
    expect(markup).toMatch(/aria-label="Close"[^>]*class="[^"]*focus-visible:outline-offset-0"/);
  });

  it("keeps lime off the thin bars: the launch screen's indicator stays ui's accent", () => {
    const markup = renderToStaticMarkup(<RouteLoading name="Workspace" iconSrc="/i.png" label="Loading" classNames={ROUTE_LOADING_LOOK} />);
    expect(getClasses(markup, "launch-screen-name")).toEqual(expect.arrayContaining(["text-band", "font-bold"]));
    expect(getClasses(markup, "launch-screen-percent")).toEqual(expect.arrayContaining(["num", "text-muted"]));
    const indicators = [...markup.matchAll(/data-slot="progress-indicator"[^>]*class="([^"]*)"/g)].map((match) => match[1] ?? "");
    expect(indicators).toHaveLength(2);
    for (const classes of indicators) {
      expect(classes.split(" ")).toContain("sft:bg-accent");
      expect(classes).not.toMatch(/accent-fill|lime/);
    }
    expect(renderToStaticMarkup(<LaunchScreen name="W" iconSrc="/i.png" label="L" classNames={LAUNCH_SCREEN_LOOK} />)).toContain("bg-border");
  });

  it("puts the mini progress on the flag radius with its figure as a caption num", () => {
    const markup = renderToStaticMarkup(<MiniProgress value={40} classNames={MINI_PROGRESS_LOOK} />);
    expect(getClasses(markup, "mini-progress")).toEqual(expect.arrayContaining(["rounded-flag", "bg-foreground/[0.08]"]));
    expect(markup.match(/num text-caption/g)).toHaveLength(2);
  });
});
