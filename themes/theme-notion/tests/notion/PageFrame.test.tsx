import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PageFrame } from "../../src/notion/PageFrame.js";

describe("PageFrame", () => {
  it("wraps the page in the element the token bridge and the body rule select", () => {
    const html = renderToStaticMarkup(
      <PageFrame>
        <p>page</p>
      </PageFrame>,
    );

    expect(html).toMatch(/^<div data-page-frame="" class="[^"]*"><p>page<\/p><\/div>$/);
  });

  it("does not carry data-slot, so the scoped preflight leaves the package pages alone", () => {
    expect(renderToStaticMarkup(<PageFrame>x</PageFrame>)).not.toContain("data-slot");
  });
});
