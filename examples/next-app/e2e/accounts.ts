// Accounts for tests that need a signed-in user but are not about registration: created in Postgres
// with auth's own factory (hashed with the app's parameters), then signed in through the login form.
// Tests about registration (what the form does, what a sign-up records) keep using the form.
import type { Page } from "@playwright/test";
import { authMessages, type AuthUser } from "@softure-ai/auth";
import { getAuthOptions } from "@softure-ai/auth/server";
import { createTestAccount, type TestAccountInput } from "@softure-ai/auth/testing";
import { logIn, withDatabase } from "@softure-ai/testing/playwright";
import config from "../softure.config.ts";
import { openTestDatabase } from "./database.ts";

export type AccountInput = Omit<TestAccountInput, "scrypt">;

/** Creates an account (and its roles) in the e2e database. */
export async function createAccount(input: AccountInput): Promise<AuthUser> {
  const scrypt = getAuthOptions(config).password.scrypt;
  return withDatabase(openTestDatabase, (handle) => createTestAccount(handle.db, { ...input, scrypt }));
}

/** Creates an account and signs it in on `page`, which lands on the account page as after registration. */
export async function createSignedInAccount(page: Page, input: AccountInput): Promise<AuthUser> {
  const user = await createAccount(input);
  await logIn(page, { copy: authMessages.en, email: input.email, password: input.password });
  return user;
}
