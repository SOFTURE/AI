// @softure-ai/analytics on the built app: the `?z=` tag stays on the address bar from a tagged page
// to the next one (a full page load and a client-side navigation, with or without the router's
// Next-Url header) and through the auth guard's redirect to login, and reaches the register action,
// whose onRegistered hook hands it over (the account page shows it) and whose redirect keeps it,
// with or without JavaScript; the login and register pages' own redirect of a signed-in visitor
// keeps it too. No cookie carries it.
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

/** Fills the register form; the caller submits it. */
async function fillRegisterForm(page: Page, email: string): Promise<void> {
  await page.getByLabel(copy.fields.email, { exact: true }).fill(email);
  await page.getByLabel(copy.fields.password, { exact: true }).fill(PASSWORD);
  await page.getByLabel(copy.fields.consent).check();
}

/** From the login page to the register page through its link, then the form. */
async function registerFromLogin(page: Page, email: string): Promise<void> {
  await page.getByRole("link", { name: copy.login.registerLink }).click();
  await fillRegisterForm(page, email);
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

/**
 * Clicks a next/link once React has hydrated it, and checks the page was not reloaded: a click
 * before hydration is a plain page load, which the proxy tags without the keeper's help.
 */
async function clickClientLink(page: Page, name: string): Promise<void> {
  const link = page.getByRole("link", { name });
  await expect
    .poll(() => link.evaluate((element) => Object.keys(element).some((key) => key.startsWith("__reactProps"))))
    .toBe(true);
  await page.evaluate(() => {
    Object.assign(window, { e2eSamePage: true });
  });
  const before = new URL(page.url()).pathname;
  await link.click();
  await page.waitForURL((url) => url.pathname !== before);
  expect(await page.evaluate(() => "e2eSamePage" in window)).toBe(true);
}

test("a client navigation without Next-Url keeps the tag", async ({ page }) => {
  // The proxy cannot recognise such a router request; <ChannelKeeper /> in the layout puts the tag back.
  await page.route("**/*", (route) => {
    const headers = route.request().headers();
    if (!("next-url" in headers)) return route.continue();
    return route.continue({ headers: Object.fromEntries(Object.entries(headers).filter(([name]) => name !== "next-url")) });
  });
  await page.goto("/login");
  await registerFromLogin(page, newEmail());
  await page.goto("/account?z=spring-promo");
  await clickClientLink(page, en.account.privacy);
  await expect(page).toHaveURL("/account/privacy?z=spring-promo");
});

test("the tag comes back after the page drops it with replaceState", async ({ page }) => {
  // A client navigation first: the router and the keeper are running before the page drops the tag.
  await page.goto("/login");
  await registerFromLogin(page, newEmail());
  await page.goto("/account?z=spring-promo");
  await clickClientLink(page, en.account.privacy);
  await expect(page).toHaveURL("/account/privacy?z=spring-promo");
  await page.evaluate(() => {
    window.history.replaceState(null, "", "/account/privacy");
  });
  await expect(page).toHaveURL("/account/privacy?z=spring-promo");
});

test("the sign-up action answers with the tagged account page", async ({ page }) => {
  await page.goto("/register?z=spring-promo");
  await fillRegisterForm(page, newEmail());
  const answer = page.waitForResponse((response) => response.request().method() === "POST" && "x-action-redirect" in response.headers());
  await page.getByRole("button", { name: copy.register.submit }).click();
  // `<url>;<push|replace>`: Next renders this URL for the browser, so the account page's own server
  // render already reads the tag; <ChannelKeeper /> has nothing to put back.
  const redirect = (await answer).headers()["x-action-redirect"] ?? "";
  expect(redirect.slice(0, redirect.lastIndexOf(";"))).toBe("/account?z=spring-promo");
  await expect(page).toHaveURL("/account?z=spring-promo");
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("sign-up lands on the tagged account page", async ({ page }) => {
    await page.goto("/login?z=spring-promo");
    // The form posts as a plain HTML form; the action answers a 303 to the tagged page itself,
    // rather than leaving the proxy to re-tag the follow-up request from its Referer.
    const answer = page.waitForResponse((response) => response.request().method() === "POST" && response.status() === 303);
    await registerFromLogin(page, newEmail());
    expect((await answer).headers()["location"]).toBe("/account?z=spring-promo");
    await expect(page).toHaveURL("/account?z=spring-promo");
    await expect(page.getByTestId("account-signup-channel")).toHaveText(`${en.account.signupChannel} spring-promo`);
  });
});

test.describe("a signed-in visitor", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/register");
    await fillRegisterForm(page, newEmail());
    await page.getByRole("button", { name: copy.register.submit }).click();
    await expect(page.getByTestId("account-email")).toBeVisible();
  });

  /** The redirect the page answered with while it rendered (the proxy let the tagged URL through). */
  async function readPageRedirect(page: Page, path: string): Promise<string | undefined> {
    const response = await page.goto(path);
    const redirect = await response?.request().redirectedFrom()?.response();
    expect(redirect?.status()).toBe(307);
    return redirect?.headers()["location"];
  }

  test("the login page sends them on with its own tag", async ({ page }) => {
    // page.goto sends no Referer, so the follow-up request has nothing the proxy could re-tag from.
    expect(await readPageRedirect(page, "/login?z=spring-promo")).toBe("/account?z=spring-promo");
    await expect(page).toHaveURL("/account?z=spring-promo");
  });

  test("the register page sends them to next with its own tag", async ({ page }) => {
    expect(await readPageRedirect(page, "/register?next=%2Faccount%2Fprivacy&z=spring-promo")).toBe("/account/privacy?z=spring-promo");
    await expect(page).toHaveURL("/account/privacy?z=spring-promo");
  });

  test("a next path with its own tag keeps it", async ({ page }) => {
    expect(await readPageRedirect(page, `/login?next=${encodeURIComponent("/account?z=mail")}&z=spring-promo`)).toBe("/account?z=mail");
  });
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
