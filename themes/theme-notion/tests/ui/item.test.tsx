import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Item, ItemGroup } from "../../src/ui/item.js";

describe("Item", () => {
  it("renders as a list item inside an ItemGroup", () => {
    const html = renderToStaticMarkup(
      <ItemGroup>
        <Item>First</Item>
        <Item>Second</Item>
      </ItemGroup>,
    );

    expect(html).toContain('role="list"');
    expect(html.match(/role="listitem"/g)).toHaveLength(2);
  });

  it("has no role outside an ItemGroup", () => {
    const html = renderToStaticMarkup(<Item>Alone</Item>);

    expect(html).not.toContain("role=");
  });

  it("keeps the child's own role when rendered asChild inside a group", () => {
    const html = renderToStaticMarkup(
      <ItemGroup>
        <Item asChild>
          <a href="/a">Link</a>
        </Item>
      </ItemGroup>,
    );

    expect(html).toContain('<a href="/a" data-slot="item"');
    expect(html).not.toContain('role="listitem"');
  });

  it("lets the caller's role win", () => {
    const html = renderToStaticMarkup(
      <ItemGroup>
        <Item role="option">Option</Item>
      </ItemGroup>,
    );

    expect(html).toContain('role="option"');
    expect(html).not.toContain('role="listitem"');
  });
});
