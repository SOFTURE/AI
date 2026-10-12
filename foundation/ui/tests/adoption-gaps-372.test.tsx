// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ConfirmActionButton,
  type ConfirmActionResult,
  DisclosureMenu,
  ExternalLink,
  getDismissalDate,
  getExternalRel,
  ServerExternalLink,
  UiLocaleProvider,
  useDisclosure,
  useDismissed,
  type UseDismissedOptions,
} from "../src/index.js";

// Issue #372: four gaps found adopting the #319 interaction components.

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ConfirmActionButton modalClassNames and cancel slot (#372.1)", () => {
  it("puts the app's classes on the dialog's slots and on the footer's Cancel", () => {
    render(
      <ConfirmActionButton
        label="Delete account"
        title="Delete this account?"
        description="This cannot be undone."
        confirmLabel="Delete"
        action={() => Promise.resolve<ConfirmActionResult>({ ok: true })}
        modalClassNames={{ panel: "app-dialog-motion", close: "app-close" }}
        classNames={{ cancel: "app-cancel" }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete account" }));
    const dialog = screen.getByRole("dialog", { name: "Delete this account?" });
    expect(dialog.className.split(" ")).toContain("app-dialog-motion");
    expect(screen.getByRole("button", { name: "Close" }).className.split(" ")).toContain("app-close");
    expect(screen.getByRole("button", { name: "Cancel" }).className.split(" ")).toContain("app-cancel");
  });
});

describe("useDisclosure closeOutsideOn (#372.2)", () => {
  function renderMenu(closeOutsideOn?: "pointerdown" | "click") {
    render(
      <>
        <DisclosureMenu label="Menu" closeOutsideOn={closeOutsideOn}>
          <a href="#a">A</a>
        </DisclosureMenu>
        <button type="button">Outside</button>
      </>,
    );
    const trigger = screen.getByRole("button", { name: "Menu" });
    const panel = document.getElementById(trigger.getAttribute("aria-controls") ?? "");
    if (panel === null) throw new Error("the trigger controls no panel");
    fireEvent.click(trigger);
    return { panel, outside: screen.getByRole("button", { name: "Outside" }) };
  }

  it("by default closes on the outside pointerdown", () => {
    const { panel, outside } = renderMenu();
    fireEvent.pointerDown(outside);
    expect(panel.hidden).toBe(true);
  });

  it("with click stays open through the outside pointerdown and closes on the click", () => {
    const { panel, outside } = renderMenu("click");
    fireEvent.pointerDown(outside);
    expect(panel.hidden).toBe(false);
    fireEvent.click(outside);
    expect(panel.hidden).toBe(true);
  });

  it("with click still closes on Escape and on a link click inside", () => {
    const { panel } = renderMenu("click");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(panel.hidden).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    fireEvent.click(screen.getByRole("link", { name: "A" }));
    expect(panel.hidden).toBe(true);
  });

  it("is an option of the hook for the app's own markup", () => {
    function Panel() {
      const { isOpen, triggerProps, panelProps } = useDisclosure({ closeOutsideOn: "click" });
      return (
        <>
          <button type="button" {...triggerProps}>
            Toggle
          </button>
          <div {...panelProps}>{isOpen ? "Open" : null}</div>
          <p>Outside text</p>
        </>
      );
    }
    render(<Panel />);
    fireEvent.click(screen.getByRole("button", { name: "Toggle" }));
    fireEvent.pointerDown(screen.getByText("Outside text"));
    expect(screen.getByText("Open")).toBeDefined();
    fireEvent.click(screen.getByText("Outside text"));
    expect(screen.queryByText("Open")).toBeNull();
  });
});

describe("ServerExternalLink and a server-safe getExternalRel (#372.3)", () => {
  const source = readFileSync(join(import.meta.dirname, "../src/ui/server-external-link.tsx"), "utf8");

  it("lives in a module without a client directive and calls no hook", () => {
    expect(source).not.toMatch(/^\s*["']use client["']/m);
    expect(source).not.toMatch(/\buse[A-Z]\w*\(/);
  });

  it("renders the same link as ExternalLink, with the locale by prop", () => {
    const server = renderToStaticMarkup(
      <ServerExternalLink href="https://example.com" rel="external" locale="pl">
        Docs
      </ServerExternalLink>,
    );
    const client = renderToStaticMarkup(
      <UiLocaleProvider locale="pl">
        <ExternalLink href="https://example.com" rel="external">
          Docs
        </ExternalLink>
      </UiLocaleProvider>,
    );
    expect(server).toBe(client);
    expect(server).toContain('target="_blank"');
    expect(server).toContain('rel="external noopener noreferrer"');
  });

  it("takes copy overrides and classes like ExternalLink", () => {
    const html = renderToStaticMarkup(
      <ServerExternalLink href="https://example.com" messages={{ newTab: "(new window)" }} classNames={{ note: "app-note" }} className="app-link">
        Docs
      </ServerExternalLink>,
    );
    expect(html).toContain('class="app-link"');
    expect(html).toContain('<span class="sft:sr-only app-note"> (new window)</span>');
  });

  it("exports getExternalRel from the server-safe module", () => {
    expect(source).toMatch(/export function getExternalRel\(/);
    expect(getExternalRel("me noopener")).toBe("me noopener noreferrer");
  });
});

describe("useDismissed initial (#372.4)", () => {
  function Banner({ options }: { options?: UseDismissedOptions }) {
    const { isDismissed } = useDismissed("banner.deploy", 7, options);
    return isDismissed ? null : <p>Deployed build</p>;
  }

  beforeEach(() => {
    window.localStorage.clear();
  });

  it("on the server hides the notice by default and shows it with initial shown", () => {
    expect(renderToStaticMarkup(<Banner />)).toBe("");
    expect(renderToStaticMarkup(<Banner options={{ initial: "shown" }} />)).toBe("<p>Deployed build</p>");
  });

  it("after hydration still hides a stored dismissal with initial shown", () => {
    window.localStorage.setItem("banner.deploy", getDismissalDate(new Date()));
    render(<Banner options={{ initial: "shown" }} />);
    expect(screen.queryByText("Deployed build")).toBeNull();
  });
});
