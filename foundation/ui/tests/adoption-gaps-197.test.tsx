// @vitest-environment happy-dom
// Issue #197: the theme cookie domain per hostname, message errors in ActionForm, Button className and ButtonAnchor.
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ActionForm,
  type ActionResult,
  buildThemeCookie,
  Button,
  ButtonAnchor,
  ButtonLink,
  getThemeCookieDomain,
  type MessageActionResult,
  TextField,
  ThemeSwitch,
} from "../src/index.js";

afterEach(cleanup);

describe("getThemeCookieDomain", () => {
  it("shares the cookie between the apex and its subdomains", () => {
    expect(getThemeCookieDomain("example.com", "example.com")).toBe("example.com");
    expect(getThemeCookieDomain("app.example.com", "example.com")).toBe("example.com");
    expect(getThemeCookieDomain("App.Example.com", "https://example.com")).toBe("example.com");
    expect(getThemeCookieDomain("app.example.com", "https://example.com:8443/path")).toBe("example.com");
  });

  it("keeps the cookie host-only on another host, localhost, an IP address and a bad apex", () => {
    expect(getThemeCookieDomain("notexample.com", "example.com")).toBeNull();
    expect(getThemeCookieDomain("example.com.evil.net", "example.com")).toBeNull();
    expect(getThemeCookieDomain("localhost", "http://localhost:3000")).toBeNull();
    expect(getThemeCookieDomain("127.0.0.1", "127.0.0.1")).toBeNull();
    expect(getThemeCookieDomain("[::1]", "http://[::1]:3000")).toBeNull();
    expect(getThemeCookieDomain("example.com", "")).toBeNull();
    expect(getThemeCookieDomain("example.com", "https://")).toBeNull();
    expect(getThemeCookieDomain("example.com", "exa mple.com")).toBeNull();
  });
});

describe("theme cookie domain", () => {
  it("rejects a domain that would add cookie attributes", () => {
    expect(() => buildThemeCookie("dark", { domain: "example.com; Secure" })).toThrow('Invalid theme cookie domain: "example.com; Secure"');
    expect(buildThemeCookie("dark", { domain: ".example.com" })).toContain("; Domain=.example.com;");
  });

  // happy-dom's own API for moving the page to another URL; not part of the DOM types.
  const happyDom = (window as unknown as { happyDOM: { setURL(url: string): void } }).happyDOM;

  function captureCookieWrites(): { writes: string[]; restore: () => void } {
    const writes: string[] = [];
    Object.defineProperty(document, "cookie", {
      configurable: true,
      get: () => "",
      set: (value: string) => writes.push(value),
    });
    return { writes, restore: () => Reflect.deleteProperty(document, "cookie") };
  }

  it("ThemeSwitch calls a function domain with the current hostname on each change", () => {
    const { writes, restore } = captureCookieWrites();
    const cookieDomain = vi.fn((hostname: string) => `shared.${hostname}`);
    render(<ThemeSwitch cookieDomain={cookieDomain} />);
    fireEvent.click(screen.getByLabelText("Dark"));
    restore();
    expect(cookieDomain).toHaveBeenCalledWith(window.location.hostname);
    expect(writes.at(-1)).toContain(`; Domain=shared.${window.location.hostname};`);
  });

  it("ThemeSwitch with a function returning null keeps the cookie host-only", () => {
    const { writes, restore } = captureCookieWrites();
    render(<ThemeSwitch cookieDomain={() => null} />);
    fireEvent.click(screen.getByLabelText("Dark"));
    restore();
    expect(writes).toEqual([expect.stringMatching(/^sft-theme=dark; Path=\/; Max-Age=\d+; SameSite=Lax$/)]);
  });

  it("ThemeSwitch with { apex } shares the cookie from a subdomain of that apex", () => {
    const previous = window.location.href;
    happyDom.setURL("https://app.example.com/settings");
    const { writes, restore } = captureCookieWrites();
    render(<ThemeSwitch cookieDomain={{ apex: "https://example.com" }} />);
    fireEvent.click(screen.getByLabelText("Light"));
    restore();
    happyDom.setURL(previous);
    expect(writes.at(-1)).toMatch(/^sft-theme=light; Path=\/; Domain=example\.com; Max-Age=\d+; SameSite=Lax$/);
  });
});

describe("ActionForm with message errors", () => {
  async function submit(form: HTMLFormElement) {
    await act(async () => {
      fireEvent.submit(form);
      await Promise.resolve();
    });
  }

  it("shows the action's messages as they are, without a mapper", async () => {
    const action = (): Promise<MessageActionResult> =>
      Promise.resolve({ ok: false, error: "Your changes were not saved", fieldErrors: { name: "That name is already in use" } });
    const { container } = render(
      <ActionForm action={action} submitLabel="Save">
        <TextField id="n" name="name" label="Name" />
      </ActionForm>,
    );
    const form = container.querySelector("form");
    if (form === null) throw new Error("ActionForm rendered no form");
    await submit(form);
    expect(screen.getByRole("alert").textContent).toBe("Your changes were not saved");
    expect(screen.getByText("That name is already in use").id).toBe(screen.getByLabelText("Name").getAttribute("aria-describedby"));
  });

  it("still maps codes when a mapper is given", async () => {
    const action = (): Promise<ActionResult> => Promise.resolve({ ok: false, error: "app.save_failed" });
    const { container } = render(
      <ActionForm action={action} getErrorMessage={(code) => (code === "app.save_failed" ? "Could not save." : code)} submitLabel="Save">
        <TextField id="n" name="name" label="Name" />
      </ActionForm>,
    );
    const form = container.querySelector("form");
    if (form === null) throw new Error("ActionForm rendered no form");
    await submit(form);
    expect(screen.getByRole("alert").textContent).toBe("Could not save.");
  });
});

describe("Button className and ButtonAnchor", () => {
  it("appends className to the root, after classNames.root", () => {
    const html = renderToStaticMarkup(
      <Button variant="ghost" classNames={{ root: "app-a" }} className="app-b">
        Go
      </Button>,
    );
    expect(html).toMatch(/^<button type="button" data-variant="ghost" data-size="md" class="sft:[^"]* app-a app-b">/);
  });

  it("with unstyled, className is the only class", () => {
    expect(renderToStaticMarkup(<Button variant="primary" unstyled className="app-b">Go</Button>)).toBe(
      '<button type="button" data-variant="primary" data-size="md" class="app-b">Go</button>',
    );
  });

  it("ButtonAnchor is a plain anchor with the button look, its attributes kept", () => {
    const anchor = renderToStaticMarkup(
      <ButtonAnchor variant="secondary" href="/export.csv" download className="app-b">
        Export
      </ButtonAnchor>,
    );
    const link = renderToStaticMarkup(
      <ButtonLink variant="secondary" href="/export.csv" download className="app-b">
        Export
      </ButtonLink>,
    );
    expect(anchor).toBe(link);
    expect(anchor).toMatch(/^<a href="\/export\.csv" download="" data-variant="secondary" data-size="md" class="sft:[^"]* app-b">Export<\/a>$/);
  });
});
