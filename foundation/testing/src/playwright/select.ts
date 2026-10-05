import { expect, type Locator, type Page } from "@playwright/test";

// The select drawn by `@softure-ai/ui` (`Select`): a `role="combobox"` button, a `role="listbox"`
// list whose `role="option"` items carry `data-value`, and a hidden input with the field `name` that
// goes into the form data. `locator.selectOption` works on a native `<select>` only, so this file is
// the one place that knows the markup. Fields are found by `name`, the contract with the server
// action, not by the label, which changes with the dictionary.

/** The select whose hidden input has `name`, inside `scope`. */
export function selectField(scope: Page | Locator, name: string): Locator {
  return scope.locator(`div:has(> input[type="hidden"][name="${name}"])`);
}

/** Picks an option the way a person does (open, click) and waits for the value, not for time. */
export async function chooseOption(field: Locator, value: string): Promise<void> {
  await field.getByRole("combobox").click();
  const option = field.locator(`[role="option"][data-value="${value}"]`);
  await expect(option, `the select has no option "${value}"`).toBeVisible();
  await option.click();
  await expect(field.locator('input[type="hidden"]')).toHaveValue(value);
}

/** The value the select sends with the form. */
export function readSelectedValue(field: Locator): Promise<string> {
  return field.locator('input[type="hidden"]').inputValue();
}

/**
 * A list row (`li`) with `text` that is not a select option: an open select renders `li` options that
 * can carry the same text, and a bare `li` filter would then match both.
 */
export function listRow(page: Page | Locator, text: string | RegExp): Locator {
  return page.locator('li:not([role="option"])').filter({ hasText: text });
}
