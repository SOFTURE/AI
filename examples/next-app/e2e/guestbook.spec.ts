import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { uiMessages } from "@softure-ai/ui";
import { en } from "../messages/en.ts";
import { getErrorMessage } from "../messages/index.ts";
import { deleteEntries, openTestDatabase } from "./database.ts";

const copy = en.guestbook;

test("Escape closes the entry modal and gives focus back to its button", async ({ page }) => {
  await page.goto("/");
  const opener = page.getByRole("button", { name: copy.add });
  await opener.click();
  const dialog = page.getByRole("dialog", { name: copy.modalTitle });
  await expect(dialog).toBeVisible();
  await expect(dialog).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
});

test("an entry saved in the modal is stored by the server action and listed", async ({ page }) => {
  const message = `e2e entry ${randomUUID()}`;
  const database = await openTestDatabase();
  try {
    await page.goto("/");
    await page.getByRole("button", { name: copy.add }).click();
    const dialog = page.getByRole("dialog", { name: copy.modalTitle });
    await dialog.getByRole("textbox", { name: copy.messageLabel }).fill(message);
    await dialog.getByRole("button", { name: copy.submit }).click();

    // The toast lives for a few seconds, so it is checked first.
    await expect(page.getByRole("status")).toHaveText(copy.saved);
    await expect(dialog).toBeHidden();
    await expect(page.getByTestId("guestbook-entries").getByText(message, { exact: true })).toBeVisible();
  } finally {
    await deleteEntries(database, message);
    await database.close();
  }
});

test("Cancel closes the modal without saving", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: copy.add }).click();
  const dialog = page.getByRole("dialog", { name: copy.modalTitle });
  await dialog.getByRole("button", { name: uiMessages.en.modal.cancel }).click();
  await expect(dialog).toBeHidden();
});

test("a blank entry comes back from the server action as a field error and stays open", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: copy.add }).click();
  const dialog = page.getByRole("dialog", { name: copy.modalTitle });
  const field = dialog.getByRole("textbox", { name: copy.messageLabel });
  // Spaces pass the browser's `required` check; the server trims them and refuses the entry.
  await field.fill("   ");
  await dialog.getByRole("button", { name: copy.submit }).click();

  await expect(field).toHaveAttribute("aria-invalid", "true");
  await expect(field).toHaveAccessibleDescription(getErrorMessage(en, "guestbook.message_invalid"));
  await expect(dialog).toBeVisible();
});
