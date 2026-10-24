import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Breadcrumb, BreadcrumbEllipsis, notionMessages, Spinner } from "../src/index.js";

describe("built-in copy", () => {
  it("names the components in English by default", () => {
    expect(renderToStaticMarkup(<Breadcrumb />)).toContain(`aria-label="${notionMessages.en.breadcrumb.label}"`);
    expect(renderToStaticMarkup(<BreadcrumbEllipsis />)).toContain('<span class="sr-only">More</span>');
    expect(renderToStaticMarkup(<Spinner />)).toContain('aria-label="Loading"');
  });

  it("takes the app's own wording through props", () => {
    expect(renderToStaticMarkup(<Breadcrumb aria-label="Path" />)).toContain('aria-label="Path"');
    expect(renderToStaticMarkup(<BreadcrumbEllipsis label="Show all" />)).toContain('<span class="sr-only">Show all</span>');
    expect(renderToStaticMarkup(<Spinner aria-label="Saving" />)).toContain('aria-label="Saving"');
  });
});
