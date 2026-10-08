// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type HintAppearance, Switch } from "../src/index.js";

afterEach(cleanup);

const APPEARANCE: HintAppearance = {
  classNames: { trigger: "app-trigger", bubble: "app-bubble" },
  triggerGap: 8,
};

function rect(r: { left: number; top: number; width: number; height: number }): DOMRect {
  return { ...r, right: r.left + r.width, bottom: r.top + r.height, x: r.left, y: r.top, toJSON: () => r };
}

/** Opens the hint named `name` with fixed rects and returns the bubble's top in px. */
function getOpenBubbleTop(name: string): string {
  const spy = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    return this.getAttribute("role") === "tooltip"
      ? rect({ left: 0, top: 0, width: 200, height: 50 })
      : rect({ left: 400, top: 300, width: 16, height: 16 });
  });
  const root = document.documentElement;
  Object.defineProperty(root, "clientWidth", { configurable: true, value: 1000 });
  Object.defineProperty(root, "clientHeight", { configurable: true, value: 800 });
  try {
    fireEvent.focus(screen.getByRole("button", { name }));
    return screen.getByRole("tooltip").style.top;
  } finally {
    spy.mockRestore();
  }
}

function getClassOf(html: string, text: string): string {
  return html.match(new RegExp(`class="([^"]*)">${text}<`))?.[1] ?? "";
}

describe("Switch hintProps (#281)", () => {
  it("gives the hint the app's trigger and bubble classes", () => {
    const html = renderToStaticMarkup(<Switch id="s" name="n" label="Notify" hint="One mail" hintProps={APPEARANCE} />);
    expect(html).toMatch(/<button [^>]*class="[^"]*app-trigger"/);
    expect(html).toMatch(/role="tooltip"[^>]*class="[^"]*app-bubble/);
  });

  it("keeps the switch's own hint id and name when hintProps are given", () => {
    const html = renderToStaticMarkup(<Switch id="s" name="n" label="Notify" hint="One mail" hintProps={APPEARANCE} hintLabel="About: Notify" />);
    expect(html).toContain('id="s-hint"');
    expect(html).toContain('aria-label="About: Notify"');
  });

  it("opens the bubble at the app's trigger gap", () => {
    render(<Switch name="n" label="Notify" hint="One mail" hintLabel="About: Notify" hintProps={APPEARANCE} />);
    expect(getOpenBubbleTop("About: Notify")).toBe(`${300 - 8 - 50}px`);
  });
});

describe("Switch state lines (#281)", () => {
  it("takes stateOn and stateOff slot classes", () => {
    const html = renderToStaticMarkup(
      <Switch name="n" label="L" stateText={{ on: "On", off: "Off" }} classNames={{ stateOn: "app-on", stateOff: "app-off" }} />,
    );
    expect(getClassOf(html, "On")).toContain("app-on");
    expect(getClassOf(html, "Off")).toContain("app-off");
    expect(getClassOf(html, "On")).not.toContain("app-off");
  });

  it("keeps one visible line per state when unstyled", () => {
    const html = renderToStaticMarkup(
      <Switch name="n" label="L" unstyled stateText={{ on: "On", off: "Off" }} classNames={{ root: "app-root", stateOn: "app-on" }} />,
    );
    expect(html).toMatch(/^<div class="sft:group\/switch app-root">/);
    expect(getClassOf(html, "On")).toBe(
      "app-on sft:invisible sft:col-start-1 sft:row-start-1 sft:group-has-checked/switch:visible",
    );
    expect(getClassOf(html, "Off")).toBe("sft:visible sft:col-start-1 sft:row-start-1 sft:group-has-checked/switch:invisible");
    expect(html).toMatch(/<span class="sft:grid"><span class="app-on/);
  });

  it("carries the group marker once on a styled root", () => {
    const html = renderToStaticMarkup(<Switch name="n" label="L" />);
    const rootClass = html.match(/^<div class="([^"]*)"/)?.[1] ?? "";
    expect(rootClass.split(" ").filter((part) => part === "sft:group/switch")).toHaveLength(1);
  });
});

describe("Switch label row (#281)", () => {
  it("lays the hint inline after the label, with room reserved at the label's end", () => {
    const html = renderToStaticMarkup(<Switch id="s" name="n" label="Notify" hint="One mail" />);
    const row = html.match(/<span class="([^"]*)"><label for="s" class="([^"]*)">Notify<\/label><span class="([^"]*)">/);
    expect(row?.[1]).toBe("sft:block sft:text-sm sft:leading-normal");
    expect(row?.[2]?.split(" ")).toContain("sft:pr-5");
    expect(row?.[3]).toBe("sft:-ml-5 sft:inline-flex sft:w-5 sft:justify-end");
  });

  it("reserves no room and renders no wrapper without a hint", () => {
    const html = renderToStaticMarkup(<Switch id="s" name="n" label="Notify" />);
    expect(html).not.toContain("sft:pr-5");
    expect(html).toMatch(/<label for="s" class="[^"]*">Notify<\/label><\/span>/);
  });

  it("takes a hint slot class on the wrapper of the \"?\"", () => {
    const html = renderToStaticMarkup(<Switch id="s" name="n" label="Notify" hint="One mail" unstyled classNames={{ hint: "app-hint" }} />);
    expect(html).toMatch(/<\/label><span class="app-hint"><span class="sft:group\/hint/);
  });
});

describe("Switch ids (#281)", () => {
  it("derives the description and hint ids from the switch id", () => {
    const html = renderToStaticMarkup(<Switch id="notify" name="n" label="L" hint="H" description="D" />);
    expect(html).toContain('id="notify-description"');
    expect(html).toContain('aria-describedby="notify-description"');
    expect(html).toContain('id="notify-hint"');
  });
});
