import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AppHeaderBar } from "../src/index.js";

function getInnerClass(html: string): string {
  const match = /<header[^>]*><div class="([^"]*)"/.exec(html);
  if (match?.[1] === undefined) throw new Error(`getInnerClass: no inner row in ${html}`);
  return match[1];
}

describe("AppHeaderBar inner row box sizing (#542)", () => {
  it("keeps its padding inside the full width without relying on the app's box-sizing reset", () => {
    const inner = getInnerClass(renderToStaticMarkup(<AppHeaderBar brand="App" actions={<p>text</p>} />));
    expect(inner.split(" ")).toEqual(expect.arrayContaining(["sft:w-full", "sft:px-4", "sft:box-border"]));
  });

  it("drops the default with unstyled and appends the app's own inner classes", () => {
    expect(getInnerClass(renderToStaticMarkup(<AppHeaderBar brand="App" unstyled classNames={{ inner: "row" }} />))).toBe("row");
    expect(getInnerClass(renderToStaticMarkup(<AppHeaderBar brand="App" classNames={{ inner: "row" }} />))).toContain("sft:box-border");
  });
});
