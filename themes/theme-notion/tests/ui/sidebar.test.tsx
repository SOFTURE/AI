// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Sidebar, SidebarProvider, SidebarTrigger } from "../../src/ui/sidebar.js";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function mockPhoneViewport(): void {
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        matches: true,
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }) as unknown as MediaQueryList,
  );
}

function readClasses(element: Element | null): string[] {
  return (element?.getAttribute("class") ?? "").split(/\s+/);
}

function readSlot(html: string, slot: string): string[] {
  const host = document.createElement("div");
  host.innerHTML = html;
  return readClasses(host.querySelector(`[data-slot="${slot}"]`));
}

describe("Sidebar", () => {
  it("renders a collapsible=none sidebar as a column on the sidebar background", () => {
    const classes = readSlot(
      renderToStaticMarkup(
        <SidebarProvider>
          <Sidebar collapsible="none">Menu</Sidebar>
        </SidebarProvider>,
      ),
      "sidebar",
    );

    expect(classes).toEqual(expect.arrayContaining(["flex", "h-full", "flex-col", "bg-sidebar", "text-sidebar-foreground"]));
    expect(classes).not.toContain("bg-transparent");
  });

  it("gives the desktop gap a transparent, width-animated box", () => {
    const classes = readSlot(
      renderToStaticMarkup(
        <SidebarProvider>
          <Sidebar>Menu</Sidebar>
        </SidebarProvider>,
      ),
      "sidebar-gap",
    );

    expect(classes).toEqual(expect.arrayContaining(["relative", "bg-transparent", "transition-[width]", "duration-200", "ease-linear"]));
    expect(classes).not.toContain("bg-sidebar");
  });

  it("opens on a phone as a sheet padded only by the safe-area insets, on the sidebar background, without the sheet's own close button", () => {
    mockPhoneViewport();
    render(
      <SidebarProvider>
        <Sidebar>Menu</Sidebar>
        <SidebarTrigger />
      </SidebarProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Toggle Sidebar" }));
    const classes = readClasses(document.querySelector('[data-mobile="true"]'));

    expect(classes).toEqual(expect.arrayContaining(["bg-sidebar", "text-sidebar-foreground", "[&>button]:hidden"]));
    // No padding of its own: only the sheet's safe-area insets (#851).
    expect(classes).not.toContain("p-0");
  });
});
