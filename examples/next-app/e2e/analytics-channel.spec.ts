// @softure-ai/analytics on the built app: the `?z=` tag stays on the address bar from a tagged page
// to the next one (a full page load and a client-side navigation) and through the auth guard's
// redirect to login, and reaches the register action, whose onRegistered hook hands it over (the
// account page shows it). No cookie carries it.
import { randomInt, randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { authMessages, users } from "@softure-ai/auth";
import { inArray } from "drizzle-orm";
import { en } from "../messages/en.ts";
import { openTestDatabase } from "./database.ts";

const copy = authMessages.en;
const PASSWORD = "correct horse battery";
const createdEmails: string[] = [];

function newEmail(): string {
  const email = `e2e-channel-${randomUUID()}@example.com`;
  createdEmails.push(email);
  return email;
}

test.beforeEach(({ context }) =>
  context.setExtraHTTPHeaders({ "cf-connecting-ip": `198.${String(18 + randomInt(2))}.${String(randomInt(256))}.${String(randomInt(1, 255))}` }),
);

test.afterAll(async () => {
  if (createdEmails.length === 0) return;
  const database = await openTestDatabase();
  try {
    await database.db.delete(users).where(inArray(users.email, createdEmails));
  } finally {
    await database.close();
  }
});

/** From the login page to the register page through its link, then the form. */
async function registerFromLogin(page: Page, email: string): Promise<void> {
  await page.getByRole("link", { name: copy.login.registerLink }).click();
  await page.getByLabel(copy.fields.email, { exact: true }).fill(email);
  await page.getByLabel(copy.fields.password, { exact: true }).fill(PASSWORD);
  await page.getByLabel(copy.fields.consent).check();
  await page.getByRole("button", { name: copy.register.submit }).click();
  await expect(page.getByTestId("account-email")).toHaveText(email);
}

test("a tagged visit reaches sign-up with its channel, without a cookie", async ({ page, context }) => {
  await page.goto("/login?z=spring-promo");
  await registerFromLogin(page, newEmail());
  await expect(page.getByTestId("account-signup-channel")).toHaveText(`${en.account.signupChannel} spring-promo`);
  const cookies = await context.cookies();
  expect(cookies.filter((cookie) => cookie.value.includes("spring-promo"))).toEqual([]);
});

test("a full page load and a client-side navigation from a tagged page keep the tag", async ({ page }) => {
  await page.goto("/login?z=spring-promo");
  await page.getByRole("link", { name: copy.login.registerLink }).click();
  await expect(page).toHaveURL("/register?z=spring-promo");

  await page.goto("/login");
  await registerFromLogin(page, newEmail());
  await page.goto("/account?z=spring-promo");
  // "Your data" is a next/link: the router's request is redirected like a page load.
  await page.getByRole("link", { name: en.account.privacy }).click();
  await expect(page).toHaveURL("/account/privacy?z=spring-promo");
});

test("the auth guard's redirect to login keeps the tag", async ({ page }) => {
  await page.goto("/account?z=ads");
  await expect(page).toHaveURL(`/login?next=${encodeURIComponent("/account?z=ads")}&z=ads`);
});

test("a tag on another origin's page is not taken", async ({ page }) => {
  await page.goto("/login", { referer: "https://elsewhere.example.com/?z=ads" });
  await expect(page).toHaveURL("/login");
});

test("an untagged or invalid visit signs up without a channel", async ({ page }) => {
  await page.goto("/login?z=Not%20Valid");
  await registerFromLogin(page, newEmail());
  await expect(page.getByTestId("account-signup-channel")).toHaveCount(0);
});
