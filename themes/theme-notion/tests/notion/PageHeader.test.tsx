import { Map } from "lucide-react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PageHeader } from "../../src/notion/PageHeader.js";

describe("PageHeader", () => {
  it("renders the crumbs, the icon box and the page title as the one h1", () => {
    const html = renderToStaticMarkup(
      <PageHeader
        title="Projects"
        icon={<Map />}
        description="Everything in progress"
        crumbs={[{ label: "Workspace", href: "/" }, { label: "Projects" }]}
        actions={<button type="button">Show</button>}
      />,
    );

    expect(html).toContain('<a data-slot="breadcrumb-link"');
    expect(html).toContain('href="/"');
    expect(html).toContain('aria-current="page"');
    expect(html.match(/<h1 /g)).toHaveLength(1);
    expect(html).toContain('<h1 class="text-page-title text-balance">Projects</h1>');
    expect(html).toContain('<p class="mt-1 text-body text-muted-foreground">Everything in progress</p>');
    expect(html).toContain("rounded-xl bg-secondary");
  });

  it("puts what it holds right under the title, before the description", () => {
    expect(renderToStaticMarkup(<PageHeader title="Tasks" description="Open tasks"><section>filters</section></PageHeader>)).toBe(
      '<header data-slot="page-header" class="flex flex-col"><h1 class="text-page-title text-balance">Tasks</h1><section>filters</section><p class="mt-1 text-body text-muted-foreground">Open tasks</p></header>',
    );
  });

  it("leaves out the breadcrumb, icon, description and actions it is not given", () => {
    expect(renderToStaticMarkup(<PageHeader title="Notes" />)).toBe(
      '<header data-slot="page-header" class="flex flex-col"><h1 class="text-page-title text-balance">Notes</h1></header>',
    );
  });
});
