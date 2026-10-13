// Issue #435: an app plugs its own translation of the built-in copy in once, through UiLocaleProvider.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Card, ExternalLink, SoftureThemeProvider, ThemeSwitch, UiLocaleProvider, uiMessages } from "../src/index.js";

describe("UiLocaleProvider messages", () => {
  it("replaces the built-in copy of client components below it, with English as the base", () => {
    const html = renderToStaticMarkup(
      <UiLocaleProvider messages={{ themeSwitch: { legend: "Appearance" } }}>
        <ThemeSwitch />
      </UiLocaleProvider>,
    );
    expect(html).toContain("Appearance");
    expect(html).not.toContain(`>${uiMessages.en.themeSwitch.legend}<`);
    expect(html).toContain(uiMessages.en.themeSwitch.light);
  });

  it("loses to a component's own messages key by key", () => {
    const html = renderToStaticMarkup(
      <UiLocaleProvider messages={{ themeSwitch: { legend: "Appearance", dark: "Night" } }}>
        <ThemeSwitch messages={{ legend: "Look" }} />
      </UiLocaleProvider>,
    );
    expect(html).toContain("Look");
    expect(html).not.toContain("Appearance");
    expect(html).toContain("Night");
  });

  it("reaches the hint label of the server-safe Card and the note of ExternalLink", () => {
    const html = renderToStaticMarkup(
      <UiLocaleProvider messages={{ card: { hintLabel: "More on {title}" }, externalLink: { newTab: "(new window)" } }}>
        <Card title="Plan" hint="Why" />
        <ExternalLink href="https://example.com">Docs</ExternalLink>
      </UiLocaleProvider>,
    );
    expect(html).toContain('aria-label="More on Plan"');
    expect(html).toContain("(new window)");
  });

  it("is set through SoftureThemeProvider too", () => {
    const html = renderToStaticMarkup(
      <SoftureThemeProvider messages={{ themeSwitch: { legend: "Appearance" } }}>
        <ThemeSwitch />
      </SoftureThemeProvider>,
    );
    expect(html).toContain("Appearance");
  });

  it("leaves the copy unchanged without messages", () => {
    const html = renderToStaticMarkup(
      <UiLocaleProvider>
        <ThemeSwitch />
      </UiLocaleProvider>,
    );
    expect(html).toContain(`>${uiMessages.en.themeSwitch.legend}<`);
  });
});
