// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getBubbleStyle, Hint, resolveBubblePlacement } from "../src/index.js";

afterEach(cleanup);

const VIEWPORT = { width: 1000, height: 800 };

describe("Hint markup", () => {
  it("renders the explanation as a tooltip element, not a title attribute", () => {
    const html = renderToStaticMarkup(
      <Hint label="About: Rate" id="h">
        Yearly rate
      </Hint>,
    );
    expect(html).not.toContain("title=");
    expect(html).toMatch(/<span id="h" role="tooltip" hidden="" class="[^"]*">Yearly rate<\/span>/);
  });

  it("puts the explanation behind a named, focusable button tied to the bubble", () => {
    const html = renderToStaticMarkup(<Hint label="About: Rate" id="h">x</Hint>);
    expect(html).toMatch(/<button type="button" aria-label="About: Rate" aria-describedby="h" class="[^"]*">\?<\/button>/);
    expect(html).not.toContain("aria-expanded");
  });

  it("generates the bubble id when none is given", () => {
    const html = renderToStaticMarkup(<Hint label="x">y</Hint>);
    const describedBy = html.match(/aria-describedby="([^"]+)"/)?.[1];
    expect(describedBy).toBeDefined();
    expect(html).toContain(`id="${describedBy ?? ""}" role="tooltip"`);
  });

  it("anchors the bubble on the requested side and has a fixed width when wide", () => {
    expect(renderToStaticMarkup(<Hint label="x" anchorLeft>y</Hint>)).toContain("sft:left-0");
    expect(renderToStaticMarkup(<Hint label="x">y</Hint>)).toContain("sft:right-0");
    expect(renderToStaticMarkup(<Hint label="x" isWide>y</Hint>)).toContain("sft:w-88");
  });

  it("enlarges the hit area beyond the 16 px circle", () => {
    expect(renderToStaticMarkup(<Hint label="x">y</Hint>)).toContain("sft:before:-inset-1.5");
  });
});

describe("Hint behaviour", () => {
  function renderHint() {
    render(
      <div>
        <Hint label="About: Rate" id="h">
          Yearly rate
        </Hint>
        <button type="button">elsewhere</button>
      </div>,
    );
    return { trigger: screen.getByRole("button", { name: "About: Rate" }), bubble: screen.getByRole("tooltip", { hidden: true }) };
  }

  it("opens on focus and closes on blur", () => {
    const { trigger, bubble } = renderHint();
    expect(bubble.hidden).toBe(true);
    fireEvent.focus(trigger);
    expect(bubble.hidden).toBe(false);
    fireEvent.blur(trigger);
    expect(bubble.hidden).toBe(true);
  });

  it("opens on hover", () => {
    const { trigger, bubble } = renderHint();
    fireEvent.mouseEnter(trigger.parentElement ?? trigger);
    expect(bubble.hidden).toBe(false);
  });

  it("closes a bubble opened by hover on Escape, without letting the Escape through", () => {
    const { trigger, bubble } = renderHint();
    fireEvent.mouseEnter(trigger.parentElement ?? trigger);
    const outer = vi.fn((event: KeyboardEvent) => event.defaultPrevented);
    document.addEventListener("keydown", outer);
    act(() => {
      fireEvent.keyDown(document, { key: "Escape" });
    });
    document.removeEventListener("keydown", outer);
    expect(bubble.hidden).toBe(true);
    expect(outer).toHaveReturnedWith(true);
  });

  it("stays open after a click until Escape", () => {
    const { trigger, bubble } = renderHint();
    fireEvent.click(trigger);
    fireEvent.mouseLeave(trigger.parentElement ?? trigger);
    expect(bubble.hidden).toBe(false);
    act(() => {
      fireEvent.keyDown(document, { key: "Escape" });
    });
    expect(bubble.hidden).toBe(true);
  });

  it("unpins when focus moves to another element", () => {
    const { trigger, bubble } = renderHint();
    fireEvent.click(trigger);
    fireEvent.blur(trigger, { relatedTarget: screen.getByRole("button", { name: "elsewhere" }) });
    expect(bubble.hidden).toBe(true);
  });

  it("unpins on a pointer press outside", () => {
    const { trigger, bubble } = renderHint();
    fireEvent.click(trigger);
    act(() => {
      fireEvent.pointerDown(screen.getByRole("button", { name: "elsewhere" }));
    });
    expect(bubble.hidden).toBe(true);
  });

  it("a second click on the trigger closes a pinned bubble", () => {
    const { trigger, bubble } = renderHint();
    fireEvent.click(trigger);
    fireEvent.click(trigger);
    expect(bubble.hidden).toBe(true);
  });
});

describe("resolveBubblePlacement", () => {
  const trigger = { left: 400, right: 416, top: 300, bottom: 316 };

  it("keeps a bubble that fits where it stands, above the trigger", () => {
    expect(resolveBubblePlacement({ trigger, bubble: { width: 200, height: 50 }, viewport: VIEWPORT, isAnchoredLeft: true })).toEqual({
      isAnchoredLeft: true,
      left: 400,
      top: 244,
      opensAbove: true,
    });
    expect(
      resolveBubblePlacement({ trigger, bubble: { width: 200, height: 50 }, viewport: VIEWPORT, isAnchoredLeft: false }).left,
    ).toBe(216);
  });

  it("flips the anchor when only the other side fits", () => {
    const nearRight = { left: 900, right: 916, top: 300, bottom: 316 };
    expect(
      resolveBubblePlacement({ trigger: nearRight, bubble: { width: 200, height: 50 }, viewport: VIEWPORT, isAnchoredLeft: true }),
    ).toMatchObject({ isAnchoredLeft: false, left: 716 });
  });

  it("clamps a bubble that fits on neither side inside the viewport margin", () => {
    const placement = resolveBubblePlacement({
      trigger: { left: 100, right: 116, top: 300, bottom: 316 },
      bubble: { width: 300, height: 50 },
      viewport: { width: 320, height: 800 },
      isAnchoredLeft: true,
    });
    expect(placement.left).toBe(12);
  });

  it("keeps the start of a bubble wider than the viewport", () => {
    const placement = resolveBubblePlacement({
      trigger,
      bubble: { width: 2000, height: 50 },
      viewport: VIEWPORT,
      isAnchoredLeft: true,
    });
    expect(placement.left).toBe(8);
  });

  it("opens below when there is no room above", () => {
    const placement = resolveBubblePlacement({
      trigger: { left: 400, right: 416, top: 20, bottom: 36 },
      bubble: { width: 200, height: 80 },
      viewport: VIEWPORT,
      isAnchoredLeft: true,
    });
    expect(placement).toMatchObject({ opensAbove: false, top: 42 });
  });

  it("styles a placed bubble as fixed, resetting both opposite edges", () => {
    expect(getBubbleStyle({ isAnchoredLeft: true, left: 10, top: 20, opensAbove: true })).toEqual({
      position: "fixed",
      left: "10px",
      top: "20px",
      right: "auto",
      bottom: "auto",
    });
  });
});
