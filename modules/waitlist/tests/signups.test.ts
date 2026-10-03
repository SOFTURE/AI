// Joining the waitlist: a first sign-up, repeat sign-ups that widen the scopes and never narrow
// them, consents recorded in privacy's ledger, refused forms, rate limits and setup checks.
import { getEmailKey, recordConsent } from "@softure-ai/privacy/server";
import { getSignup, joinWaitlist, listSignups, type JoinWaitlistInput } from "@softure-ai/waitlist/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CLIENT, createTestWaitlist, DOCUMENTS, listConsentRows, NOW, type TestWaitlist } from "./support.js";

const LATER = new Date(NOW.getTime() + 60_000);
const ADA = "ada@example.com";
const JOIN: JoinWaitlistInput = { email: ADA, scopes: ["launch"], placement: "hero", clientKey: CLIENT };

async function join(test: TestWaitlist, input: Partial<JoinWaitlistInput> = {}) {
  return joinWaitlist(test.ctx, { ...JOIN, ...input });
}

async function countSignups(test: TestWaitlist): Promise<number> {
  const result = await test.database.client.query<{ count: number }>("SELECT count(*)::int AS count FROM waitlist.signups");
  return result.rows[0]?.count ?? 0;
}

describe("joinWaitlist", () => {
  let test: TestWaitlist;

  beforeEach(async () => {
    test = await createTestWaitlist();
  });
  afterEach(() => test.database.close());

  it("stores a first sign-up under the normalised address and records each consent with its document version", async () => {
    const result = await join(test, { email: "  Ada@Example.COM ", scopes: ["newsletter", "launch"] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.isNew).toBe(true);
    expect(result.value.recordedScopes).toEqual(["launch", "newsletter"]);
    expect(result.value.signup).toEqual({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/) as unknown,
      email: ADA,
      scopes: ["launch", "newsletter"],
      placement: "hero",
      locale: "en",
      createdAt: NOW,
      updatedAt: NOW,
    });
    expect(await getSignup(test.ctx, "ADA@example.com")).toEqual(result.value.signup);
    expect(await listConsentRows(test, getEmailKey(ADA))).toEqual([
      { purpose: "launch", granted: true, document_id: "privacy-policy", document_version: "2026-09-01", source: "waitlist", recorded_at: NOW },
      { purpose: "newsletter", granted: true, document_id: null, document_version: null, source: "waitlist", recorded_at: NOW },
    ]);
  });

  it("widens the scopes on a repeat sign-up, recording only the new consent and keeping the first placement", async () => {
    const first = await join(test);
    test.clock.set(LATER);
    const second = await join(test, { email: "ADA@example.com", scopes: ["launch", "newsletter"], placement: "footer" });

    expect(second.ok && second.value).toEqual({
      signup: { ...(first.ok ? first.value.signup : {}), scopes: ["launch", "newsletter"], updatedAt: LATER },
      isNew: false,
      recordedScopes: ["newsletter"],
    });
    expect(await countSignups(test)).toBe(1);
    expect((await listConsentRows(test, getEmailKey(ADA))).map((row) => [row.purpose, row.recorded_at])).toEqual([
      ["launch", NOW],
      ["newsletter", LATER],
    ]);
  });

  it("never narrows: a repeat sign-up with fewer scopes keeps them all and records nothing", async () => {
    await join(test, { scopes: ["launch", "newsletter"] });
    test.clock.set(LATER);
    const again = await join(test, { scopes: ["launch"] });
    expect(again.ok && again.value.signup.scopes).toEqual(["launch", "newsletter"]);
    expect(again.ok && again.value.signup.updatedAt).toEqual(NOW);
    expect(again.ok && again.value.recordedScopes).toEqual([]);
    expect(await listConsentRows(test, getEmailKey(ADA))).toHaveLength(2);
  });

  it("records a scope again when its consent was withdrawn since", async () => {
    await join(test, { scopes: ["launch", "newsletter"] });
    test.clock.set(LATER);
    await recordConsent(test.ctx, { subject: { email: ADA }, purpose: "newsletter", granted: false, source: "account" });
    const again = await join(test, { scopes: ["launch", "newsletter"] });
    expect(again.ok && again.value.recordedScopes).toEqual(["newsletter"]);
    expect((await listConsentRows(test, getEmailKey(ADA))).map((row) => [row.purpose, row.granted])).toEqual([
      ["launch", true],
      ["newsletter", true],
      ["newsletter", false],
      ["newsletter", true],
    ]);
  });

  it("records a scope again against a newer version of its document", async () => {
    await join(test);
    const newer = await createTestWaitlist({ documents: [DOCUMENTS[0] as (typeof DOCUMENTS)[number], { id: "privacy-policy", version: "2026-12-01" }] });
    try {
      // The same database under a config whose privacy policy changed.
      const ctx = { ...test.ctx, config: newer.config };
      const again = await joinWaitlist(ctx, JOIN);
      expect(again.ok && again.value.recordedScopes).toEqual(["launch"]);
      expect((await listConsentRows(test, getEmailKey(ADA))).map((row) => row.document_version)).toEqual(["2026-09-01", "2026-12-01"]);
    } finally {
      await newer.database.close();
    }
  });

  it("keeps one row when the same address signs up twice at once", async () => {
    const [first, second] = await Promise.all([join(test), join(test, { scopes: ["launch", "newsletter"] })]);
    expect(first.ok && second.ok).toBe(true);
    expect(await countSignups(test)).toBe(1);
    expect((await getSignup(test.ctx, ADA))?.scopes).toEqual(["launch", "newsletter"]);
    expect((await listConsentRows(test, getEmailKey(ADA))).map((row) => row.purpose).sort()).toEqual(["launch", "newsletter"]);
  });

  it.each([
    ["an address that is not one", { email: "ada.example.com" }, "waitlist.email_invalid"],
    ["an address over 254 characters", { email: `${"a".repeat(250)}@example.com` }, "waitlist.email_invalid"],
    ["no scope", { scopes: [] }, "waitlist.consent_required"],
    ["an optional scope without the required one", { scopes: ["newsletter"] }, "waitlist.consent_required"],
    ["a scope the config does not declare", { scopes: ["launch", "beta"] }, "waitlist.form_invalid"],
    ["a placement the config does not declare", { placement: "sidebar" }, "waitlist.form_invalid"],
  ] as const)("refuses %s and stores nothing", async (_case, input, error) => {
    expect(await join(test, input)).toEqual({ ok: false, error });
    expect(await countSignups(test)).toBe(0);
    expect(await listConsentRows(test, getEmailKey(ADA))).toEqual([]);
  });

  it("accepts a form without a required scope when none is required, but not an empty one", async () => {
    const optional = await createTestWaitlist({ waitlist: { scopes: [{ id: "newsletter", label: { en: "News" } }] } });
    try {
      expect((await joinWaitlist(optional.ctx, { ...JOIN, scopes: [], placement: "default" })).ok).toBe(false);
      expect((await joinWaitlist(optional.ctx, { ...JOIN, scopes: ["newsletter"], placement: "default" })).ok).toBe(true);
    } finally {
      await optional.database.close();
    }
  });

  it("counts every attempt per client, and sign-ups per address", async () => {
    for (let attempt = 0; attempt < 3; attempt += 1) expect((await join(test)).ok).toBe(true);
    expect(await join(test)).toMatchObject({ ok: false, error: "security.rate_limited" });
    // Another address from the same client still gets through until the client's limit.
    expect((await join(test, { email: "eve@example.com" })).ok).toBe(true);
    for (let attempt = 0; attempt < 5; attempt += 1) await join(test, { email: "x" });
    expect(await join(test, { email: "bob@example.com" })).toMatchObject({ ok: false, error: "security.rate_limited" });
    expect(await getSignup(test.ctx, "bob@example.com")).toBeNull();
  });

  it("refuses to run without its rate limit buckets or with a scope naming an undeclared document", async () => {
    const noBuckets = await createTestWaitlist({ buckets: { other: { limit: 1, windowMinutes: 1 } } });
    try {
      await expect(joinWaitlist(noBuckets.ctx, JOIN)).rejects.toThrow(
        '@softure-ai/waitlist: security({ buckets }) lacks "waitlist", "waitlist-email"; spread WAITLIST_RATE_LIMIT_BUCKETS into it',
      );
    } finally {
      await noBuckets.database.close();
    }
    const noDocument = await createTestWaitlist({ documents: [] });
    try {
      await expect(joinWaitlist(noDocument.ctx, JOIN)).rejects.toThrow(
        '@softure-ai/waitlist: scope "launch" names the document "privacy-policy", which privacy({ documents }) does not declare',
      );
    } finally {
      await noDocument.database.close();
    }
  });
});

