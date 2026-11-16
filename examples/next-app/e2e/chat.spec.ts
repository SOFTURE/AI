// The chat of /account/chat on the built app: AI SDK UI's useChat on ui's chat primitives, streamed by
// llm.streamChat from a scripted model (lib/chat/llm.ts picks the script from the user's message, so no provider is
// called). Streaming, the tool card, Stop, Retry, and the route's refusals before the model is called.
import { expect, test, type Page } from "@playwright/test";
import { users } from "@softure-ai/auth";
import { uiMessages } from "@softure-ai/ui";
import { clientAddressHeaders, uniqueEmail } from "@softure-ai/testing/playwright";
import { inArray } from "drizzle-orm";
import { en } from "../messages/en.ts";
import { createSignedInAccount } from "./accounts.ts";
import { openTestDatabase } from "./database.ts";

const PASSWORD = "correct horse battery";
const ui = uiMessages.en.chat;
const createdEmails: string[] = [];

test.beforeEach(({ context }) => context.setExtraHTTPHeaders(clientAddressHeaders()));

test.afterAll(async () => {
  if (createdEmails.length === 0) return;
  const database = await openTestDatabase();
  try {
    await database.db.delete(users).where(inArray(users.email, createdEmails));
  } finally {
    await database.close();
  }
});

async function openChat(page: Page): Promise<void> {
  const email = uniqueEmail("e2e-chat");
  createdEmails.push(email);
  await createSignedInAccount(page, { email, password: PASSWORD });
  await page.goto("/account/chat");
  await expect(page.getByRole("heading", { name: en.chat.title })).toBeVisible();
}

async function send(page: Page, text: string): Promise<void> {
  await page.getByRole("textbox", { name: ui.composer.label }).fill(text);
  await page.getByRole("button", { name: ui.composer.send }).click();
}

test("an answer streams into the log, which is busy until it ends and then announces it", async ({ page }) => {
  await openChat(page);
  await send(page, "What can you do?");

  const log = page.getByRole("log", { name: ui.logLabel });
  const answer = log.locator('[data-role="assistant"]');
  await expect(log).toHaveAttribute("aria-busy", "true");
  await expect(answer).toHaveAttribute("data-status", "streaming");
  await expect(answer).toContainText("I can tell you how a project is doing.");
  await expect(answer).toHaveAttribute("data-status", "done");
  await expect(answer).toContainText("its status, progress and open tasks.");
  await expect(log).toHaveAttribute("aria-busy", "false");
  await expect(log.locator('[data-role="user"]')).toContainText("What can you do?");
  await expect(page.getByRole("status").filter({ hasText: "I can tell you how a project is doing." })).toBeAttached();
});

test("a project question runs the tool and draws its validated output as a card before the answer", async ({ page }) => {
  await openChat(page);
  await page.getByRole("button", { name: en.chat.suggestion }).click();

  const card = page.getByRole("region", { name: en.chat.toolTitle });
  await expect(card).toHaveAttribute("data-state", "done");
  await expect(card).toContainText(ui.tool.done);
  await expect(card).toContainText(en.chat.status.at_risk);
  await expect(card).toContainText("64%");
  await expect(card).toContainText(en.chat.openTasks);
  await expect(page.getByRole("log").locator('[data-role="assistant"]')).toContainText("Apollo is at risk: it is 64% done");
});

test("Stop ends an answer that is still streaming and gives the composer back", async ({ page }) => {
  await openChat(page);
  await send(page, "Take your time with this one");

  const answer = page.getByRole("log").locator('[data-role="assistant"]');
  await expect(answer).toContainText("Let me think this over carefully");
  await page.getByRole("button", { name: ui.composer.stop }).click();

  await expect(page.getByRole("button", { name: ui.composer.send })).toBeVisible();
  await expect(page.getByRole("button", { name: ui.composer.stop })).toHaveCount(0);
  await expect(answer).toHaveAttribute("data-status", "done");
  await expect(page.getByRole("log")).toHaveAttribute("aria-busy", "false");
});

test("a failed answer shows an alert, and Try again answers the same message", async ({ page }) => {
  await openChat(page);
  await send(page, "Fail once, then answer");

  const alert = page.getByRole("alert").filter({ hasText: en.chat.unavailable });
  await expect(alert).toBeVisible();
  await alert.getByRole("button", { name: ui.error.retry }).click();

  await expect(page.getByRole("log").locator('[data-role="assistant"]')).toContainText("The second attempt worked");
  await expect(alert).toHaveCount(0);
  await expect(page.getByRole("log").locator('[data-role="user"]')).toHaveCount(1);
});

test("the route refuses a visitor, a malformed body, an unknown message part and an oversized body", async ({ page, request }) => {
  const anonymous = await request.post("/api/chat", { data: { messages: [] }, headers: clientAddressHeaders() });
  expect(anonymous.status()).toBe(401);
  expect(await anonymous.json()).toEqual({ error: "auth.unauthenticated" });

  await openChat(page);
  const post = (body: string) => page.request.post("/api/chat", { data: body, headers: { "content-type": "application/json" } });

  const malformed = await post("{not json");
  expect(malformed.status()).toBe(400);
  expect(await malformed.json()).toEqual({ error: "chat.invalid_input" });

  const unknownPart = await post(JSON.stringify({ messages: [{ id: "m1", role: "user", parts: [{ type: "unknown-part", text: "hi" }] }] }));
  expect(unknownPart.status()).toBe(400);
  expect(await unknownPart.json()).toEqual({ error: "chat.invalid_input" });

  const empty = await post(JSON.stringify({ messages: [] }));
  expect(empty.status()).toBe(400);

  const oversized = await post(JSON.stringify({ messages: [{ id: "m1", role: "user", parts: [{ type: "text", text: "x".repeat(70_000) }] }] }));
  expect(oversized.status()).toBe(413);
  expect(await oversized.json()).toEqual({ error: "security.body_too_large" });
});
