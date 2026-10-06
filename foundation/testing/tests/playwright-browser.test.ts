import { createServer, type IncomingHttpHeaders, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { chromium, type Browser, type Page } from "@playwright/test";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  chooseOption,
  expectFieldAbsent,
  expectFieldPresent,
  expectPageStatus,
  followLink,
  listRow,
  logIn,
  openPageAsNewClient,
  readHref,
  readSelectedValue,
  registerAccount,
  selectField,
  submitLogin,
  type AuthFormCopy,
} from "@softure-ai/testing/playwright";
import { CHROMIUM_PATH, hasChromium } from "./chromium.js";

// A tiny app with the markup the helpers drive: auth forms answered by a POST, the ui select, links
// and a page that answers 404. Its pages are plain HTML, so the tests need no build.

const COPY: AuthFormCopy = {
  fields: { email: "Email", password: "Password", consent: "I accept the terms." },
  register: { submit: "Create account" },
  login: { submit: "Log in" },
};
const PASSWORD = "correct horse battery";

function renderAuthForm(kind: "register" | "login"): string {
  const consent = kind === "register" ? `<label><input type="checkbox" name="consent" required> ${COPY.fields.consent}</label>` : "";
  const submit = kind === "register" ? COPY.register.submit : COPY.login.submit;
  return `<main><form id="form">
    <label for="email">${COPY.fields.email}</label><input id="email" name="email" type="email">
    <label for="password">${COPY.fields.password}</label><input id="password" name="password" type="password">
    ${consent}
    <button>${submit}</button>
    <p role="status" id="status"></p>
  </form>
  <script>
    document.getElementById("form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const response = await fetch("/api/${kind}", { method: "POST", body: new FormData(event.target) });
      if (response.ok) location.assign("/account");
      else document.getElementById("status").textContent = "refused";
    });
  </script></main>`;
}

const SELECT_PAGE = `<main><form>
  <div>
    <input type="hidden" name="currency" value="PLN">
    <button type="button" role="combobox" aria-expanded="false" aria-controls="list">PLN</button>
    <ul role="listbox" id="list" hidden>
      <li role="option" data-value="PLN">Polish zloty</li>
      <li role="option" data-value="EUR">Euro</li>
    </ul>
  </div>
  <ul><li>Euro</li><li>Dollar</li></ul>
</form>
<script>
  const trigger = document.querySelector('[role="combobox"]');
  const list = document.getElementById("list");
  const input = document.querySelector('input[name="currency"]');
  trigger.addEventListener("click", () => { list.hidden = false; trigger.setAttribute("aria-expanded", "true"); });
  for (const option of list.querySelectorAll('[role="option"]')) {
    option.addEventListener("click", () => { input.value = option.dataset.value; trigger.textContent = option.dataset.value; list.hidden = true; });
  }
</script></main>`;

let server: Server;
let baseURL: string;
let browser: Browser;
let lastHeaders: IncomingHttpHeaders = {};
let registered: string[] = [];

function sendHtml(response: import("node:http").ServerResponse, status: number, body: string): void {
  response.writeHead(status, { "content-type": "text/html; charset=utf-8" });
  response.end(`<!doctype html><html><body>${body}</body></html>`);
}