describe("listSignups", () => {
  let test: TestWaitlist;

  beforeEach(async () => {
    test = await createTestWaitlist();
    await join(test, { email: "ada@example.com", scopes: ["launch", "newsletter"] });
    test.clock.set(LATER);
    await join(test, { email: "bob@example.com", placement: "footer" });
  });
  afterEach(() => test.database.close());

  it("lists every sign-up oldest first, or those of one scope or placement", async () => {
    expect((await listSignups(test.ctx)).map((signup) => signup.email)).toEqual(["ada@example.com", "bob@example.com"]);
    expect((await listSignups(test.ctx, { scope: "newsletter" })).map((signup) => signup.email)).toEqual(["ada@example.com"]);
    expect((await listSignups(test.ctx, { placement: "footer" })).map((signup) => signup.email)).toEqual(["bob@example.com"]);
    expect(await listSignups(test.ctx, { scope: "newsletter", placement: "footer" })).toEqual([]);
  });

  it("finds no sign-up for an unknown or malformed address", async () => {
    expect(await getSignup(test.ctx, "eve@example.com")).toBeNull();
    expect(await getSignup(test.ctx, "not an address")).toBeNull();
  });
});

describe("the signups table", () => {
  let test: TestWaitlist;

  beforeEach(async () => {
    test = await createTestWaitlist();
  });
  afterEach(() => test.database.close());

  const insert = (email: string, scopes: (string | null)[], placement = "hero") =>
    test.database.client.query("INSERT INTO waitlist.signups (email, scopes, placement, locale, created_at, updated_at) VALUES ($1, $2, $3, 'en', now(), now())", [
      email,
      scopes,
      placement,
    ]);

  it.each([
    ["an address that is not normalised", "Ada@example.com", ["launch"], "hero"],
    ["no scope", ADA, [], "hero"],
    ["a scope twice", ADA, ["launch", "launch"], "hero"],
    ["a scope that is not kebab-case", ADA, ["Launch"], "hero"],
    ["a scope over 64 characters", ADA, ["a".repeat(65)], "hero"],
    ["a NULL scope", ADA, ["launch", null], "hero"],
    ["seventeen scopes", ADA, Array.from({ length: 17 }, (_, index) => `s${String(index)}`), "hero"],
    ["a placement that is not kebab-case", ADA, ["launch"], "Hero Banner"],
  ])("refuses %s", async (_case, email, scopes, placement) => {
    await expect(insert(email, scopes, placement)).rejects.toThrow(/check constraint/);
  });

  it("accepts any declared shape the app chooses, and one row per address", async () => {
    await insert(ADA, ["launch", "a".repeat(64)]);
    await expect(insert(ADA, ["launch"])).rejects.toThrow(/signups_email_key/);
  });
});
