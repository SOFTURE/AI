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

  it("puts the word in a truncating label so the word, not the icon, shrinks", () => {
    const html = renderToStaticMarkup(
      <Status color="blue" icon={CircleCheck}>
        Observation, day 1 of 30
      </Status>,
    );

    expect(html).toMatch(/<span data-slot="status-label" class="min-w-0 truncate">Observation, day 1 of 30<\/span>/);
    expect(html).toMatch(/data-slot="status"[^>]*class="[^"]*\[&amp;&gt;svg\]:shrink-0/);
    expect(html).toMatch(/data-slot="status"[^>]*class="[^"]*\bmax-w-full\b/);
  });

  it.each([
    ["a string", "Observation, day 1 of 30", "Observation, day 1 of 30"],
    ["a number", 30, "30"],
  ] as const)("titles the badge with the full word when it is %s", (_kind, word, title) => {
    const html = renderToStaticMarkup(
      <Status color="blue" icon={CircleCheck}>
        {word}
      </Status>,
    );

    expect(html).toContain(`title="${title}"`);
  });

  it("sets no title for a word that is not plain text, and an explicit title wins", () => {
    const node = renderToStaticMarkup(
      <Status color="blue" icon={CircleCheck}>
        <strong>Paid</strong>
      </Status>,
    );
    const explicit = renderToStaticMarkup(
      <Status color="blue" icon={CircleCheck} title="Paid on 3 May">
        Paid
      </Status>,
    );

    expect(node).not.toContain("title=");
    expect(explicit).toContain('title="Paid on 3 May"');
  });
});
