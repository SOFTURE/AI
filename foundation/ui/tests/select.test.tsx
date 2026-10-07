// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveListPlacement, Select } from "../src/index.js";

afterEach(cleanup);

const OPTIONS = [
  { value: "a", label: "Alpha" },
  { value: "b", label: "Beta" },
  { value: "c", label: "Gamma" },
];

describe("Select markup (closed)", () => {
  it("renders a combobox button with the selected label, not a native select", () => {
    const html = renderToStaticMarkup(<Select id="s" name="field" defaultValue="b" options={OPTIONS} />);
    expect(html).not.toMatch(/<select|<option/);
    expect(html).toMatch(/<button type="button" id="s" role="combobox" aria-haspopup="listbox" aria-expanded="false"/);
    expect(html).toMatch(/<span class="sft:truncate">Beta<\/span><\/button>/);
    expect(html).toMatch(/<ul [^>]*role="listbox"[^>]*hidden=""/);
    expect(html).toMatch(/role="option" aria-selected="true" data-value="b"/);
    expect(html).toMatch(/role="option" aria-selected="false" data-value="a"/);
  });

  it("sends the selected value through a hidden input under its name", () => {
    expect(renderToStaticMarkup(<Select name="currency" defaultValue="c" options={OPTIONS} />)).toContain(
      '<input type="hidden" name="currency" value="c"/>',
    );
  });

  it("selects the first option without a starting value, like a native select", () => {
    expect(renderToStaticMarkup(<Select name="x" options={OPTIONS} />)).toContain('value="a"');
  });

  it("shows and sends the first option for a value outside the options", () => {
    const html = renderToStaticMarkup(<Select name="x" defaultValue="zzz" options={OPTIONS} />);
    expect(html).toContain('name="x" value="a"');
    expect(html).toContain(">Alpha</span></button>");
  });

  it("sends nothing without a name or when disabled", () => {
    expect(renderToStaticMarkup(<Select options={OPTIONS} />)).not.toContain('type="hidden"');
    expect(renderToStaticMarkup(<Select name="x" disabled options={OPTIONS} />)).not.toContain('type="hidden"');
  });

  it("is named by the caller's aria-label", () => {
    expect(renderToStaticMarkup(<Select aria-label="Currency" options={OPTIONS} />)).toMatch(/role="combobox"[^>]*aria-label="Currency"/);
  });

  it("hides the check of unselected options and keeps the chevron decorative", () => {
    const html = renderToStaticMarkup(<Select options={OPTIONS} />);
    expect(html.match(/sft:invisible/g)).toHaveLength(2);
    expect(html).toMatch(/<\/button><svg [^>]*aria-hidden="true"/);
  });

  it("supports slots and unstyled", () => {
    const html = renderToStaticMarkup(<Select options={OPTIONS} unstyled classNames={{ trigger: "app-trigger" }} />);
    expect(html).not.toContain("sft:");
    expect(html).toContain('class="app-trigger"');
  });
});

