// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Map as MapIcon, type LucideIcon } from "lucide-react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import {
  AsidePanel,
  AsidePanelProvider,
  AsidePanelSidebarOpener,
  AsidePanelToggle,
  type AsidePanelState,
  isOverlayOpen,
  Sidebar,
  SidebarContent,
  SidebarInset,
  SidebarTrigger,
  useAsidePanel,
} from "../../src/index.js";
import { installDomShims } from "../gallery/dom.js";

beforeAll(installDomShims);
afterEach(() => {
  cleanup();
  setViewport(1440);
  document.body.innerHTML = "";
});

let viewportWidth = 1440;
const listeners = new Set<() => void>();

// `useIsMobile` reads `(max-width: 767px)`; the shim answers from the width a test sets.
function setViewport(width: number) {
  viewportWidth = width;
  window.matchMedia = ((query: string) => ({
    matches: /max-width: (\d+)px/.exec(query) !== null && viewportWidth <= Number(/max-width: (\d+)px/.exec(query)?.[1]),
    media: query,
    onchange: null,
    addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}
setViewport(1440);

const CLOSED: AsidePanelState = { isOpen: false, width: "standard" };
const OPEN: AsidePanelState = { isOpen: true, width: "standard" };

function Body() {
  return <p data-testid="body">Map</p>;
}

function renderShell({
  initialState = CLOSED,
  save,
  onSaveError,
  isHidden,
  toggleIcon,
  description,
}: {
  initialState?: AsidePanelState;
  save?: (state: AsidePanelState) => void | Promise<void>;
  onSaveError?: (error: unknown) => void;
  isHidden?: boolean;
  toggleIcon?: LucideIcon;
  description?: string;
} = {}) {
  return render(shell({ initialState, save, onSaveError, isHidden, toggleIcon, description }));
}

function shell({
  initialState = CLOSED,
  save,
  onSaveError,
  isHidden,
  toggleIcon,
  description,
}: {
  initialState?: AsidePanelState;
  save?: (state: AsidePanelState) => void | Promise<void>;
  onSaveError?: (error: unknown) => void;
  isHidden?: boolean;
  toggleIcon?: LucideIcon;
  description?: string;
}) {
  return (
    <AsidePanelProvider initialState={initialState} save={save} onSaveError={onSaveError} isHidden={isHidden}>
      <Sidebar collapsible="offcanvas">
        <SidebarContent>Menu</SidebarContent>
      </Sidebar>
      <SidebarInset>
        <SidebarTrigger />
        <AsidePanelSidebarOpener />
        <AsidePanelToggle icon={toggleIcon} />
        <button type="button">Content action</button>
      </SidebarInset>
      <AsidePanel title="Map" description={description}>
        <Body />
      </AsidePanel>
    </AsidePanelProvider>
  );
}

function sidebarState(): string | null {
  return document.querySelector('[data-slot="sidebar"]')?.getAttribute("data-state") ?? null;
}

function toggle(): HTMLElement {
  const button = document.querySelector<HTMLElement>('[data-slot="aside-panel-toggle"]');
  if (button === null) throw new Error("the toggle is not rendered");
  return button;
}

describe("AsidePanelToggle", () => {
  it("points at the panel and reads closed with the outline look", () => {
    renderShell();
    const button = toggle();

    expect(button.getAttribute("aria-label")).toBe("Show the panel");
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(button.getAttribute("aria-controls")).toBe("aside-panel");
    expect(button.dataset["variant"]).toBe("outline");
  });

  it("opens the panel beside the content, then reads open with the secondary look", () => {
    renderShell();
    fireEvent.click(toggle());

    const panel = screen.getByRole("complementary", { name: "Map" });
    expect(panel.id).toBe("aside-panel");
    expect(panel.dataset["slot"]).toBe("aside-panel");
    expect(panel.dataset["width"]).toBe("standard");
    expect(toggle().getAttribute("aria-label")).toBe("Hide the panel");
    expect(toggle().getAttribute("aria-expanded")).toBe("true");
    expect(toggle().dataset["variant"]).toBe("secondary");
    expect(screen.getByRole("button", { name: "Content action" })).toBeTruthy();
  });

  it("closes the panel on a second press", () => {
    renderShell({ initialState: OPEN });
    fireEvent.click(toggle());

    expect(screen.queryByRole("complementary")).toBeNull();
  });

  it("moves focus to the panel's heading when it opens the panel", () => {
    renderShell();
    fireEvent.click(toggle());

    expect(document.activeElement).toBe(screen.getByRole("heading", { level: 2, name: "Map" }));
  });

  it("leaves focus alone when the panel is kept open on load", () => {
    renderShell({ initialState: OPEN });

    expect(document.activeElement).toBe(document.body);
  });

  it("draws the panel icons by default, the closed one while closed and the open one while open", () => {
    renderShell();
    expect(toggle().querySelector("svg")?.getAttribute("class")).toContain("lucide-panel-right-open");

    fireEvent.click(toggle());
    expect(toggle().querySelector("svg")?.getAttribute("class")).toContain("lucide-panel-right-close");
  });

  it("draws the app's icon in both states, hidden from assistive technology", () => {
    renderShell({ toggleIcon: MapIcon });
    const closedIcon = toggle().querySelector("svg");
    expect(closedIcon?.getAttribute("class")).toContain("lucide-map");
    expect(closedIcon?.getAttribute("aria-hidden")).toBe("true");

    fireEvent.click(toggle());
    expect(toggle().querySelector("svg")?.getAttribute("class")).toContain("lucide-map");
    expect(toggle().getAttribute("aria-label")).toBe("Hide the panel");
  });

  it("shows its label as a hover hint that follows the state", () => {
    renderShell();
    expect(toggle().title).toBe("Show the panel");

    fireEvent.click(toggle());
    expect(toggle().title).toBe("Hide the panel");
  });
});

describe("AsidePanel", () => {
  it("renders nothing of its body while closed, so a lazy body never loads", () => {
    renderShell();

    expect(screen.queryByTestId("body")).toBeNull();
    expect(screen.queryByRole("complementary")).toBeNull();
  });

  it("switches between the standard and the half width from its header", () => {
    const save = vi.fn();
    renderShell({ initialState: OPEN, save });

    fireEvent.click(screen.getByRole("button", { name: "Widen the panel" }));
    expect(screen.getByRole("complementary").dataset["width"]).toBe("half");

    fireEvent.click(screen.getByRole("button", { name: "Narrow the panel" }));
    expect(screen.getByRole("complementary").dataset["width"]).toBe("standard");
  });

  it("shows the width switch's label as a hover hint", () => {
    renderShell({ initialState: OPEN });
    expect(screen.getByRole("button", { name: "Widen the panel" }).title).toBe("Widen the panel");

    fireEvent.click(screen.getByRole("button", { name: "Widen the panel" }));
    expect(screen.getByRole("button", { name: "Narrow the panel" }).title).toBe("Narrow the panel");
  });

  it("hides the wide-screen aside below the md breakpoint, so a phone never paints it from the server HTML", () => {
    const html = renderToString(shell({ initialState: OPEN }));
    const container = document.createElement("div");
    container.innerHTML = html;
    const aside = container.querySelector("aside");

    expect(aside?.dataset["slot"]).toBe("aside-panel");
    expect(aside?.className.split(" ")).toContain("max-md:hidden");
  });

  it("closes on Escape and returns focus to the toggle", () => {
    renderShell({ initialState: OPEN });
    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("complementary")).toBeNull();
    expect(document.activeElement).toBe(toggle());
  });

  it("ignores other keys", () => {
    renderShell({ initialState: OPEN });
    fireEvent.keyDown(document, { key: "Enter" });

    expect(screen.getByRole("complementary")).toBeTruthy();
  });

  it("stays open on Escape while an overlay is open", () => {
    renderShell({ initialState: OPEN });
    const menu = document.createElement("div");
    menu.setAttribute("role", "menu");
    menu.dataset["state"] = "open";
    document.body.append(menu);

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.getByRole("complementary")).toBeTruthy();
  });
});

describe("the sidebar handover", () => {
  it("folds the sidebar while the panel is open and brings it back when the panel closes", () => {
    renderShell();
    expect(sidebarState()).toBe("expanded");

    fireEvent.click(toggle());
    expect(sidebarState()).toBe("collapsed");

    fireEvent.click(toggle());
    expect(sidebarState()).toBe("expanded");
  });

  it("starts with the sidebar folded when the panel is kept open", () => {
    renderShell({ initialState: OPEN });

    expect(sidebarState()).toBe("collapsed");
  });

  it("shows the opener only while the sidebar is folded; it opens the sidebar and closes the panel", async () => {
    const save = vi.fn();
    renderShell({ save });
    expect(screen.queryByRole("button", { name: "Show the menu and hide the panel" })).toBeNull();

    fireEvent.click(toggle());
    const opener = screen.getByRole("button", { name: "Show the menu and hide the panel" });
    expect(opener.title).toBe("Show the menu and hide the panel");
    fireEvent.click(opener);

    expect(sidebarState()).toBe("expanded");
    expect(screen.queryByRole("complementary")).toBeNull();
    expect(screen.queryByRole("button", { name: "Show the menu and hide the panel" })).toBeNull();
    await act(async () => Promise.resolve());
    expect(save).toHaveBeenLastCalledWith(CLOSED);
  });

  it("closes the panel when the sidebar opens through its own trigger", () => {
    renderShell({ initialState: OPEN });
    fireEvent.click(screen.getByRole("button", { name: "Toggle Sidebar" }));

    expect(sidebarState()).toBe("expanded");
    expect(screen.queryByRole("complementary")).toBeNull();
  });

  it("folds the sidebar through its trigger without touching the panel", () => {
    renderShell();
    fireEvent.click(screen.getByRole("button", { name: "Toggle Sidebar" }));

    expect(sidebarState()).toBe("collapsed");
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
  });
});

describe("the kept state", () => {
  it("saves each change on a wide screen", async () => {
    const save = vi.fn();
    renderShell({ save });

    fireEvent.click(toggle());
    fireEvent.click(screen.getByRole("button", { name: "Widen the panel" }));
    await act(async () => Promise.resolve());

    expect(save.mock.calls).toEqual([[{ isOpen: true, width: "standard" }], [{ isOpen: true, width: "half" }]]);
  });

  it("keeps the choice on the page when the save fails and reports the error", async () => {
    const failure = new Error("save failed");
    const onSaveError = vi.fn();
    renderShell({ save: () => Promise.reject(failure), onSaveError });

    fireEvent.click(toggle());
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));

    expect(screen.getByRole("complementary")).toBeTruthy();
    expect(onSaveError).toHaveBeenCalledWith(failure);
  });

  it("keeps the choice when a save throws and nobody listens", async () => {
    renderShell({
      save: () => {
        throw new Error("offline");
      },
    });

    fireEvent.click(toggle());
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));

    expect(screen.getByRole("complementary")).toBeTruthy();
  });
});

