import { expect, type Page } from "@playwright/test";

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

/** Creates an account through the registration form (consent ticked) and waits for the landing page. */
export async function registerAccount(page: Page, input: AuthFormInput & AuthNavigationOptions): Promise<void> {
  const { copy, email, password, path = REGISTER_PATH, landingPath = ACCOUNT_PATH } = input;
  await page.goto(path);
  await page.getByLabel(copy.fields.email, { exact: true }).fill(email);
  await page.getByLabel(copy.fields.password, { exact: true }).fill(password);
  await page.getByLabel(copy.fields.consent).check();
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
