import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PageLayout } from "../../src/notion/PageLayout.js";

describe("PageLayout", () => {
  it("renders the page header, then the sections, in one full-width grid", () => {
    expect(
      renderToStaticMarkup(
        <PageLayout header={{ title: "Projects" }}>
          <section>first</section>
          <section>second</section>
        </PageLayout>,
      ),
    ).toBe(
      '<div data-slot="page-layout" data-width="full" class="grid w-full min-w-0 gap-4">' +
        '<header data-slot="page-header" class="flex flex-col"><h1 class="text-page-title text-balance">Projects</h1></header>' +
        "<section>first</section><section>second</section></div>",
    );
  });

  it("caps a reading page at the content width and centres it", () => {
    const html = renderToStaticMarkup(<PageLayout header={{ title: "Guide" }} width="content">text</PageLayout>);

    expect(html).toContain('<div data-slot="page-layout" data-width="content" class="grid w-full min-w-0 gap-4 mx-auto max-w-3xl">');
  });

  it("passes the header's props through and merges the app's class names", () => {
    const html = renderToStaticMarkup(
      <PageLayout
        className="pb-8"
        header={{
          title: "Tasks",
          crumbs: [{ label: "Workspace", href: "/" }, { label: "Tasks" }],
          actions: <button type="button">New</button>,
          className: "mb-2",
        }}
      />,
    );

    expect(html).toContain('class="grid w-full min-w-0 gap-4 pb-8"');
    expect(html).toContain('<header data-slot="page-header" class="flex flex-col mb-2">');
    expect(html).toContain('href="/"');
    expect(html).toContain('<button type="button">New</button>');
  });

  it("renders only the header when the page has no sections", () => {
    const html = renderToStaticMarkup(<PageLayout header={{ title: "Empty" }} />);

    expect(html).toMatch(/^<div data-slot="page-layout"[^>]*><header [^>]*><h1 [^>]*>Empty<\/h1><\/header><\/div>$/);
  });
});
