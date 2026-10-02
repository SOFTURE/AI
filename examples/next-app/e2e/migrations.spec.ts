import { expect, test } from "@playwright/test";

test("the page lists the ledger and the module migrations applied by softure migrate", async ({ page }) => {
  await page.goto("/");
  const migrations = page.getByTestId("applied-migrations").getByRole("listitem");
  await expect(migrations).toHaveText([
    // Shipped inside the auth package: a packaged module's migrations apply too.
    "auth 1 create_users_and_sessions (applied)",
    "auth 2 create_user_roles (applied)",
    "auth 3 create_password_resets (applied)",
    "guestbook 1 create_entries (applied)",
    "security 1 create_rate_limits (applied)",
    "softure 1 ledger (applied)",
  ]);
});
