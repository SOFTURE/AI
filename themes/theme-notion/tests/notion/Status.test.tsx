import { CircleCheck, CircleX } from "lucide-react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { readTextNodes } from "../support.js";

import { Status } from "../../src/notion/Status.js";

describe("Status", () => {
  it("shows the word and a hidden icon in the palette colour", () => {
    const html = renderToStaticMarkup(
      <Status color="green" icon={CircleCheck}>
        Done
      </Status>,
    );
    const text = readTextNodes(html).join("");

    expect(html).toContain('data-slot="status"');
    expect(html).toContain('data-color="green"');
    expect(html).toMatch(/class="[^"]*\btext-green\b/);
    expect(html).toMatch(/<svg[^>]*aria-hidden="true"/);
    expect(text).toBe("Done");
  });

  it("keeps two states apart by word and icon, not only by colour", () => {
    const done = renderToStaticMarkup(<Status color="green" icon={CircleCheck}>Paid</Status>);
    const unpaid = renderToStaticMarkup(<Status color="red" icon={CircleX}>To pay</Status>);

    expect(done).toContain("lucide-circle-check");
    expect(unpaid).toContain("lucide-circle-x");
    expect(unpaid).toMatch(/class="[^"]*\btext-red\b/);
  });
});
