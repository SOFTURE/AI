import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getThemeBootScript, SoftureThemeProvider, ThemeScript, ThemeSwitch, uiMessages } from "../src/index.js";

describe("SoftureThemeProvider", () => {
  it("renders the override CSS before its children", () => {
    const html = renderToStaticMarkup(
      <SoftureThemeProvider theme={{ light: { "color-accent": "#123456" } }}>
        <p>child</p>
      </SoftureThemeProvider>,
    );
    expect(html).toMatch(/^<style data-softure-theme="">[^<]*--sft-color-accent: #123456;[^<]*<\/style><p>child<\/p>$/);
  });

  it("renders no style element for an empty theme", () => {
    expect(renderToStaticMarkup(<SoftureThemeProvider>x</SoftureThemeProvider>)).toBe("x");
  });

  it("throws on an unsafe token value", () => {
    expect(() =>
      renderToStaticMarkup(<SoftureThemeProvider theme={{ dark: { "color-accent": "red;}</style>" } }} />),
    ).toThrow(/color-accent/);
  });

  it("applies a design.json value and lets theme override it per token", () => {
    const design = { schemaVersion: 2, themes: { dark: { roles: { accent: "#ff0000", muted: "#777777" } } } };
    const html = renderToStaticMarkup(
      <SoftureThemeProvider design={design} theme={{ dark: { "color-accent": "#00ff00" } }} />,
    );
    expect(html).toContain("--sft-color-accent: #00ff00;");
    expect(html).toContain("--sft-color-muted: #777777;");
    expect(html).not.toContain("#ff0000");
  });

  it("throws on an invalid design value, naming the error code", () => {
    expect(() => renderToStaticMarkup(<SoftureThemeProvider design={{ schemaVersion: 9, themes: {} }} />)).toThrow(
      /ui\.design_json_unsupported_version/,
    );
  });
});

describe("ThemeScript", () => {
  it("renders the boot script with the theme's bar colours and the nonce", () => {
    const html = renderToStaticMarkup(
      <ThemeScript nonce="abc" theme={{ dark: { "color-background": "#010101" } }} />,
    );
    expect(html.startsWith('<script nonce="abc">')).toBe(true);
    expect(html).toContain("#010101");
    expect(html).toContain('"dark"');
  });

  it("renders the same code as getThemeBootScript", () => {
    const html = renderToStaticMarkup(<ThemeScript cookieName="t" />);
    const script = html.replace(/^<script>/, "").replace(/<\/script>$/, "");
    expect(script).toBe(getThemeBootScript({ cookieName: "t", themeColors: { light: "#f6f7f8", dark: "#0c0c0d" } }));
  });
});

describe("ThemeSwitch", () => {
  it("renders a radio group with the English labels and System checked on the server", () => {
    const html = renderToStaticMarkup(<ThemeSwitch />);
    const copy = uiMessages.en.themeSwitch;
    expect(html).toContain(`<legend class="sft:mb-2`);
    expect(html).toContain(`>${copy.legend}</legend>`);
    for (const label of [copy.light, copy.dark, copy.system]) expect(html).toContain(`>${label}</span>`);
    expect(html.match(/type="radio"/g)).toHaveLength(3);
    const checked = [...html.matchAll(/<input [^>]*>/g)].filter(([input]) => input.includes('checked=""'));
    expect(checked.map(([input]) => input.match(/value="(\w+)"/)?.[1])).toEqual(["system"]);
  });

  it("renders the Polish labels for the pl locale", () => {
    const html = renderToStaticMarkup(<ThemeSwitch locale="pl" />);
    const copy = uiMessages.pl.themeSwitch;
    for (const label of [copy.legend, copy.light, copy.dark, copy.system]) expect(html).toContain(`>${label}<`);
  });

  it("applies a partial message override for the current locale only", () => {
    const html = renderToStaticMarkup(<ThemeSwitch messages={{ legend: "Appearance" }} />);
    expect(html).toContain(">Appearance</legend>");
    expect(html).toContain(`>${uiMessages.en.themeSwitch.dark}</span>`);
  });

  it("adds slot classes to the defaults", () => {
    const html = renderToStaticMarkup(<ThemeSwitch classNames={{ root: "app-root", option: "app-option" }} />);
    expect(html).toMatch(/<fieldset class="sft:[^"]* app-root">/);
    expect(html.match(/class="sft:[^"]* app-option"/g)).toHaveLength(3);
  });

  it("renders only the app's classes when unstyled", () => {
    const html = renderToStaticMarkup(<ThemeSwitch unstyled classNames={{ root: "app-root" }} />);
    expect(html).not.toContain("sft:");
    expect(html).toContain('<fieldset class="app-root">');
    expect(html).toContain("<legend>");
  });
});
