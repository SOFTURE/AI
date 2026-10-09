import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Switch, type SwitchProps } from "../src/index.js";

// Issue 339: a labelled Switch takes an aria-label that overrides its visible label as the accessible name,
// e.g. a switch in a table row whose visible label names only the column. `SwitchProps` used to omit it,
// so this file failed `npm run typecheck`; at runtime the prop already reached the input.

function getSwitchInput(html: string): string {
  return html.match(/<input [^>]*role="switch"[^>]*>/)?.[0] ?? "";
}

describe("Switch aria-label (#339)", () => {
  it("renders aria-label on the role=switch input next to the visible label", () => {
    const props: SwitchProps = {
      name: "fromRetirement",
      id: "row-1-retirement",
      label: "From retirement",
      "aria-label": "From retirement: category Food",
    };
    const html = renderToStaticMarkup(<Switch {...props} />);
    expect(getSwitchInput(html)).toContain('aria-label="From retirement: category Food"');
    expect(html).toContain('<label for="row-1-retirement"');
    expect(html).toContain(">From retirement</label>");
  });

  it("renders no aria-label without the prop", () => {
    const html = renderToStaticMarkup(<Switch name="notify" label="Notify me" />);
    expect(getSwitchInput(html)).not.toContain("aria-label");
  });

  it("keeps aria-describedby driven by the description next to an aria-label", () => {
    const html = renderToStaticMarkup(
      <Switch name="notify" id="notify" label="Notify" aria-label="Notify me by email" description="Once a day" />,
    );
    const input = getSwitchInput(html);
    expect(input).toContain('aria-label="Notify me by email"');
    expect(input).toContain('aria-describedby="notify-description"');
  });
});
