import { expect, test } from "@playwright/test";
import { uiMessages } from "@softure-ai/ui";

const copy = uiMessages.en.themeSwitch;

test.use({ colorScheme: "light" });

test("the theme switch applies dark at once, keeps it after a reload and returns to system", async ({ page }) => {
  await page.goto("/");
  const themeSwitch = page.getByRole("group", { name: copy.legend });
  const html = page.locator("html");
  await expect(html).not.toHaveAttribute("data-theme");
  const lightBackground = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);

  // The radios are visually hidden; people click their labels.
  await themeSwitch.getByText(copy.dark, { exact: true }).click();
  await expect(html).toHaveAttribute("data-theme", "dark");
  const darkBackground = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(darkBackground).not.toBe(lightBackground);

  await page.reload();
  await expect(html).toHaveAttribute("data-theme", "dark");
  await expect(themeSwitch.getByRole("radio", { name: copy.dark })).toBeChecked();

  await themeSwitch.getByText(copy.system, { exact: true }).click();
  await expect(html).not.toHaveAttribute("data-theme");
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(lightBackground);
});
