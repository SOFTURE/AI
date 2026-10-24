import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PALETTE_COLORS } from "../../src/notion/palette.js";

import { Alert, AlertDescription, AlertTitle } from "../../src/ui/alert.js";

describe("Alert", () => {
  it.each(PALETTE_COLORS)("is a borderless %s callout on the palette's background", (color) => {
    const html = renderToStaticMarkup(
      <Alert variant={color}>
        <AlertTitle>Deadline</AlertTitle>
        <AlertDescription>A report to send by Friday.</AlertDescription>
      </Alert>,
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain(`border-transparent bg-${color}-bg text-foreground [&amp;&gt;svg]:text-${color}`);
  });
});
