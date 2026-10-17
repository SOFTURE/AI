// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AccountMenu, ColorField, DisclosureMenu, isMobileMenuGroup, MobileMenu, UiLocaleProvider, uiMessages } from "../src/index.js";

// Issue #558: the header menus and the colour field an adopting app still kept.

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function getPanel(trigger: HTMLElement): HTMLElement {
  const id = trigger.getAttribute("aria-controls") ?? "";
  const panel = document.getElementById(id);
  if (panel === null) throw new Error(`No panel with id ${id}`);
  return panel;
}

describe("AccountMenu trigger (#558.1)", () => {
  it("shows the trigger node in place of the user icon and keeps the button's name", () => {
    render(<AccountMenu trigger={<span data-testid="initial">J</span>} name="Jane" />);
    const button = screen.getByRole("button", { name: "Account" });
    expect(button.contains(screen.getByTestId("initial"))).toBe(true);
    expect(button.querySelector("svg")).toBeNull();
  });

  it("keeps the user icon without a trigger", () => {
    render(<AccountMenu name="Jane" />);
    expect(screen.getByRole("button", { name: "Account" }).querySelector("svg")).not.toBeNull();
  });
});

describe("DisclosureMenu leave motion (#558.2)", () => {
  function stubTransition(duration: string) {
    const original = window.getComputedStyle.bind(window);
    vi.spyOn(window, "getComputedStyle").mockImplementation((element) => {
      const style = original(element);
      if (!(element instanceof HTMLElement) || !element.hasAttribute("data-state")) return style;
      return { ...style, transitionDuration: duration, transitionDelay: "0s", animationDuration: "0s", animationDelay: "0s" };
    });
  }

  function renderMenu() {
    render(
      <DisclosureMenu label="Account">
        <a href="/settings">Settings</a>
      </DisclosureMenu>,
    );
    const trigger = screen.getByRole("button", { name: "Account" });
    return { trigger, panel: getPanel(trigger) };
  }

  it("starts hidden and closed, and opens without hidden", () => {
    const { trigger, panel } = renderMenu();
    expect(panel.hidden).toBe(true);
    expect(panel.getAttribute("data-state")).toBe("closed");
    fireEvent.click(trigger);
    expect(panel.hidden).toBe(false);
    expect(panel.getAttribute("data-state")).toBe("open");
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
  });

  it("keeps a closing panel shown until its transition ends, then hides it", () => {
    stubTransition("0.15s");
    const { trigger, panel } = renderMenu();
    fireEvent.click(trigger);
    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(panel.getAttribute("data-state")).toBe("closed");
    expect(panel.hidden).toBe(false);
    act(() => {
      panel.dispatchEvent(new Event("transitionend", { bubbles: true }));
    });
    expect(panel.hidden).toBe(true);
  });

  it("hides after a timeout when no transitionend arrives", () => {
    vi.useFakeTimers();
    stubTransition("0.15s");
    const { trigger, panel } = renderMenu();
    fireEvent.click(trigger);
    fireEvent.click(trigger);
    expect(panel.hidden).toBe(false);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(panel.hidden).toBe(true);
  });

  it("hides at once when no transition runs (reduced motion)", () => {
    stubTransition("0s");
    const { trigger, panel } = renderMenu();
    fireEvent.click(trigger);
    fireEvent.click(trigger);
    expect(panel.hidden).toBe(true);
  });

  it("cancels the pending hide when reopened during the leave", () => {
    stubTransition("0.15s");
    const { trigger, panel } = renderMenu();
    fireEvent.click(trigger);
    fireEvent.click(trigger);
    fireEvent.click(trigger);
    act(() => {
      panel.dispatchEvent(new Event("transitionend", { bubbles: true }));
    });
    expect(panel.hidden).toBe(false);
    expect(panel.getAttribute("data-state")).toBe("open");
  });

  it("ships the motion classes with a reduced-motion opt-out and a pointer-inert closing state", () => {
    const { panel } = renderMenu();
    const classes = panel.className.split(" ");
    expect(classes).toEqual(
      expect.arrayContaining([
        "sft:starting:opacity-0",
        "sft:data-[state=closed]:opacity-0",
        "sft:data-[state=closed]:pointer-events-none",
        "sft:motion-reduce:transition-none",
      ]),
    );
  });
});

