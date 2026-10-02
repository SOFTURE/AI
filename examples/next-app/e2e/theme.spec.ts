import { expect, test } from "@playwright/test";
import { DEFAULT_THEME, uiMessages } from "@softure-ai/ui";

const copy = uiMessages.en.themeSwitch;

/** `#rrggbb` as the `rgb(r, g, b)` that getComputedStyle reports. */
function toComputedRgb(hex: string): string {
  const [red, green, blue] = [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16));
  return `rgb(${String(red)}, ${String(green)}, ${String(blue)})`;
}

const LIGHT_BACKGROUND = toComputedRgb(DEFAULT_THEME.light["color-background"]);
const DARK_BACKGROUND = toComputedRgb(DEFAULT_THEME.dark["color-background"]);

test.use({ colorScheme: "light" });

test("the theme switch applies dark at once, keeps it after a reload and returns to system", async ({ page }) => {
  await page.goto("/");
  const themeSwitch = page.getByRole("group", { name: copy.legend });
  const html = page.locator("html");
  const body = page.locator("body");
  await expect(html).not.toHaveAttribute("data-theme");
  await expect(body).toHaveCSS("background-color", LIGHT_BACKGROUND);

  // The radios are visually hidden; people click their labels.
  await themeSwitch.getByText(copy.dark, { exact: true }).click();
  await expect(html).toHaveAttribute("data-theme", "dark");
  await expect(body).toHaveCSS("background-color", DARK_BACKGROUND);

  await page.reload();
  await expect(html).toHaveAttribute("data-theme", "dark");
  await expect(body).toHaveCSS("background-color", DARK_BACKGROUND);
  await expect(themeSwitch.getByRole("radio", { name: copy.dark })).toBeChecked();

  await themeSwitch.getByText(copy.system, { exact: true }).click();
  await expect(html).not.toHaveAttribute("data-theme");
  await expect(body).toHaveCSS("background-color", LIGHT_BACKGROUND);
});
