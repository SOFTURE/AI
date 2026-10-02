// Identity ID-1: a module package ships a server action, a route handler and a server component page
// from node_modules (a packed copy, as a registry install gives), and each reads the config the app
// registered in softure.config.ts (docs/02-module-standard.md §8).
import { expect, test } from "@playwright/test";
import { nextActionsMessages } from "@softure-ai/next-actions";

const copy = nextActionsMessages.en;
const PAGE_PATH = "/spike/next-actions";
const API_PATH = "/api/spike/next-actions";
const REGISTERED_MODULE_IDS = ["guestbook", "security", "next-actions"];
// What softure.config.ts registers; the server and the tests share the environment.
const REGISTERED_APP_ORIGIN = process.env.APP_ORIGIN ?? "http://localhost:3000";

async function submitEcho(page: import("@playwright/test").Page, text: string): Promise<unknown> {
  await page.goto(PAGE_PATH);
  await expect(page.getByRole("heading", { name: copy.title })).toBeVisible();
  await page.getByLabel(copy.inputLabel).fill(text);
  await page.getByRole("button", { name: copy.submit }).click();
  const output = await page.getByTestId("echo").textContent();
  return JSON.parse((output ?? "").slice(`${copy.result}: `.length));
}

test("the package's server action runs from a client form and reads the registered config", async ({ page }) => {
  const echo = await submitEcho(page, "from the client");
  expect(echo).toEqual({
    text: "from the client",
    tag: "page",
    appOrigin: REGISTERED_APP_ORIGIN,
    moduleIds: REGISTERED_MODULE_IDS,
  });
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the same form posts to the package's action as a plain HTML form", async ({ page }) => {
    const echo = await submitEcho(page, "no script");
    expect(echo).toMatchObject({ text: "no script", tag: "page", moduleIds: REGISTERED_MODULE_IDS });
  });
});

test("the package's route handlers answer GET and POST with the registered config", async ({ request }) => {
  const get = await request.get(API_PATH);
  expect(get.status()).toBe(200);
  expect(await get.json()).toMatchObject({ text: "", tag: "route", moduleIds: REGISTERED_MODULE_IDS });

  const post = await request.post(API_PATH, { data: { text: "posted" } });
  expect(post.status()).toBe(200);
  expect(await post.json()).toMatchObject({ text: "posted", tag: "route", moduleIds: REGISTERED_MODULE_IDS });
});

/** A JavaScript-free post of the page's form, as the browser sends it, with a chosen bound tag. */
async function postEchoForm(
  request: import("@playwright/test").APIRequestContext,
  options: { readonly origin: string; readonly host: string; readonly boundTag: string },
) {
  const html = await (await request.get(PAGE_PATH)).text();
  const actionId = /&quot;id&quot;:&quot;([0-9a-f]+)&quot;/.exec(html)?.[1];
  // useActionState's form state key: without it the server runs the action but renders no result.
  const actionKey = /name="\$ACTION_KEY" value="([^"]+)"/.exec(html)?.[1];
  expect(actionId).toBeDefined();
  expect(actionKey).toBeDefined();
  return request.post(PAGE_PATH, {
    headers: { origin: options.origin, "x-forwarded-host": options.host },
    multipart: {
      "$ACTION_REF_1": "",
      "$ACTION_1:0": JSON.stringify({ id: actionId, bound: "$@1" }),
      "$ACTION_1:1": JSON.stringify([options.boundTag, null]),
      "$ACTION_KEY": actionKey ?? "",
      text: "posted",
    },
  });
}

/** The echo the page renders after a JavaScript-free post, or null when there is none. */
function readEcho(html: string): unknown {
  const match = /data-testid="echo">.*?<!-- -->(\{.*?\})<\/output>/.exec(html);
  return match?.[1] === undefined ? null : JSON.parse(match[1].replaceAll("&quot;", '"'));
}

test("a bound argument comes back as the client sends it, so modules never trust one", async ({ request, baseURL }) => {
  const host = new URL(baseURL ?? "").host;
  const response = await postEchoForm(request, { origin: `http://${host}`, host, boundTag: "tampered" });
  expect(response.status()).toBe(200);
  expect(readEcho(await response.text())).toMatchObject({ text: "posted", tag: "tampered" });
});

test("a server action request from a foreign origin is refused", async ({ request, baseURL }) => {
  const host = new URL(baseURL ?? "").host;
  const sameOrigin = await postEchoForm(request, { origin: `http://${host}`, host, boundTag: "page" });
  expect(sameOrigin.status()).toBe(200);
  expect(readEcho(await sameOrigin.text())).toMatchObject({ text: "posted", tag: "page" });

  const foreign = await postEchoForm(request, { origin: "https://attacker.example", host, boundTag: "page" });
  expect(foreign.status()).toBe(500);
  expect(readEcho(await foreign.text())).toBeNull();
});
