import { randomUUID } from "node:crypto";
import { expect, type Page } from "@playwright/test";
import { tickCheckbox } from "./checkbox.js";
import { uniqueEmail } from "./test-data.js";

/**
 * The labels the auth forms are found by: `authMessages.<locale>` of `@softure-ai/auth` fits as is.
 * Typed by shape, so this package does not depend on the auth module, and a label renamed in auth's
 * dictionary moves the helpers with it.
 */
export interface AuthFormCopy {
  readonly fields: { readonly email: string; readonly password: string; readonly consent: string };
  readonly register: { readonly submit: string };
  readonly login: { readonly submit: string };
}

export interface AuthFormInput {
  readonly copy: AuthFormCopy;
  readonly email: string;
  readonly password: string;
}

export interface AuthNavigationOptions {
  /** The page with the form; the default is auth's route. */
  readonly path?: string;
  /** Where a success lands; `null` skips the check (a test that expects a refusal). */
  readonly landingPath?: string | null;
}

const REGISTER_PATH = "/register";
const LOGIN_PATH = "/login";
const ACCOUNT_PATH = "/account";

/**
 * Creates an account through the registration form and waits for the landing page. The consent box is ticked
 * with `tickCheckbox`, so a visually hidden native input under a custom box works too.
 */
export async function registerAccount(page: Page, input: AuthFormInput & AuthNavigationOptions): Promise<void> {
  const { copy, email, password, path = REGISTER_PATH, landingPath = ACCOUNT_PATH } = input;
  await page.goto(path);
  await page.getByLabel(copy.fields.email, { exact: true }).fill(email);
  await page.getByLabel(copy.fields.password, { exact: true }).fill(password);
  await tickCheckbox(page.getByLabel(copy.fields.consent));
  await page.getByRole("button", { name: copy.register.submit }).click();
  if (landingPath !== null) await expect(page).toHaveURL(landingPath);
}

/**
 * Fills the login form already on the page, submits it and waits for the action's answer, so a test
 * that fills the form again is not reset by the answer arriving late. Asserts nothing about the
 * outcome: the test checks the URL or the error itself.
 */
export async function submitLogin(page: Page, input: AuthFormInput): Promise<void> {
  const { copy, email, password } = input;
  await page.getByLabel(copy.fields.email, { exact: true }).fill(email);
  await page.getByLabel(copy.fields.password, { exact: true }).fill(password);
  const answered = page.waitForResponse((response) => response.request().method() === "POST");
  await page.getByRole("button", { name: copy.login.submit }).click();
  await answered;
}

/** Opens the login page, logs in and waits for the landing page. */
export async function logIn(page: Page, input: AuthFormInput & AuthNavigationOptions): Promise<void> {
  const { path = LOGIN_PATH, landingPath = ACCOUNT_PATH } = input;
  await page.goto(path);
  await submitLogin(page, input);
  if (landingPath !== null) await expect(page).toHaveURL(landingPath);
}

export interface SignInPerFileOptions {
  readonly copy: AuthFormCopy;
  /** The account's address; a fresh `uniqueEmail("e2e")` by default, so every worker that loads the file gets its own. */
  readonly email?: string;
  /** The account's password; a random one by default. */
  readonly password?: string;
  /** The registration page; auth's route by default. */
  readonly registerPath?: string;
  /** The login page; auth's route by default. */
  readonly loginPath?: string;
  /** Where registration and login land; `/account` by default. */
  readonly landingPath?: string;
}

export interface PerFileAccount {
  readonly email: string;
  readonly password: string;
  /** Registers the account through the form on the first call, logs it in on every later one. */
  signIn(page: Page): Promise<void>;
}

/**
 * One account for the tests of a file, created through the real registration form: call it at the top of the file,
 * then `await account.signIn(page)` in each test. Files run in parallel without sharing an account. Playwright loads
 * a file once per worker, so with `fullyParallel` each worker registers its own account; a fixed `email` must not
 * be shared by several workers. A registration that fails is tried again by the next `signIn`.
 */
export function signInPerFile(options: SignInPerFileOptions): PerFileAccount {
  const { copy, email = uniqueEmail("e2e"), password = randomUUID(), registerPath, loginPath, landingPath } = options;
  let registration: Promise<void> | undefined;

  async function signIn(page: Page): Promise<void> {
    if (registration === undefined) {
      const attempt = registerAccount(page, { copy, email, password, path: registerPath, landingPath });
      registration = attempt;
      try {
        await attempt;
      } catch (error) {
        registration = undefined;
        throw error;
      }
      return;
    }
    await registration;
    await logIn(page, { copy, email, password, path: loginPath, landingPath });
  }

  return { email, password, signIn };
}
