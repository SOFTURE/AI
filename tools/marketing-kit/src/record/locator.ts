import type { Locator, Page } from "playwright";

import type { LocatorDescriptor, TextMatch } from "../config/actions-schema.js";

/**
 * A locator descriptor from `marketing.json` as a Playwright locator: the beats' actions and the screenshots'
 * steps and crops find elements the same way.
 */

/** The part of a page that builds locators. */
export type LocatorSource = Pick<Page, "getByRole" | "getByText" | "getByLabel" | "getByTestId" | "locator">;

function toMatcher(match: TextMatch): string | RegExp {
  return typeof match === "string" ? match : new RegExp(match.regex, match.flags);
}

export function getLocator(page: LocatorSource, descriptor: LocatorDescriptor): Locator {
  const locator = buildLocator(page, descriptor);
  return descriptor.nth === null ? locator : locator.nth(descriptor.nth);
}

function buildLocator(page: LocatorSource, descriptor: LocatorDescriptor): Locator {
  switch (descriptor.kind) {
    case "role":
      return descriptor.name === null
        ? page.getByRole(descriptor.role)
        : page.getByRole(descriptor.role, { name: toMatcher(descriptor.name), ...(descriptor.exact ? { exact: true } : {}) });
    case "text":
      return page.getByText(toMatcher(descriptor.text), descriptor.exact ? { exact: true } : undefined);
    case "label":
      return page.getByLabel(toMatcher(descriptor.label), descriptor.exact ? { exact: true } : undefined);
    case "testId":
      return page.getByTestId(descriptor.testId);
    case "css":
      return descriptor.hasText === null ? page.locator(descriptor.css) : page.locator(descriptor.css, { hasText: toMatcher(descriptor.hasText) });
  }
}
