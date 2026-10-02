import { expect, test } from "@playwright/test";

test("the page lists the ledger and the guestbook migration applied by softure migrate", async ({ page }) => {
  await page.goto("/");
  const migrations = page.getByTestId("applied-migrations").getByRole("listitem");
  await expect(migrations).toHaveText(["guestbook 1 create_entries (applied)", "softure 1 ledger (applied)"]);
});
