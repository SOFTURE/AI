import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Checkbox } from "../../src/ui/checkbox.js";

describe("Checkbox", () => {
  it("draws the tick at 14 px inside the 16 px box", () => {
    const html = renderToStaticMarkup(<Checkbox checked aria-label="Done" />);
    const icon = /<svg[^>]*class="([^"]*)"/.exec(html)?.[1] ?? "";

    expect(icon.split(" ")).toContain("size-3.5");
    expect(icon).not.toContain("place-content-center");
  });
});