describe("a screen that offers no panel", () => {
  it("renders no toggle and no panel, and keeps the sidebar open whatever the kept state says", () => {
    renderShell({ initialState: OPEN, isHidden: true });

    expect(document.querySelector('[data-slot="aside-panel-toggle"]')).toBeNull();
    expect(screen.queryByRole("complementary")).toBeNull();
    expect(sidebarState()).toBe("expanded");
  });
});

describe("on a phone", () => {
  it("never opens the panel from the kept state", () => {
    setViewport(390);
    renderShell({ initialState: OPEN });

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("button", { name: "Show the menu and hide the panel" })).toBeNull();
  });

  it("opens a right sheet for the page only, with focus on its title, and does not save", () => {
    setViewport(390);
    const save = vi.fn();
    renderShell({ save });

    fireEvent.click(toggle());
    const sheet = screen.getByRole("dialog", { name: "Map" });

    expect(sheet.dataset["slot"]).toBe("aside-panel-sheet");
    expect(sheet.id).toBe("aside-panel");
    expect(screen.getByTestId("body")).toBeTruthy();
    expect(document.activeElement?.textContent).toBe("Map");
    expect(save).not.toHaveBeenCalled();
  });

  it("closes the sheet on Escape and returns focus to the toggle", async () => {
    setViewport(390);
    renderShell();
    fireEvent.click(toggle());

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    // Radix moves focus out of a closed dialog's focus scope on the next task.
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(toggle());
  });

  it("describes the sheet with the app's one-line description", () => {
    setViewport(390);
    renderShell({ description: "Places of the current trip" });
    fireEvent.click(toggle());

    const sheet = screen.getByRole("dialog", { name: "Map" });
    const describedBy = sheet.getAttribute("aria-describedby");
    expect(describedBy).not.toBeNull();
    expect(document.getElementById(describedBy ?? "")?.textContent).toBe("Places of the current trip");
  });

  it("has no description unless the app gives one", () => {
    setViewport(390);
    renderShell();
    fireEvent.click(toggle());

    expect(screen.getByRole("dialog", { name: "Map" }).hasAttribute("aria-describedby")).toBe(false);
  });
});