describe("Select behaviour", () => {
  function renderSelect(onValueChange = vi.fn()) {
    render(
      <div>
        <label htmlFor="pick">Letter</label>
        <Select id="pick" name="letter" options={OPTIONS} defaultValue="a" onValueChange={onValueChange} />
        <button type="button">outside</button>
      </div>,
    );
    const trigger = screen.getByRole("combobox");
    return { trigger, list: screen.getByRole("listbox", { hidden: true }), onValueChange };
  }

  it("opens on ArrowDown, moves with arrows and commits with Enter, keeping focus on the trigger", () => {
    const { trigger, list, onValueChange } = renderSelect();
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    expect(list.hidden).toBe(false);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    const activeId = trigger.getAttribute("aria-activedescendant");
    expect(activeId === null ? null : document.getElementById(activeId)?.textContent).toBe("Beta");
    fireEvent.keyDown(trigger, { key: "Enter" });
    expect(list.hidden).toBe(true);
    expect(trigger.textContent).toBe("Beta");
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith("b");
    expect(document.activeElement).toBe(trigger);
    expect(document.querySelector<HTMLInputElement>('input[name="letter"]')?.value).toBe("b");
  });

  it("names the open list after the field label", () => {
    const { trigger, list } = renderSelect();
    fireEvent.click(trigger);
    expect(list.getAttribute("aria-label")).toBe("Letter");
  });

  it("closes on Escape without a change and marks the key handled", () => {
    const { trigger, list, onValueChange } = renderSelect();
    fireEvent.click(trigger);
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    const escape = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    act(() => {
      trigger.dispatchEvent(escape);
    });
    expect(escape.defaultPrevented).toBe(true);
    expect(list.hidden).toBe(true);
    expect(onValueChange).not.toHaveBeenCalled();
    expect(trigger.textContent).toBe("Alpha");
  });

  it("closes on a press outside without a change, and the click that follows does not land", () => {
    const { trigger, list, onValueChange } = renderSelect();
    const outside = screen.getByRole("button", { name: "outside" });
    const onOutsideClick = vi.fn();
    outside.addEventListener("click", onOutsideClick);
    fireEvent.click(trigger);
    act(() => {
      fireEvent.pointerDown(outside);
    });
    fireEvent.click(outside);
    expect(list.hidden).toBe(true);
    expect(onValueChange).not.toHaveBeenCalled();
    expect(onOutsideClick).not.toHaveBeenCalled();
    fireEvent.pointerDown(outside);
    fireEvent.click(outside);
    expect(onOutsideClick).toHaveBeenCalledOnce();
  });

  it("selects an option on click", () => {
    const { trigger, list, onValueChange } = renderSelect();
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("option", { name: "Gamma" }));
    expect(list.hidden).toBe(true);
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith("c");
    expect(trigger.textContent).toBe("Gamma");
  });

  it("does not open when disabled", () => {
    render(<Select options={OPTIONS} disabled />);
    const trigger = screen.getByRole("combobox");
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("follows a controlled value", () => {
    const { rerender } = render(<Select options={OPTIONS} value="a" />);
    rerender(<Select options={OPTIONS} value="c" />);
    expect(screen.getByRole("combobox").textContent).toBe("Gamma");
  });
});

describe("resolveListPlacement", () => {
  const viewport = { width: 1000, height: 800 };

  it("stands below the trigger with a gap, at least as wide as the trigger", () => {
    expect(resolveListPlacement({ top: 100, bottom: 140, left: 50, width: 200 }, { width: 120, height: 100 }, viewport)).toEqual({
      left: 50,
      top: 144,
      minWidth: 200,
      maxHeight: 256,
    });
  });

  it("stands above when there is no room below and more room above", () => {
    const placement = resolveListPlacement({ top: 700, bottom: 740, left: 50, width: 200 }, { width: 200, height: 120 }, viewport);
    expect(placement).toEqual({ left: 50, top: 576, minWidth: 200, maxHeight: 256 });
  });

  it("scrolls a long list inside at most 256 px and inside the viewport", () => {
    expect(
      resolveListPlacement({ top: 100, bottom: 140, left: 50, width: 200 }, { width: 200, height: 2000 }, viewport).maxHeight,
    ).toBe(256);
    expect(
      resolveListPlacement({ top: 100, bottom: 140, left: 50, width: 200 }, { width: 200, height: 2000 }, { width: 1000, height: 300 })
        .maxHeight,
    ).toBe(148);
  });

  it("keeps a list wider than the trigger off the right edge at 320 px", () => {
    expect(
      resolveListPlacement({ top: 100, bottom: 140, left: 200, width: 100 }, { width: 250, height: 100 }, { width: 320, height: 640 }).left,
    ).toBe(62);
  });
});

function withViewport(width: number, height: number): () => void {
  const root = document.documentElement;
  Object.defineProperty(root, "clientWidth", { configurable: true, value: width });
  Object.defineProperty(root, "clientHeight", { configurable: true, value: height });
  return () => {
    delete (root as { clientWidth?: number }).clientWidth;
    delete (root as { clientHeight?: number }).clientHeight;
  };
}

describe("Select inside an animated container (#163)", () => {
  it("measures the trigger again when an ancestor's animation or transition ends, not on its own chevron", () => {
    let triggerTop = 100;
    const spy = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const top = this.getAttribute("role") === "combobox" ? triggerTop : 0;
      return { left: 10, top, right: 210, bottom: top + 40, width: 200, height: 40, x: 10, y: top, toJSON: () => ({}) };
    });
    const restoreViewport = withViewport(1000, 800);
    try {
      render(
        <div data-testid="panel">
          <Select aria-label="Pick" options={OPTIONS} />
        </div>,
      );
      fireEvent.click(screen.getByRole("combobox"));
      const list = screen.getByRole("listbox");
      expect(list.style.top).toBe("144px");
      triggerTop = 200;
      act(() => {
        fireEvent.transitionEnd(document.querySelector("svg") as Element);
      });
      expect(list.style.top).toBe("144px");
      act(() => {
        fireEvent.animationEnd(screen.getByTestId("panel"));
      });
      expect(list.style.top).toBe("244px");
      triggerTop = 300;
      act(() => {
        fireEvent.transitionEnd(screen.getByTestId("panel"));
      });
      expect(list.style.top).toBe("344px");
    } finally {
      spy.mockRestore();
      restoreViewport();
    }
  });
});
