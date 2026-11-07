import { describe, expect, it } from "vitest";

import { assertLocalReferences } from "./html.js";

describe("assertLocalReferences", () => {
  it("returns a composition that names only local files", () => {
    const html = '<svg xmlns="http://www.w3.org/2000/svg"></svg><img src="assets/logo.svg" /><style>@import "assets/a.css";</style>';
    expect(assertLocalReferences(html)).toBe(html);
  });

  it("refuses a remote stylesheet import", () => {
    expect(() => assertLocalReferences('<style>@import url("https://fonts.googleapis.com/css2?family=Inter");</style>')).toThrow(
      "The composition names a remote file (https://fonts.googleapis.com/css2?family=Inter); every asset must be a local file in the build folder.",
    );
  });

  it("checks a long run of spaces after @import in linear time", () => {
    const html = `@import${" ".repeat(200_000)}x`;
    const started = performance.now();
    expect(assertLocalReferences(html)).toBe(html);
    expect(performance.now() - started).toBeLessThan(500);
  });
});