async function readBody(request: import("node:http").IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

beforeAll(async () => {
  server = createServer((request, response) => {
    void (async () => {
      lastHeaders = request.headers;
      const path = new URL(request.url ?? "/", "http://localhost").pathname;
      if (request.method === "POST") {
        const body = await readBody(request);
        const email = /name="email"\r\n\r\n([^\r]*)/.exec(body)?.[1] ?? "";
        const isKnown = path === "/api/register" ? (registered.push(email), true) : registered.includes(email) && body.includes(PASSWORD);
        response.writeHead(isKnown ? 200 : 401).end();
        return;
      }
      if (path === "/register") return sendHtml(response, 200, renderAuthForm("register"));
      if (path === "/login") return sendHtml(response, 200, renderAuthForm("login"));
      if (path === "/account") return sendHtml(response, 200, "<h1>Account</h1>");
      if (path === "/select") return sendHtml(response, 200, SELECT_PAGE);
      if (path === "/links") {
        return sendHtml(response, 200, `<a href="/account">Account</a><a href="https://app.example.com/register?ref=1">Register</a><a>Nowhere</a>`);
      }
      if (path === "/register-target") return sendHtml(response, 200, "target");
      return sendHtml(response, 404, "<h1>Not found</h1>");
    })();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseURL = `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`;
  if (hasChromium) browser = await chromium.launch({ executablePath: CHROMIUM_PATH });
});

afterAll(async () => {
  await browser?.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

afterEach(() => {
  registered = [];
});

async function openPage(): Promise<Page> {
  const context = await browser.newContext({ baseURL });
  return context.newPage();
}

describe.skipIf(!hasChromium)("Playwright helpers in a browser", () => {
  it("registers through the form and lands on the account page", async () => {
    const page = await openPage();
    await registerAccount(page, { copy: COPY, email: "ada@example.com", password: PASSWORD });
    expect(new URL(page.url()).pathname).toBe("/account");
    expect(registered).toEqual(["ada@example.com"]);
    await page.context().close();
  });

  it("logs in through the form, and submitLogin leaves a refusal on the page", async () => {
    registered = ["ada@example.com"];
    const page = await openPage();
    await logIn(page, { copy: COPY, email: "ada@example.com", password: PASSWORD });
    expect(new URL(page.url()).pathname).toBe("/account");

    await page.goto("/login");
    await submitLogin(page, { copy: COPY, email: "ada@example.com", password: "wrong password" });
    expect(new URL(page.url()).pathname).toBe("/login");
    await page.context().close();
  });

  it("fails logIn when the login does not land, unless the landing check is off", async () => {
    const page = await openPage();
    const options = { copy: COPY, email: "nobody@example.com", password: PASSWORD };
    await expect(logIn(page, { ...options, landingPath: "/account" }).then(() => "landed", () => "failed")).resolves.toBe("failed");
    await logIn(page, { ...options, landingPath: null });
    expect(new URL(page.url()).pathname).toBe("/login");
    await page.context().close();
  });

  it("opens a page as a new client with its own address and keeps the caller's headers", async () => {
    const first = await openPageAsNewClient(browser, { baseURL, extraHTTPHeaders: { "x-test": "1" } });
    await first.goto("/account");
    const firstAddress = lastHeaders["cf-connecting-ip"];
    expect(firstAddress).toMatch(/^198\.1[89]\.\d+\.\d+$/);
    expect(lastHeaders["x-test"]).toBe("1");
    const second = await openPageAsNewClient(browser, { baseURL });
    await second.goto("/account");
    expect(lastHeaders["cf-connecting-ip"]).toMatch(/^198\.1[89]\.\d+\.\d+$/);
    await first.context().close();
    await second.context().close();
  });

  it("chooses an option of the ui select by value and reads it back", async () => {
    const page = await openPage();
    await page.goto("/select");
    const field = selectField(page, "currency");
    expect(await readSelectedValue(field)).toBe("PLN");
    await chooseOption(field, "EUR");
    expect(await readSelectedValue(field)).toBe("EUR");
    await expect(chooseOption(field, "USD").then(() => "chosen", (error: Error) => error.message)).resolves.toContain('the select has no option "USD"');
    await page.context().close();
  });

  it("finds a list row without matching a select option of the same text", async () => {
    const page = await openPage();
    await page.goto("/select");
    await page.getByRole("combobox").click();
    expect(await page.locator("li").filter({ hasText: "Euro" }).count()).toBe(2);
    expect(await listRow(page, "Euro").count()).toBe(1);
    await page.context().close();
  });

  it("clicks a link that stays on the host and refuses one that leaves it", async () => {
    const page = await openPage();
    await page.goto("/links");
    await followLink(page, page.getByRole("link", { name: "Account" }), { expectedOrigin: null });
    expect(new URL(page.url()).pathname).toBe("/account");

    await page.goto("/links");
    const leaving = followLink(page, page.getByRole("link", { name: "Register" }), { expectedOrigin: null });
    await expect(leaving.then(() => "followed", (error: Error) => error.message)).resolves.toContain("leaves the host under test");
    await page.context().close();
  });

  it("follows a production link on the host under test with the page as referer", async () => {
    const page = await openPage();
    await page.goto("/links");
    await followLink(page, page.getByRole("link", { name: "Register" }), { expectedOrigin: "https://app.example.com" });
    expect(new URL(page.url()).pathname + new URL(page.url()).search).toBe("/register?ref=1");
    expect(lastHeaders.referer).toBe(`${baseURL}/links`);

    await page.goto("/links");
    const wrong = followLink(page, page.getByRole("link", { name: "Register" }), { expectedOrigin: "https://other.example.com" });
    await expect(wrong.then(() => "followed", (error: Error) => error.message)).resolves.toContain("must carry the production origin");
    await page.context().close();
  });

  it("reads an href and names the link that has none", async () => {
    const page = await openPage();
    await page.goto("/links");
    expect(await readHref(page.getByRole("link", { name: "Account" }))).toBe("/account");
    await expect(readHref(page.locator("a:not([href])"))).rejects.toThrow(/has no href/);
    await page.context().close();
  });

  it("asserts page statuses and form fields with messages that say why", async () => {
    const page = await openPage();
    await expectPageStatus(page, "/account", 200);
    await expectPageStatus(page, "/hidden", 404);
    await expect(expectPageStatus(page, "/hidden", 200)).rejects.toThrow(/status of \/hidden/);

    await page.goto("/register");
    await expectFieldPresent(page, "consent", "registration asks for consent");
    await expectFieldAbsent(page, "role", "a visitor cannot pick a role");
    await expect(expectFieldAbsent(page, "email", "email must be gone")).rejects.toThrow(/email must be gone/);
    await page.context().close();
  });
});
