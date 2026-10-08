// The unsubscribe page, its action and the one-click route, with Next's request scope replaced:
// the config and the database come from the test, `redirect` throws what it was given.
import type { SoftureConfig } from "@softure-ai/core";
import { getUnsubscribeRoute, postUnsubscribeRoute, unsubscribeAction, UnsubscribePage } from "@softure-ai/mailing/next";
import { getRecipientKey, signRecipientKey, type SuppressionContext } from "@softure-ai/mailing/server";
import { fakeMailProvider } from "@softure-ai/mailing/testing";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { createConfig, createTestMailing, listSuppressions, NOW, SECRET, type TestMailing } from "./support.js";

interface RequestScope {
  config: SoftureConfig | undefined;
  context: SuppressionContext | undefined;
}

const scope = vi.hoisted((): RequestScope => ({ config: undefined, context: undefined }));

class RedirectSignal extends Error {
  constructor(readonly location: string) {
    super(`redirect ${location}`);
  }
}

vi.mock("@softure-ai/core/next", () => ({
  getSoftureConfig: () => {
    if (scope.config === undefined) throw new Error("test: no config registered");
    return scope.config;
  },
}));
vi.mock("next/navigation", () => ({
  redirect: (location: string) => {
    throw new RedirectSignal(location);
  },
}));
vi.mock("../src/next/context.ts", () => ({ getMailingContext: () => Promise.resolve(scope.context) }));

const KEY = getRecipientKey("ada@example.org");
const SIGNATURE = signRecipientKey(KEY, SECRET);
const QUERY = `r=${KEY}&t=${SIGNATURE}`;

