// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { Sidebar, SidebarContent, SidebarProvider, SidebarRail, SidebarTrigger, useSidebar } from "../../src/index.js";
import { installDomShims } from "../gallery/dom.js";

let isPhone = false;

beforeAll(installDomShims);
beforeEach(() => {
  isPhone = false;
  document.cookie = "sidebar_state=; max-age=0; path=/";
  // useIsMobile reads `(max-width: 767px)`; the stub answers it as a phone or a desktop would.
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: isPhone,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function getSidebar(): HTMLElement {
  const sidebar = document.querySelector<HTMLElement>('[data-slot="sidebar"]');
  if (sidebar === null) throw new Error("no sidebar rendered");
  return sidebar;
}

function getTrigger(): HTMLElement {
  const trigger = document.querySelector<HTMLElement>('[data-slot="sidebar-trigger"]');
  if (trigger === null) throw new Error("no sidebar trigger rendered");
  return trigger;
}

function classesOf(element: Element): string[] {
  return (element.getAttribute("class") ?? "").split(" ");
}

function renderSidebar({
  collapsible,
  provider = {},
  sidebar = {},
}: {
  collapsible?: "offcanvas" | "icon" | "none";
  provider?: Partial<Parameters<typeof SidebarProvider>[0]>;
  sidebar?: Partial<Parameters<typeof Sidebar>[0]>;
} = {}) {
  return render(
    <SidebarProvider {...provider}>
      <Sidebar collapsible={collapsible} {...sidebar}>
        <SidebarContent>Pages</SidebarContent>
        <SidebarRail />
      </Sidebar>
      <SidebarTrigger />
    </SidebarProvider>,
  );
}

describe("Sidebar on a desktop", () => {
  it("collapses off canvas from the trigger and keeps the state in a cookie", () => {
    renderSidebar({ collapsible: "offcanvas" });
    expect(getSidebar().dataset["state"]).toBe("expanded");

    fireEvent.click(getTrigger());

    expect(getSidebar().dataset["state"]).toBe("collapsed");
    expect(getSidebar().dataset["collapsible"]).toBe("offcanvas");
    expect(document.cookie).toContain("sidebar_state=false");
  });

  it("collapses to icons with collapsible icon, from the rail too", () => {
    renderSidebar({ collapsible: "icon" });

    fireEvent.click(getTrigger());
    expect(getSidebar().dataset["collapsible"]).toBe("icon");
    fireEvent.click(document.querySelector('[data-slot="sidebar-rail"]') ?? document.body);
    expect(getSidebar().dataset["state"]).toBe("expanded");
  });

  it("toggles on Ctrl+B and on Cmd+B", () => {
    renderSidebar();

    fireEvent.keyDown(window, { key: "b", ctrlKey: true });
    expect(getSidebar().dataset["state"]).toBe("collapsed");
    fireEvent.keyDown(window, { key: "b", metaKey: true });
    expect(getSidebar().dataset["state"]).toBe("expanded");
    fireEvent.keyDown(window, { key: "b" });
    expect(getSidebar().dataset["state"]).toBe("expanded");
  });

  it("draws collapsible none as a sidebar column, not a transparent gap", () => {
    renderSidebar({ collapsible: "none" });

    expect(classesOf(getSidebar())).toEqual(["flex", "h-full", "w-(--sidebar-width)", "flex-col", "bg-sidebar", "text-sidebar-foreground"]);
  });

  it("animates the gap's width when it collapses", () => {
    renderSidebar();

    expect(classesOf(document.querySelector('[data-slot="sidebar-gap"]') ?? document.body)).toEqual(
      expect.arrayContaining(["relative", "w-(--sidebar-width)", "bg-transparent", "transition-[width]", "duration-200", "ease-linear"]),
    );
  });

  it("is controlled by open and onOpenChange and then keeps no cookie", () => {
    const onOpenChange = vi.fn();
    renderSidebar({ provider: { open: true, onOpenChange } });

    fireEvent.click(getTrigger());

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(getSidebar().dataset["state"]).toBe("expanded");
    expect(document.cookie).not.toContain("sidebar_state");
  });

  it("starts collapsed with defaultOpen false", () => {
    renderSidebar({ provider: { defaultOpen: false } });

    expect(getSidebar().dataset["state"]).toBe("collapsed");
  });

  it("names the trigger and the rail by their label props", () => {
    render(
      <SidebarProvider>
        <SidebarRail label="Fold the menu" />
        <SidebarTrigger label="Menu" />
      </SidebarProvider>,
    );

    expect(screen.getByRole("button", { name: "Menu" }).dataset["slot"]).toBe("sidebar-trigger");
    const rail = document.querySelector('[data-slot="sidebar-rail"]');
    expect([rail?.getAttribute("aria-label"), rail?.getAttribute("title")]).toEqual(["Fold the menu", "Fold the menu"]);
  });

  it("calls the trigger's own onClick before it toggles", () => {
    const onClick = vi.fn();
    render(
      <SidebarProvider>
        <SidebarTrigger onClick={onClick} />
      </SidebarProvider>,
    );

    fireEvent.click(getTrigger());

    expect(onClick).toHaveBeenCalledOnce();
  });

  it("fails loudly when a part is used outside the provider", () => {
    function Probe() {
      useSidebar();
      return null;
    }
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() => render(<Probe />)).toThrow("useSidebar must be used within a SidebarProvider.");
  });
});

describe("Sidebar on a phone", () => {
  beforeEach(() => {
    isPhone = true;
  });

  it("opens as a sheet without its own close button or padding, titled by props", () => {
    renderSidebar({ sidebar: { mobileTitle: "Menu", mobileDescription: "The app's pages." } });
    expect(document.querySelector('[data-mobile="true"]')).toBeNull();

    act(() => {
      fireEvent.click(getTrigger());
    });

    // The sheet content carries the sidebar's slot, so the sidebar's CSS applies to it.
    const sheet = document.querySelector('[data-slot="sidebar"][data-mobile="true"]');
    expect(classesOf(sheet ?? document.body)).toEqual(expect.arrayContaining(["bg-sidebar", "p-0", "text-sidebar-foreground", "[&>button]:hidden"]));
    expect(screen.getByRole("dialog", { name: "Menu" })).toBe(sheet);
    expect(sheet?.querySelector(":scope > button")?.textContent).toBe("Close");
    expect(screen.getByText("The app's pages.").dataset["slot"]).toBe("sheet-description");
  });

  it("names the phone sheet in English by default", () => {
    renderSidebar({ provider: { defaultOpen: true } });

    act(() => {
      fireEvent.click(getTrigger());
    });

    expect(screen.getByRole("dialog", { name: "Sidebar" })).toBeTruthy();
    expect(screen.getByText("Displays the mobile sidebar.")).toBeTruthy();
  });
});
