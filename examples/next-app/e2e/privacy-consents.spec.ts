// @softure-ai/privacy on the built app: the legal pages rendered from the app's content with the
// versions of softure.config.ts, the footer linking them, and registration recording consent to
// them in privacy.consents (read back from Postgres and from the export).
import { randomInt, randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { authMessages, users } from "@softure-ai/auth";
import { consents, privacyMessages } from "@softure-ai/privacy";
import { getLegalDocument } from "@softure-ai/privacy/server";
import { asc, eq, inArray } from "drizzle-orm";
import { en } from "../messages/en.ts";
import config from "../softure.config.ts";
import { openTestDatabase } from "./database.ts";

const authCopy = authMessages.en;
const copy = privacyMessages.en;
const PASSWORD = "correct horse battery";
const createdEmails: string[] = [];

test.beforeEach(({ context }) =>
  context.setExtraHTTPHeaders({ "cf-connecting-ip": `198.${String(18 + randomInt(2))}.${String(randomInt(256))}.${String(randomInt(1, 255))}` }),
);

test.afterAll(async () => {
  if (createdEmails.length === 0) return;
  const database = await openTestDatabase();
  try {
    // The consents go with the accounts (ON DELETE CASCADE).
    await database.db.delete(users).where(inArray(users.email, createdEmails));
  } finally {
    await database.close();
  }
});

test("the terms page shows the configured version, a table of contents and the change history", async ({ page }) => {
  const terms = en.legal.terms;
  const version = getLegalDocument(config, "terms").version;
  await page.goto("/legal/terms");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(terms.title);
  await expect(page.getByText(`${copy.legal.version} ${version} · ${copy.legal.effectiveFrom} October 1, 2026`)).toBeVisible();

  const contents = page.getByRole("navigation", { name: copy.legal.contents });
  await expect(contents.getByRole("link")).toHaveText(terms.sections.map((section) => section.title));
  await contents.getByRole("link", { name: terms.sections[1]?.title ?? "" }).click();
  await expect(page).toHaveURL(`/legal/terms#${terms.sections[1]?.id ?? ""}`);
  await expect(page.getByRole("region", { name: terms.sections[1]?.title ?? "" })).toContainText(terms.sections[1]?.body ?? "");

  const history = page.getByRole("region", { name: copy.legal.changes });
  await expect(history.getByRole("listitem")).toHaveCount(terms.changes.length);
  await expect(history.getByRole("listitem").first()).toContainText(terms.changes[0]?.summary ?? "");
});

test("every page links the legal documents from its footer", async ({ page }) => {
  await page.goto("/");
  const footer = page.getByRole("navigation", { name: copy.legal.footer });
  await footer.getByRole("link", { name: en.legal.footer.privacy }).click();
  await expect(page).toHaveURL("/legal/privacy");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(en.legal.privacy.title);
  await expect(page.getByRole("navigation", { name: copy.legal.footer }).getByRole("link", { name: en.legal.footer.terms })).toHaveAttribute(
    "href",
    "/legal/terms",
  );
});

test("registering records consent to every legal document with its version, and the export shows it", async ({ page }) => {
  const email = `e2e-consents-${randomUUID()}@example.com`;
  createdEmails.push(email);
  await page.goto("/register");
  await page.getByLabel(authCopy.fields.email, { exact: true }).fill(email);
  await page.getByLabel(authCopy.fields.password, { exact: true }).fill(PASSWORD);
  await page.getByLabel(authCopy.fields.consent).check();
  await page.getByRole("button", { name: authCopy.register.submit }).click();
  await expect(page).toHaveURL("/account");

  const database = await openTestDatabase();
  let rows;
  try {
    rows = await database.db
      .select({ purpose: consents.purpose, granted: consents.granted, documentId: consents.documentId, documentVersion: consents.documentVersion, source: consents.source })
      .from(consents)
      .innerJoin(users, eq(users.id, consents.userId))
      .where(eq(users.email, email))
      .orderBy(asc(consents.id));
  } finally {
    await database.close();
  }
  expect(rows).toEqual(
    ["terms", "privacy-policy"].map((id) => ({
      purpose: id,
      granted: true,
      documentId: id,
      documentVersion: getLegalDocument(config, id).version,
      source: "registration",
    })),
  );

  const response = await page.request.get("/api/privacy/export");
  expect(response.status()).toBe(200);
  const exported = (await response.json()) as { data: { privacy: { consents: { purpose: string; subject: string }[] } } };
  expect(exported.data.privacy.consents.map(({ purpose, subject }) => `${subject}:${purpose}`)).toEqual(["account:terms", "account:privacy-policy"]);
});
