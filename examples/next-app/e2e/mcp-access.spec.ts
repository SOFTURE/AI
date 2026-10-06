// MCP access of @softure-ai/mcp-access on the built app: the token page at /account/mcp is for
// signed-in users; a user issues a token there, sees its setup once, and an MCP client calls the
// example's tools through POST /api/mcp with it. A read-only token gets no write tool, a revoked
// token gets 401, and the page's catalog names exactly the tools the server registers.
import { randomUUID } from "node:crypto";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { users } from "@softure-ai/auth";
import { formatMessage, getModule } from "@softure-ai/core";
import { mcpAccessMessages, type McpAccessOptions } from "@softure-ai/mcp-access";
import { openPageAsNewClient, randomClientAddress, uniqueEmail } from "@softure-ai/testing/playwright";
import { inArray } from "drizzle-orm";
import { en } from "../messages/en.ts";
import config from "../softure.config.ts";
import { createSignedInAccount } from "./accounts.ts";
import { deleteEntries, openTestDatabase } from "./database.ts";

const mcpCopy = mcpAccessMessages.en;
const PASSWORD = "correct horse battery";
const TOKEN_PATTERN = /sftmcp_[A-Za-z0-9_-]{43}/;
const CATALOG = (getModule(config, "mcp-access")?.options as McpAccessOptions).tools;
const createdEmails: string[] = [];
const createdEntries: string[] = [];

async function signInUser(page: Page): Promise<{ email: string; id: string }> {
  const email = uniqueEmail("e2e-mcp");
  createdEmails.push(email);
  const user = await createSignedInAccount(page, { email, password: PASSWORD });
  return { email, id: user.id };
}

/** Issues a token on the page and returns its plaintext, read from the Claude Code command. */
async function issueToken(page: Page, name: string, canWrite: boolean): Promise<string> {
  await page.getByRole("textbox", { name: mcpCopy.issue.name }).fill(name);
  if (canWrite) await page.getByRole("checkbox", { name: mcpCopy.issue.canWrite }).check();
  await page.getByRole("button", { name: mcpCopy.issue.submit }).click();
  await expect(page.getByText(formatMessage(mcpCopy.issued.title, { name }))).toBeVisible();
  const command = await page.getByText(/^claude mcp add --transport http --scope user softure-example /).textContent();
  const token = TOKEN_PATTERN.exec(command ?? "")?.[0];
  if (token === undefined) throw new Error(`issueToken: no token in ${String(command)}`);
  await page.getByRole("button", { name: mcpCopy.issued.done }).click();
  await expect(page.getByText(formatMessage(mcpCopy.issued.title, { name }))).toBeHidden();
  return token;
}

interface ToolAnswer {
  readonly status: number;
  readonly result?: { readonly tools?: { readonly name: string }[]; readonly content?: { readonly text: string }[]; readonly isError?: boolean };
  readonly error?: unknown;
}

/** One JSON-RPC call to the endpoint, as an MCP client sends it; the answer comes as JSON or one SSE event. */
async function callMcp(request: APIRequestContext, token: string | null, method: string, params: Record<string, unknown> = {}): Promise<ToolAnswer> {
  const response = await request.post("/api/mcp", {
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "cf-connecting-ip": randomClientAddress(),
      ...(token === null ? {} : { authorization: `Bearer ${token}` }),
    },
    data: { jsonrpc: "2.0", id: 1, method, params },
  });
  const body = await response.text();
  if (response.status() !== 200) return { status: response.status() };
  const data = body.startsWith("event:") ? body.split("\n").find((line) => line.startsWith("data: "))?.slice(6) : body;
  return { status: 200, ...(JSON.parse(data ?? "{}") as Omit<ToolAnswer, "status">) };
}

const toolNames = (answer: ToolAnswer) => answer.result?.tools?.map((tool) => tool.name);
const textOf = (answer: ToolAnswer): unknown => JSON.parse(answer.result?.content?.[0]?.text ?? "null");

test.afterAll(async () => {
  const database = await openTestDatabase();
  try {
    for (const message of createdEntries) await deleteEntries(database, message);
    // The tokens go with their accounts (ON DELETE CASCADE).
    if (createdEmails.length > 0) await database.db.delete(users).where(inArray(users.email, createdEmails));
  } finally {
    await database.close();
  }
});

test("the token page sends visitors without a session to the login page", async ({ browser }) => {
  const page = await openPageAsNewClient(browser);
  await page.goto("/account/mcp");
  await expect(page).toHaveURL(/\/login\?next=%2Faccount%2Fmcp$/);
});

test("a user issues a write token and an MCP client calls the tools with it, until it is revoked", async ({ browser, request }) => {
  const page = await openPageAsNewClient(browser);
  const user = await signInUser(page);
  await page.getByRole("link", { name: en.account.assistant }).click();
  await expect(page).toHaveURL("/account/mcp");
  await expect(page.getByRole("heading", { name: mcpCopy.page.title })).toBeVisible();
  for (const tool of CATALOG) await expect(page.getByText(tool.name, { exact: true })).toBeVisible();

  const token = await issueToken(page, "E2E laptop", true);
  await expect(page.getByText(token)).toHaveCount(0);

  const listed = await callMcp(request, token, "tools/list");
  expect(listed.status).toBe(200);
  expect(toolNames(listed)).toEqual(CATALOG.map((tool) => tool.name));
  expect(textOf(await callMcp(request, token, "tools/call", { name: "whoami", arguments: {} }))).toEqual({ userId: user.id, canWrite: true });

  const message = `Signed over MCP ${randomUUID()}`;
  createdEntries.push(message);
  expect(textOf(await callMcp(request, token, "tools/call", { name: "sign_guestbook", arguments: { message } }))).toEqual({ signed: message });
  expect(textOf(await callMcp(request, token, "tools/call", { name: "list_entries", arguments: {} }))).toContain(message);

  await page.reload();
  const item = page.getByRole("listitem").filter({ hasText: "E2E laptop" });
  await expect(item).toContainText(mcpCopy.list.readWrite);
  await expect(item).toContainText(formatMessage(mcpCopy.list.lastUsed, { date: "" }).trim());
  await item.getByRole("button", { name: `${mcpCopy.list.revoke}: E2E laptop` }).click();
  await expect(page.getByText(mcpCopy.list.empty)).toBeVisible();
  expect((await callMcp(request, token, "tools/list")).status).toBe(401);
});

test("a read-only token gets no write tool", async ({ browser, request }) => {
  const page = await openPageAsNewClient(browser);
  await signInUser(page);
  await page.goto("/account/mcp");
  const token = await issueToken(page, "E2E reader", false);
  expect(toolNames(await callMcp(request, token, "tools/list"))).toEqual(CATALOG.filter((tool) => tool.access === "read").map((tool) => tool.name));
  const refused = await callMcp(request, token, "tools/call", { name: "sign_guestbook", arguments: { message: "never stored" } });
  expect(refused.result?.isError ?? refused.error !== undefined).toBe(true);
});

test("the endpoint refuses a request without a valid token and keeps no sessions", async ({ request }) => {
  const missing = await request.post("/api/mcp", {
    headers: { "content-type": "application/json", "cf-connecting-ip": randomClientAddress() },
    data: { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} },
  });
  expect(missing.status()).toBe(401);
  expect(missing.headers()["www-authenticate"]).toMatch(/^Bearer error="invalid_token"/);
  expect((await callMcp(request, `sftmcp_${"A".repeat(43)}`, "tools/list")).status).toBe(401);
  expect((await request.get("/api/mcp")).status()).toBe(405);
});
