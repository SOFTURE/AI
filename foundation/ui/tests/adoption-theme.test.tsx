import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  ActionForm,
  buildThemeCss,
  Card,
  DEFAULT_THEME,
  Field,
  Modal,
  MoneyField,
  SoftureThemeProvider,
  ThemeScript,
  ThemeSwitch,
  UiLocaleProvider,
  uiMessages,
} from "../src/index.js";

describe("scheme scopes", () => {
  it("gives each scope the complete scheme, defaults included, even for an empty theme", () => {
    const css = buildThemeCss({}, { schemeScopes: { dark: [".section-dark", "[data-world=night]"] } });
    expect(css.startsWith(".section-dark,\n[data-world=night] {\n  color-scheme: dark;\n")).toBe(true);
    expect(css).toContain(`--sft-color-background: ${DEFAULT_THEME.dark["color-background"]};`);
    expect(css).toContain(`--sft-chart-series-6: ${DEFAULT_THEME.dark["chart-series-6"]};`);
  });

  it("lets the theme override the defaults inside a scope", () => {
    const css = buildThemeCss({ light: { "color-accent": "#123456" } }, { schemeScopes: { light: [".paper"] } });
    const scope = css.slice(css.indexOf(".paper {"));
    expect(scope).toContain("--sft-color-accent: #123456;");
    expect(scope).toContain(`--sft-color-surface: ${DEFAULT_THEME.light["color-surface"]};`);
  });

  it("refuses an unsafe or empty selector", () => {
    for (const selector of [".a { }", ".a;", "</style>", ".a /* x */", " "]) {
      expect(() => buildThemeCss({}, { schemeScopes: { dark: [selector] } })).toThrow(TypeError);
    }
  });

  it("is written by SoftureThemeProvider", () => {
    const html = renderToStaticMarkup(<SoftureThemeProvider schemeScopes={{ dark: [".night"] }} />);
    expect(html).toContain(".night {");
  });
});

describe("ThemeScript and ThemeSwitch with design", () => {
  const design = { schemaVersion: 2, themes: { dark: { roles: { background: "#010203" } } } };

  it("takes the bar colour from design, with theme winning over it", () => {
    expect(renderToStaticMarkup(<ThemeScript design={design} />)).toContain("#010203");
    const both = renderToStaticMarkup(<ThemeScript design={design} theme={{ dark: { "color-background": "#0a0b0c" } }} />);
    expect(both).toContain("#0a0b0c");
    expect(both).not.toContain("#010203");
  });

  it("boots from the app's cookie values", () => {
    const html = renderToStaticMarkup(<ThemeScript cookieValues={{ light: "bright", dark: "night" }} />);
    expect(html).toContain('{\\"light\\":\\"bright\\",\\"dark\\":\\"night\\"}'.replaceAll("\\", ""));
  });

  it("throws on an invalid design, naming the component", () => {
    expect(() => renderToStaticMarkup(<ThemeScript design={{ schemaVersion: 9 }} />)).toThrow(/ThemeScript/);
  });
});

describe("UiLocaleProvider", () => {
  it("sets the locale of client components that have none", () => {
    const html = renderToStaticMarkup(
      <UiLocaleProvider locale="pl">
        <ThemeSwitch />
      </UiLocaleProvider>,
    );
    expect(html).toContain(uiMessages.pl.themeSwitch.legend);
  });

  it("loses to a component's own locale", () => {
    const html = renderToStaticMarkup(
      <UiLocaleProvider locale="pl">
        <ThemeSwitch locale="en" />
      </UiLocaleProvider>,
    );
    expect(html).toContain("Theme");
    expect(html).not.toContain(uiMessages.pl.themeSwitch.legend);
  });

  it("reaches the hint label of the server-safe Card and Field", () => {
    const html = renderToStaticMarkup(
      <UiLocaleProvider locale="pl">
        <Card title="Plan" hint="Why">
          <Field label="Amount" hint="How" hintAs="tooltip">
            <input />
          </Field>
        </Card>
      </UiLocaleProvider>,
    );
    expect(html).toContain(`aria-label="${uiMessages.pl.card.hintLabel.replace("{title}", "Plan")}"`);
    expect(html).toContain(`aria-label="${uiMessages.pl.field.hintLabel.replace("{label}", "Amount")}"`);
  });

  it("formats amounts and the modal and form copy in the provider's locale", () => {
    const html = renderToStaticMarkup(
      <SoftureThemeProvider locale="pl">
        <MoneyField id="m" name="m" label="M" defaultValue="1200" />
        <ActionForm action={() => Promise.resolve({ ok: true })} getErrorMessage={String} submitLabel="Save" onCancel={() => undefined}>
          <p>x</p>
        </ActionForm>
      </SoftureThemeProvider>,
    );
    expect(html).toMatch(/value="1\s200,00"/);
    expect(html).toContain(`>${uiMessages.pl.modal.cancel}<`);
  });

  it("defaults to English without a provider", () => {
    expect(renderToStaticMarkup(<ThemeSwitch />)).toContain("Theme");
    const modal = renderToStaticMarkup(
      <Modal title="T" onClose={() => undefined}>
        <p>x</p>
      </Modal>,
    );
    expect(modal).toContain('aria-label="Close"');
  });
});