describe("MobileMenu groups (#558.3)", () => {
  const items = [
    { href: "/", label: "Dashboard", isCurrent: true },
    {
      heading: "Account",
      items: [
        { href: "/settings", label: "Settings" },
        { href: "/billing", label: "Billing" },
      ],
    },
    { heading: "Help", items: [{ href: "/docs", label: "Docs" }] },
  ] as const;

  it("renders each group as a list named by its heading", () => {
    render(<MobileMenu items={items} />);
    const account = screen.getByRole("list", { name: "Account", hidden: true });
    expect(Array.from(account.querySelectorAll("a"), (link) => link.textContent)).toEqual(["Settings", "Billing"]);
    const help = screen.getByRole("list", { name: "Help", hidden: true });
    expect(help.querySelector("a")?.getAttribute("href")).toBe("/docs");
    expect(screen.getByRole("link", { name: "Dashboard", hidden: true }).getAttribute("aria-current")).toBe("page");
  });

  it("keeps a flat list's markup", () => {
    render(<MobileMenu items={[{ href: "/", label: "Dashboard" }]} />);
    const nav = screen.getByRole("navigation", { name: "Menu", hidden: true });
    expect(nav.innerHTML).toBe('<ul class="sft:m-0 sft:flex sft:list-none sft:flex-col sft:gap-0.5 sft:p-0"><li><a href="/" class="sft:aria-[current=page]:bg-foreground/5 sft:aria-[current=page]:font-semibold">Dashboard</a></li></ul>');
  });

  it("tells a group from an item", () => {
    expect(isMobileMenuGroup({ heading: "Help", items: [] })).toBe(true);
    expect(isMobileMenuGroup({ href: "/", label: "Home" })).toBe(false);
  });
});

describe("ColorField presets (#558.4)", () => {
  const presets = [
    { value: "#0EA5E9", label: "Ocean" },
    { value: "#f59e0b", label: "Amber" },
    { value: "#10b981", label: "Mint" },
  ];

  it("renders no radio group without presets", () => {
    render(<ColorField name="accent" label="Accent" />);
    expect(screen.queryByRole("radiogroup")).toBeNull();
  });

  it("names the group and each swatch, and checks the swatch matching the value in any case", () => {
    render(<ColorField name="accent" label="Accent" defaultValue="#0ea5e9" presets={presets} />);
    const group = screen.getByRole("radiogroup", { name: "Preset colours: Accent" });
    const radios = Array.from(group.querySelectorAll('[role="radio"]'));
    expect(radios.map((radio) => radio.getAttribute("aria-label"))).toEqual(["Ocean", "Amber", "Mint"]);
    expect(radios.map((radio) => radio.getAttribute("aria-checked"))).toEqual(["true", "false", "false"]);
    expect(radios.map((radio) => radio.getAttribute("tabindex"))).toEqual(["0", "-1", "-1"]);
  });

  it("fills the text and the picker on a click and reports the value", () => {
    const onValueChange = vi.fn();
    render(<ColorField name="accent" label="Accent" presets={presets} onValueChange={onValueChange} />);
    fireEvent.click(screen.getByRole("radio", { name: "Amber" }));
    expect(screen.getByRole("textbox", { name: "Accent" })).toHaveProperty("value", "#f59e0b");
    expect(screen.getByLabelText("Pick a colour: Accent")).toHaveProperty("value", "#f59e0b");
    expect(onValueChange).toHaveBeenCalledWith("#f59e0b");
    expect(screen.getByRole("radio", { name: "Amber" }).getAttribute("aria-checked")).toBe("true");
  });

  it("moves the choice and the focus with the arrow keys, wrapping at the ends", () => {
    render(<ColorField name="accent" label="Accent" defaultValue="#10b981" presets={presets} />);
    const mint = screen.getByRole("radio", { name: "Mint" });
    fireEvent.keyDown(mint, { key: "ArrowRight" });
    const ocean = screen.getByRole("radio", { name: "Ocean" });
    expect(document.activeElement).toBe(ocean);
    expect(ocean.getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("textbox", { name: "Accent" })).toHaveProperty("value", "#0ea5e9");
    fireEvent.keyDown(ocean, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(mint);
    fireEvent.keyDown(mint, { key: "Home" });
    expect(document.activeElement).toBe(ocean);
  });

  it("puts only the text field in the form's data", () => {
    render(
      <form aria-label="Brand">
        <ColorField name="accent" label="Accent" defaultValue="#0ea5e9" presets={presets} />
      </form>,
    );
    const data = new FormData(screen.getByRole<HTMLFormElement>("form", { name: "Brand" }));
    expect(Array.from(data.keys())).toEqual(["accent"]);
  });

  it("takes the group's name from the overrides", () => {
    render(
      <UiLocaleProvider messages={{ colorField: { ...uiMessages.en.colorField, presets: "Swatches for {label}" } }}>
        <ColorField name="accent" label="Accent" presets={presets} />
      </UiLocaleProvider>,
    );
    expect(screen.getByRole("radiogroup", { name: "Swatches for Accent" })).toBeDefined();
  });
});
