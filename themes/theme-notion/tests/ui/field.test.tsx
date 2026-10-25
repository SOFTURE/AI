import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FieldTitle } from "../../src/ui/field.js";

describe("FieldTitle", () => {
  it("renders the title at 14 px in medium weight, without the label's peer and group markers", () => {
    const html = renderToStaticMarkup(<FieldTitle>Notifications</FieldTitle>);
    const classes = (/class="([^"]*)"/.exec(html)?.[1] ?? "").split(" ");

    expect(classes).toEqual(expect.arrayContaining(["flex", "w-fit", "items-center", "gap-2", "text-sm", "leading-snug", "font-medium"]));
    expect(classes).not.toContain("peer/field-label");
    expect(classes).not.toContain("group/field-label");
  });
});
