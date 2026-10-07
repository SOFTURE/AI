// @vitest-environment happy-dom
// The register page with Next's request scope replaced: no session cookie, so it renders the form.
import { authMessages } from "@softure-ai/auth";
import { createRegisterPage, LogoutButton, RegisterPage } from "@softure-ai/auth/next";
import type { SoftureConfig } from "@softure-ai/core";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTestAuth, type TestAuth } from "./support.js";

const scope = vi.hoisted((): { config: SoftureConfig | undefined; context: unknown } => ({ config: undefined, context: undefined }));

vi.mock("@softure-ai/core/next", () => ({
  getSoftureConfig: () => {
    if (scope.config === undefined) throw new Error("test: no config registered");
    return scope.config;
  },
}));
vi.mock("next/headers", () => ({ cookies: () => Promise.resolve({ get: () => undefined }), headers: () => Promise.resolve(new Headers()) }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("test: notFound");
  },
  redirect: (url: string) => {
    throw new Error(`test: redirect to ${url}`);
  },
}));
vi.mock("next/server", () => ({ after: () => undefined }));
vi.mock("../src/next/context.ts", () => ({ getAuthContext: () => Promise.resolve(scope.context) }));

const en = authMessages.en;

describe("the register page", () => {
  let test: TestAuth;

  async function setUp(registrationFields: string[] = []): Promise<void> {
    test = await createTestAuth({ auth: { registrationFields } });
    scope.config = test.config;
    scope.context = test.ctx;
  }

  afterEach(async () => {
    cleanup();
    await test.database.close();
  });

  it("carries a declared field from its URL as a hidden input, and nothing undeclared", async () => {
    await setUp(["z"]);
    render(await RegisterPage({ searchParams: Promise.resolve({ z: "newsletter", role: "admin" }) }));
    expect(document.querySelector('input[name="z"]')).toHaveProperty("value", "newsletter");
    expect(document.querySelector('input[name="role"]')).toBeNull();
  });

  it("takes the app's consent label and extra inputs from createRegisterPage", async () => {
    await setUp(["company"]);
    const Page = createRegisterPage({
      consentLabel: (
        <>
          {en.fields.consent} <a href="/terms">{en.login.registerLink}</a>
        </>
      ),
      extraFields: <input name="company" aria-label={en.fields.email} />,
    });
    render(await Page({ searchParams: Promise.resolve({}) }));
    expect(screen.getByRole("link", { name: en.login.registerLink })).toHaveProperty("href", expect.stringContaining("/terms") as string);
    expect(document.querySelector('form input[name="company"]')).not.toBeNull();
    expect(screen.getByRole("checkbox")).toHaveProperty("required", true);
  });
});

describe("the logout button", () => {
  let test: TestAuth;

  afterEach(async () => {
    cleanup();
    await test.database.close();
  });

  it("posts its next path as a hidden field, and none without one", async () => {
    test = await createTestAuth();
    scope.config = test.config;
    const { unmount } = render(<LogoutButton next="/login?next=/oauth/authorize" />);
    expect(document.querySelector('form input[type="hidden"][name="next"]')).toHaveProperty("value", "/login?next=/oauth/authorize");
    unmount();
    render(<LogoutButton />);
    expect(document.querySelector('input[name="next"]')).toBeNull();
    expect(screen.getByRole("button", { name: en.logout.submit })).not.toBeNull();
  });
});