describe("useAsidePanel", () => {
  it("throws outside the provider", () => {
    const Reader = () => <span>{String(useAsidePanel().isOpen)}</span>;
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() => render(<Reader />)).toThrow("useAsidePanel must be used within an AsidePanelProvider.");
    expect(() => render(<AsidePanelToggle />)).toThrow("AsidePanelToggle must be used within an AsidePanelProvider.");
  });

  it("reads the state and acts on it", () => {
    function Reader() {
      const panel = useAsidePanel();
      return (
        <button type="button" onClick={() => panel.setWidth("half")}>
          {`${String(panel.isOpen)} ${panel.width}`}
        </button>
      );
    }
    render(
      <AsidePanelProvider initialState={OPEN}>
        <Reader />
      </AsidePanelProvider>,
    );
    fireEvent.click(screen.getByRole("button"));

    expect(screen.getByRole("button").textContent).toBe("true half");
  });
});

describe("isOverlayOpen", () => {
  function make(html: string): HTMLElement {
    const root = document.createElement("div");
    root.innerHTML = html;
    return root;
  }

  it.each([
    ['<div role="dialog" data-state="open"></div>', true],
    ['<div role="alertdialog" data-state="open"></div>', true],
    ['<div role="menu" data-state="open"></div>', true],
    ['<div role="listbox" data-state="open"></div>', true],
    ["<dialog open></dialog>", true],
    ['<div role="dialog" data-state="closed"></div>', false],
    ["<dialog></dialog>", false],
    ['<div data-state="open"></div>', false],
    ["", false],
  ])("%s → %s", (html, expected) => {
    expect(isOverlayOpen(make(html))).toBe(expected);
  });

  it("treats a selector the DOM does not know as no match", () => {
    const root = { querySelector: (selector: string) => {
      if (selector === ":popover-open") throw new SyntaxError("unknown pseudo-class");
      return null;
    } } as unknown as ParentNode;

    expect(isOverlayOpen(root)).toBe(false);
  });

  it("counts an element that matches :popover-open", () => {
    const root = { querySelector: (selector: string) => (selector === ":popover-open" ? {} : null) } as unknown as ParentNode;

    expect(isOverlayOpen(root)).toBe(true);
  });
});
