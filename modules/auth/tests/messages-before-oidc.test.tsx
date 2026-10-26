// @vitest-environment happy-dom
// A dictionary written for auth 0.2.5, before the OpenID Connect keys: it still types as AuthMessages (#786), and
// every OpenID Connect text it lacks reads the English copy.
import { authMessages, getAuthErrorMessage, type AuthMessages } from "@softure-ai/auth";
import { OidcSignIn } from "@softure-ai/auth/ui";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

afterEach(cleanup);

const en = authMessages.en;

type EnglishMessages = typeof en;
type AuthErrorCopyBeforeOidc = {
  readonly [K in keyof EnglishMessages["errors"]["auth"] as K extends `oidc_${string}` ? never : K]: string;
};
type MessagesBeforeOidc = Omit<EnglishMessages, "oidc" | "errors"> & {
  readonly errors: Omit<EnglishMessages["errors"], "auth"> & { readonly auth: AuthErrorCopyBeforeOidc };
};

function createMessagesBeforeOidc(): MessagesBeforeOidc {
  const copy = structuredClone(en) as Partial<EnglishMessages> & { errors: { auth: Partial<EnglishMessages["errors"]["auth"]> } };
  delete copy.oidc;
  for (const name of ["oidc_failed", "oidc_cancelled", "oidc_not_allowed", "oidc_no_account"] as const) delete copy.errors.auth[name];
  return { ...(copy as MessagesBeforeOidc), login: { ...en.login, submit: "Enter" } };
}

// The assignment is the compile check: typecheck runs over the tests.
const before: AuthMessages = createMessagesBeforeOidc();

describe("a dictionary without the OpenID Connect keys", () => {
  it("has none of them", () => {
    expect(Object.hasOwn(before, "oidc")).toBe(false);
    expect(Object.keys(before.errors.auth).filter((name) => name.startsWith("oidc_"))).toEqual([]);
  });

  it("reads the English copy for every OpenID Connect error code", () => {
    expect(getAuthErrorMessage(before, "auth.oidc_failed")).toBe("Signing in did not work. Try again.");
    expect(getAuthErrorMessage(before, "auth.oidc_cancelled")).toBe("Signing in was cancelled.");
    expect(getAuthErrorMessage(before, "auth.oidc_not_allowed")).toBe("This account may not sign in here.");
    expect(getAuthErrorMessage(before, "auth.oidc_no_account")).toBe("There is no account for this sign-in. Ask for access.");
  });

  it("keeps its own copy and its own generic failure", () => {
    const own: AuthMessages = { ...before, errors: { ...before.errors, core: { ...before.errors.core, unexpected: "Oops." } } };
    expect(own.login.submit).toBe("Enter");
    expect(getAuthErrorMessage(own, "auth.email_taken")).toBe("An account with this email already exists.");
    // @ts-expect-error: a code from a newer server than either dictionary.
    expect(getAuthErrorMessage(own, "auth.something_new")).toBe("Oops.");
  });

  it("renders the provider button and the divider in English", () => {
    render(<OidcSignIn action={() => undefined} providers={[{ id: "google", name: "Google" }]} messages={before} hasDivider />);
    expect(screen.getByRole("button").textContent).toBe("Sign in with Google");
    expect(screen.getByText("or").tagName).toBe("P");
  });

  it("prefers the dictionary's own OpenID Connect copy when it has it", () => {
    const own: AuthMessages = { ...before, oidc: { signInWith: "Continue with {provider}", divider: "else" } };
    render(<OidcSignIn action={() => undefined} providers={[{ id: "google", name: "Google" }]} messages={own} hasDivider />);
    expect(screen.getByRole("button").textContent).toBe("Continue with Google");
    expect(screen.getByText("else").tagName).toBe("P");
  });
});