describe("the unsubscribe adapter", () => {
  let test: TestMailing;
  let log: MockInstance<typeof console.error>;

  beforeEach(async () => {
    test = await createTestMailing(createConfig(fakeMailProvider()));
    scope.config = test.config;
    scope.context = test.ctx;
    vi.stubEnv("MAILING_UNSUBSCRIBE_SECRET", SECRET);
    log = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(async () => {
    await test.database.close();
    vi.unstubAllEnvs();
    log.mockRestore();
  });

  const logged = () => log.mock.calls.map((call) => call.join(" ")).join("\n");
  const post = (query: string, body = "List-Unsubscribe=One-Click") =>
    postUnsubscribeRoute(new Request(`https://app.example.com/api/mailing/unsubscribe?${query}`, { method: "POST", body }));

  describe("the one-click route", () => {
    it("records the opt-out of a signed link and answers 200, also the second time", async () => {
      const first = await post(QUERY);
      expect(first.status).toBe(200);
      expect(first.headers.get("cache-control")).toBe("no-store");
      expect((await post(QUERY)).status).toBe(200);
      expect(await listSuppressions(test.database)).toEqual([`${KEY} one-click ${NOW.toISOString()}`]);
    });

    it("does not need the RFC 8058 body: the signature is the proof", async () => {
      expect((await post(QUERY, "")).status).toBe(200);
    });

    it.each([
      ["no parameters", ""],
      ["a missing signature", `r=${KEY}`],
      ["a forged signature", `r=${KEY}&t=${"A".repeat(43)}`],
      ["a signature for another recipient", `r=${getRecipientKey("bob@example.org")}&t=${SIGNATURE}`],
    ])("answers 400 for %s and stores nothing", async (_case, query) => {
      expect((await post(query)).status).toBe(400);
      expect(await listSuppressions(test.database)).toEqual([]);
    });

    it.each([
      ["no parameters", ""],
      ["a forged signature", `r=${KEY}&t=${"A".repeat(43)}`],
    ])("answers 200 for %s with oneClickInvalidLinkStatus 200, and stores nothing", async (_case, query) => {
      scope.context = { ...test.ctx, config: createConfig(fakeMailProvider(), { oneClickInvalidLinkStatus: 200 }) };
      expect((await post(query)).status).toBe(200);
      expect(await listSuppressions(test.database)).toEqual([]);
    });

    it("still answers 500 on a database failure with oneClickInvalidLinkStatus 200", async () => {
      scope.context = { ...test.ctx, config: createConfig(fakeMailProvider(), { oneClickInvalidLinkStatus: 200 }) };
      await test.database.client.query("DROP TABLE mailing.suppressions");
      expect((await post(QUERY)).status).toBe(500);
    });

    it("answers 500 when the database fails, and logs no link", async () => {
      await test.database.client.query("DROP TABLE mailing.suppressions");
      expect((await post(QUERY)).status).toBe(500);
      expect(logged()).toMatch(/^@softure-ai\/mailing: one-click unsubscribe failed: /);
      expect(logged()).not.toContain(KEY);
    });

    it("sends a browser that opens the header link to the page, with the same link", () => {
      const response = getUnsubscribeRoute(new Request(`https://app.example.com/api/mailing/unsubscribe?${QUERY}`));
      expect(response.status).toBe(303);
      expect(response.headers.get("location")).toBe(`/unsubscribe?${QUERY}`);
    });
  });

  describe("the page's action", () => {
    function form(values: Record<string, string>): FormData {
      const data = new FormData();
      for (const [name, value] of Object.entries(values)) data.set(name, value);
      return data;
    }

    async function submit(values: Record<string, string>): Promise<string> {
      const error: unknown = await unsubscribeAction(form(values)).then(
        () => new Error("test: the action did not redirect"),
        (thrown: unknown) => thrown,
      );
      if (!(error instanceof RedirectSignal)) throw error;
      return error.location;
    }

    it("records the opt-out and redirects to the outcome", async () => {
      expect(await submit({ r: KEY, t: SIGNATURE })).toBe("/unsubscribe?status=done");
      expect(await listSuppressions(test.database)).toEqual([`${KEY} page ${NOW.toISOString()}`]);
    });

    it("redirects an invalid link to the invalid outcome", async () => {
      expect(await submit({ r: KEY, t: "A".repeat(43) })).toBe("/unsubscribe?status=invalid");
      expect(await submit({})).toBe("/unsubscribe?status=invalid");
      expect(await listSuppressions(test.database)).toEqual([]);
    });

    it("brings the form back with the same link when the database fails", async () => {
      await test.database.client.query("DROP TABLE mailing.suppressions");
      expect(await submit({ r: KEY, t: SIGNATURE })).toBe(`/unsubscribe?status=failed&${QUERY}`);
      expect(logged()).not.toContain(KEY);
    });
  });

  describe("the page", () => {
    async function renderPage(query: string): Promise<string> {
      const element = await UnsubscribePage({ searchParams: Promise.resolve(Object.fromEntries(new URLSearchParams(query))) });
      return renderToStaticMarkup(element);
    }

    it("offers a button with the link in hidden fields, and changes nothing on open", async () => {
      const html = await renderPage(QUERY);
      expect(html).toContain("Unsubscribe me");
      expect(html).toContain(`name="r" value="${KEY}"`);
      expect(html).toContain(`name="t" value="${SIGNATURE}"`);
      expect(html).toContain(`<meta name="referrer" content="same-origin"/>`);
      expect(await listSuppressions(test.database)).toEqual([]);
    });

    it("shows the outcome after a submit", async () => {
      expect(await renderPage("status=done")).toContain("You are unsubscribed");
      expect(await renderPage("status=invalid")).toContain("This link does not work");
    });

    it("shows the failure above the form", async () => {
      const html = await renderPage(`status=failed&${QUERY}`);
      expect(html).toContain('role="alert"');
      expect(html).toContain("We could not save that. Try again in a moment.");
      expect(html).toContain("Unsubscribe me");
    });

    it("explains a link without its parameters instead of showing a button", async () => {
      const html = await renderPage(`r=${KEY}`);
      expect(html).toContain("This link does not work");
      expect(html).not.toContain("Unsubscribe me");
    });

    it("speaks the app's language", async () => {
      scope.config = createConfig(fakeMailProvider(), { locale: "pl" });
      expect(await renderPage(QUERY)).toContain("Wypisz mnie");
    });
  });
});

describe("the unsubscribe adapter with legacy links", () => {
  const LEGACY_QUERY = "u=signup-17&t=old-hmac";
  let test: TestMailing;
  let verify: ReturnType<typeof vi.fn<(values: Readonly<Record<string, string>>) => Promise<string | null>>>;
  let log: MockInstance<typeof console.error>;

  beforeEach(async () => {
    verify = vi.fn((values: Readonly<Record<string, string>>) => Promise.resolve(values.t === "old-hmac" ? "ada@example.org" : null));
    test = await createTestMailing(createConfig(fakeMailProvider(), { legacyUnsubscribe: { params: ["u", "t"], verify } }));
    scope.config = test.config;
    scope.context = test.ctx;
    vi.stubEnv("MAILING_UNSUBSCRIBE_SECRET", SECRET);
    log = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(async () => {
    await test.database.close();
    vi.unstubAllEnvs();
    log.mockRestore();
  });

  const post = (query: string) => postUnsubscribeRoute(new Request(`https://app.example.com/old/unsubscribe?${query}`, { method: "POST", body: "List-Unsubscribe=One-Click" }));

  async function submit(values: Record<string, string>): Promise<string> {
    const data = new FormData();
    for (const [name, value] of Object.entries(values)) data.set(name, value);
    const error: unknown = await unsubscribeAction(data).then(
      () => new Error("test: the action did not redirect"),
      (thrown: unknown) => thrown,
    );
    if (!(error instanceof RedirectSignal)) throw error;
    return error.location;
  }

  it("offers the button for a legacy link, carrying its values, and calls nothing on open", async () => {
    const html = renderToStaticMarkup(await UnsubscribePage({ searchParams: Promise.resolve({ u: "signup-17", t: "old-hmac" }) }));
    expect(html).toContain("Unsubscribe me");
    expect(html).toContain('name="u" value="signup-17"');
    expect(html).toContain('name="t" value="old-hmac"');
    expect(verify).not.toHaveBeenCalled();
  });

  it("still offers the button for a signed link", async () => {
    const html = renderToStaticMarkup(await UnsubscribePage({ searchParams: Promise.resolve({ r: KEY, t: SIGNATURE }) }));
    expect(html).toContain(`name="r" value="${KEY}"`);
  });

  it("records a legacy link from the page's action", async () => {
    expect(await submit({ u: "signup-17", t: "old-hmac" })).toBe("/unsubscribe?status=done");
    expect(await listSuppressions(test.database)).toEqual([`${KEY} page ${NOW.toISOString()}`]);
  });

  it("brings the legacy link back when verify fails, and logs none of it", async () => {
    verify.mockRejectedValueOnce(new Error("signups unreadable signup-17"));
    expect(await submit({ u: "signup-17", t: "old-hmac" })).toBe(`/unsubscribe?status=failed&${LEGACY_QUERY}`);
    expect(log.mock.calls.flat().join(" ")).not.toContain("signup-17");
  });

  it("records a legacy one-click POST, refuses a forged one and answers 500 when verify fails", async () => {
    expect((await post(LEGACY_QUERY)).status).toBe(200);
    expect((await post("u=signup-17&t=forged")).status).toBe(400);
    verify.mockRejectedValueOnce(new Error("down"));
    expect((await post(LEGACY_QUERY)).status).toBe(500);
    expect(await listSuppressions(test.database)).toEqual([`${KEY} one-click ${NOW.toISOString()}`]);
  });
});
