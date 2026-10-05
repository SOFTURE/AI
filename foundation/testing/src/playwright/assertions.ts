import { expect, type Page } from "@playwright/test";

// Assertions whose failure says what was on the screen and why it matters: in a black-box test,
// "expected 1 to be 0" says nothing.

/**
 * A form field that must not be in the form at all. Not `toBeHidden()`: that also passes for a field
 * hidden by style, which still goes into the form data on submit.
 */
export async function expectFieldAbsent(page: Page, name: string, because: string): Promise<void> {
  await expect(page.locator(`[name="${name}"]`), because).toHaveCount(0);
}

/** A form field that must be in the form exactly once. */
export async function expectFieldPresent(page: Page, name: string, because: string): Promise<void> {
  await expect(page.locator(`[name="${name}"]`), because).toHaveCount(1);
}

/** Opens `path` and checks the status of the document response (a hidden page answers 404). */
export async function expectPageStatus(page: Page, path: string, status: number): Promise<void> {
  const response = await page.goto(path);
  expect(response, `no response for ${path}`).not.toBeNull();
  expect(response?.status(), `status of ${path}`).toBe(status);
}
