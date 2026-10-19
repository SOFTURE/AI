import { fakeMailProvider } from "@softure-ai/mailing/testing";
import { Waitlist } from "@softure-ai/waitlist/next";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { createConfig } from "./support.js";

const config = createConfig(fakeMailProvider());

/** The submit button's class attribute in the rendered markup. */
function getButtonClass(html: string): string {
  return /<button[^>]*class="([^"]*)"/.exec(html)?.[1] ?? "";
}

vi.mock("@softure-ai/core/next", () => ({ getSoftureConfig: () => config }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/headers", () => ({ headers: () => Promise.resolve(new Headers()) }));
vi.mock("next/server", () => ({ after: vi.fn() }));

describe("Waitlist", () => {
  it("renders today's form without the look props", () => {
    const html = renderToStaticMarkup(<Waitlist placement="hero" />);
    expect(getButtonClass(html)).toContain("sft:w-full");
    expect(html).not.toContain("placeholder=");
  });

  it("passes the app's look, ids and consent descriptions to the form", () => {
    const html = renderToStaticMarkup(
      <Waitlist
        placement="hero"
        consentDescriptions={{ launch: "You can unsubscribe any time." }}
        consentIds={{ launch: "field-consent-launch" }}
        emailProps={{ id: "field-email", placeholder: "you@example.com" }}
        fieldClassNames={{ label: "app-label" }}
        scopeClassNames={{ label: "app-check" }}
        submitFullWidth={false}
        classNames={{ submit: "app-button" }}
      />,
    );
    expect(html).toContain('id="field-email"');
    expect(html).toContain('placeholder="you@example.com"');
    expect(html).toContain("app-label");
    expect(html).toContain('id="field-consent-launch"');
    expect(html).toContain("You can unsubscribe any time.");
    expect(html).toContain("app-check");
    expect(getButtonClass(html)).toContain("app-button");
    expect(getButtonClass(html)).not.toContain("sft:w-full");
  });
});
