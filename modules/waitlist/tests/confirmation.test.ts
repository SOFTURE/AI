// Double opt-in: a sign-up waits for its link before it counts. Until then nothing is recorded,
// lifted or listed; the link applies the request once, expires, and is replaced by a newer one.
import { createHash } from "node:crypto";
import { getRecipientKey, isSuppressed, signRecipientKey, suppressRecipient, unsubscribe } from "@softure-ai/mailing/server";
import { getEmailKey } from "@softure-ai/privacy/server";
import { waitlistMessages, type WaitlistMailTemplateInput, type WaitlistSignup } from "@softure-ai/waitlist";
import {
  confirmSignup,
  deliverConfirmationMail,
  deliverWelcomeMail,
  getConfirmationLink,
  getSignup,
  joinWaitlist,
  listSignups,
  pruneUnconfirmedSignups,
  type JoinWaitlistInput,
  type PendingSignup,
} from "@softure-ai/waitlist/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CLIENT, createTestWaitlist, listConsentRows, NOW, OPTIONS, SECRET, type ConfigOptions, type TestWaitlist } from "./support.js";

const HOUR_MS = 60 * 60 * 1000;
const LATER = new Date(NOW.getTime() + HOUR_MS);
const EXPIRY = new Date(NOW.getTime() + 168 * HOUR_MS);
const ADA = "ada@example.com";
const JOIN: JoinWaitlistInput = { email: ADA, scopes: ["launch"], placement: "hero", clientKey: CLIENT };
const DOUBLE_OPT_IN: ConfigOptions = { waitlist: { ...OPTIONS, doubleOptIn: true } };

async function requestSignup(test: TestWaitlist, input: Partial<JoinWaitlistInput> = {}): Promise<PendingSignup> {
  const result = await joinWaitlist(test.ctx, { ...JOIN, ...input });
  if (!result.ok || result.value.status !== "confirmation_required") throw new Error("expected a request that waits for its link");
  return result.value;
}

async function confirm(test: TestWaitlist, token: string) {
  return confirmSignup(test.ctx, { token, clientKey: CLIENT });
}

async function readLedger(test: TestWaitlist): Promise<string[]> {
  return (await listConsentRows(test, getEmailKey(ADA))).map((row) => `${row.purpose} ${String(row.granted)} ${row.source}`);
}

async function readLinkColumns(test: TestWaitlist) {
  const result = await test.database.client.query<{ pending_scopes: string[] | null; confirmation_token_hash: string | null; confirmation_expires_at: Date | null }>(
    "SELECT pending_scopes, confirmation_token_hash, confirmation_expires_at FROM waitlist.signups WHERE email = $1",
    [ADA],
  );
  return result.rows[0];
}

describe("joinWaitlist with double opt-in", () => {
  let test: TestWaitlist;

  beforeEach(async () => {
    test = await createTestWaitlist(DOUBLE_OPT_IN);
  });
  afterEach(() => test.database.close());

  it("stores an unconfirmed request with a link, records no consent and leaves the address off the list", async () => {
    const pending = await requestSignup(test, { scopes: ["launch", "newsletter"] });

    expect(pending).toEqual({
      status: "confirmation_required",
      signup: {
        id: expect.stringMatching(/^[0-9a-f-]{36}$/) as unknown,
        email: ADA,
        scopes: ["launch", "newsletter"],
        placement: "hero",
        locale: "en",
        createdAt: NOW,
        updatedAt: NOW,
        confirmedAt: null,
      },
      isNew: true,
      token: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/) as unknown,
      expiresAt: EXPIRY,
    });
    expect(await readLedger(test)).toEqual([]);
    expect(await listSignups(test.ctx)).toEqual([]);
    expect(await getSignup(test.ctx, ADA)).toEqual(pending.signup);
    // Only the token's hash is stored.
    expect(await readLinkColumns(test)).toEqual({
      pending_scopes: ["launch", "newsletter"],
      confirmation_token_hash: createHash("sha256").update(pending.token).digest("hex"),
      confirmation_expires_at: EXPIRY,
    });
  });

  it("takes the link's expiry from the option", async () => {
    await test.database.close();
    test = await createTestWaitlist({ waitlist: { ...OPTIONS, doubleOptIn: { expiresInHours: 24 } } });
    expect((await requestSignup(test)).expiresAt).toEqual(new Date(NOW.getTime() + 24 * HOUR_MS));
  });

  it("does not lift an opt-out before the link is used", async () => {
    await suppressRecipient(test.ctx, ADA, "page");
    await requestSignup(test);
    expect(await isSuppressed(test.ctx, ADA)).toBe(true);
  });

  it("replaces an unconfirmed request and its link on a repeat sign-up", async () => {
    const first = await requestSignup(test, { scopes: ["launch", "newsletter"] });
    test.clock.set(LATER);
    const second = await requestSignup(test, { email: "ADA@example.com", scopes: ["launch"] });

    expect(second.isNew).toBe(false);
    expect(second.token).not.toBe(first.token);
    expect(second.signup).toEqual({ ...first.signup, scopes: ["launch"], updatedAt: LATER });
    expect(await confirm(test, first.token)).toEqual({ ok: false, error: "waitlist.confirmation_invalid" });
    expect(await confirm(test, second.token)).toMatchObject({ ok: true, value: { recordedScopes: ["launch"], signup: { scopes: ["launch"] } } });
  });

  it("keeps a confirmed sign-up's scopes until a new request's link is used", async () => {
    await confirm(test, (await requestSignup(test)).token);
    test.clock.set(LATER);
    const request = await requestSignup(test, { scopes: ["launch", "newsletter"] });
    expect(request.signup).toMatchObject({ scopes: ["launch"], confirmedAt: NOW });
    expect((await listSignups(test.ctx, { scope: "newsletter" })).map((signup) => signup.email)).toEqual([]);

    const confirmed = await confirm(test, request.token);
    expect(confirmed).toMatchObject({ ok: true, value: { recordedScopes: ["newsletter"], isFirstConfirmation: false, signup: { scopes: ["launch", "newsletter"], confirmedAt: NOW } } });
    expect(await readLedger(test)).toEqual(["launch true waitlist", "newsletter true waitlist"]);
  });

  it("applies an unconfirmed request at once when the option was turned off since", async () => {
    await requestSignup(test, { scopes: ["launch", "newsletter"] });
    const immediate = await createTestWaitlist();
    try {
      test.clock.set(LATER);
      // The same database under a config without double opt-in.
      const joined = await joinWaitlist({ ...test.ctx, config: immediate.config }, { ...JOIN, scopes: ["launch"] });
      expect(joined).toMatchObject({ ok: true, value: { status: "joined", isNew: false, recordedScopes: ["launch"], signup: { scopes: ["launch"], confirmedAt: LATER } } });
      expect(await readLinkColumns(test)).toMatchObject({ pending_scopes: null });
    } finally {
      await immediate.database.close();
    }
  });
});

describe("confirmSignup", () => {
  let test: TestWaitlist;

  beforeEach(async () => {
    test = await createTestWaitlist(DOUBLE_OPT_IN);
  });
  afterEach(() => test.database.close());

  it("makes the sign-up count: records the consents, sets confirmedAt and lists it", async () => {
    const { token } = await requestSignup(test, { scopes: ["launch", "newsletter"] });
    test.clock.set(LATER);
    const result = await confirm(test, token);

    expect(result).toMatchObject({
      ok: true,
      value: { isFirstConfirmation: true, recordedScopes: ["launch", "newsletter"], signup: { scopes: ["launch", "newsletter"], confirmedAt: LATER, updatedAt: LATER } },
    });
    expect((await listConsentRows(test, getEmailKey(ADA))).map((row) => [row.purpose, row.document_version, row.recorded_at])).toEqual([
      ["launch", "2026-09-01", LATER],
      ["newsletter", null, LATER],
    ]);
    expect((await listSignups(test.ctx)).map((signup) => signup.email)).toEqual([ADA]);
    expect(await readLinkColumns(test)).toMatchObject({ pending_scopes: null });
  });

  it("answers a used link as confirmed again, recording nothing", async () => {
    const { token } = await requestSignup(test);
    await confirm(test, token);
    test.clock.set(new Date(EXPIRY.getTime() + HOUR_MS));
    expect(await confirm(test, token)).toMatchObject({ ok: true, value: { isFirstConfirmation: false, recordedScopes: [], signup: { confirmedAt: NOW } } });
    expect(await readLedger(test)).toEqual(["launch true waitlist"]);
  });

  it("refuses a link at its expiry and accepts it just before", async () => {
    const { token } = await requestSignup(test);
    test.clock.set(EXPIRY);
    expect(await confirm(test, token)).toEqual({ ok: false, error: "waitlist.confirmation_expired" });
    test.clock.set(new Date(EXPIRY.getTime() - 1));
    expect((await confirm(test, token)).ok).toBe(true);
  });

  it.each([
    ["an empty token", ""],
    ["a malformed token", "not-a-token"],
    ["an unknown token", "A".repeat(43)],
  ])("refuses %s", async (_case, token) => {
    await requestSignup(test);
    expect(await confirm(test, token)).toEqual({ ok: false, error: "waitlist.confirmation_invalid" });
    expect(await readLedger(test)).toEqual([]);
  });

  it("lifts the address's own opt-out and grants only the confirmed scopes", async () => {
    vi.stubEnv("MAILING_UNSUBSCRIBE_SECRET", SECRET);
    try {
      await confirm(test, (await requestSignup(test, { scopes: ["launch", "newsletter"] })).token);
      const key = getRecipientKey(ADA);
      await unsubscribe(test.ctx, { recipientKey: key, signature: signRecipientKey(key, SECRET) }, "page", { MAILING_UNSUBSCRIBE_SECRET: SECRET });
      test.clock.set(LATER);
      const request = await requestSignup(test, { scopes: ["launch"] });
      expect(await isSuppressed(test.ctx, ADA)).toBe(true);

      expect(await confirm(test, request.token)).toMatchObject({ ok: true, value: { recordedScopes: ["launch"], signup: { scopes: ["launch"] } } });
      expect(await isSuppressed(test.ctx, ADA)).toBe(false);
      expect(await readLedger(test)).toEqual([
        "launch true waitlist",
        "newsletter true waitlist",
        "launch false unsubscribe",
        "newsletter false unsubscribe",
        "launch true waitlist",
      ]);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("counts confirmations against the client's waitlist bucket", async () => {
    await test.database.close();
    test = await createTestWaitlist({ ...DOUBLE_OPT_IN, buckets: { waitlist: { limit: 2, windowMinutes: 15 }, "waitlist-email": { limit: 3, windowMinutes: 60 } } });
    const { token } = await requestSignup(test);
    expect((await confirm(test, token)).ok).toBe(true);
    expect(await confirm(test, token)).toMatchObject({ ok: false, error: "security.rate_limited" });
  });
});

describe("pruneUnconfirmedSignups", () => {
  let test: TestWaitlist;

  beforeEach(async () => {
    test = await createTestWaitlist(DOUBLE_OPT_IN);
  });
  afterEach(() => test.database.close());

  it("deletes sign-ups whose link expired unused and drops expired links of confirmed ones", async () => {
    await confirm(test, (await requestSignup(test)).token);
    await requestSignup(test, { scopes: ["launch", "newsletter"] });
    await requestSignup(test, { email: "bob@example.com" });
    test.clock.set(new Date(NOW.getTime() + 24 * HOUR_MS));
    await requestSignup(test, { email: "cyd@example.com" });

    test.clock.set(EXPIRY);
    expect(await pruneUnconfirmedSignups(test.ctx)).toBe(1);
    expect(await getSignup(test.ctx, "bob@example.com")).toBeNull();
    expect(await getSignup(test.ctx, "cyd@example.com")).toMatchObject({ confirmedAt: null });
    expect(await readLinkColumns(test)).toEqual({ pending_scopes: null, confirmation_token_hash: null, confirmation_expires_at: null });
    expect((await getSignup(test.ctx, ADA))?.scopes).toEqual(["launch"]);
  });
});

describe("the double opt-in mails", () => {
  let test: TestWaitlist;

  afterEach(async () => {
    vi.unstubAllEnvs();
    await test.database.close();
  });

  it("mails the link as transactional mail, which reaches an address that opted out", async () => {
    test = await createTestWaitlist(DOUBLE_OPT_IN);
    await suppressRecipient(test.ctx, ADA);
    const { signup, token } = await requestSignup(test);
    expect((await deliverConfirmationMail(test.ctx, signup, token)).ok).toBe(true);

    const [mail, ...rest] = test.provider.sent;
    expect(rest).toEqual([]);
    expect(mail?.to).toBe(ADA);
    expect(mail?.subject).toBe(waitlistMessages.en.confirmationMail.subject);
    expect(mail?.text).toBe(`${waitlistMessages.en.confirmationMail.text}\n\nhttps://app.example.com/waitlist/confirm?token=${token}`);
    expect(mail?.headers["List-Unsubscribe"]).toBeUndefined();
    const copy = waitlistMessages.en.confirmationMail;
    expect(mail?.html).toBe(
      [
        "<p>Hello,</p>",
        `<p>${copy.text.split("\n\n")[1] ?? ""}</p>`,
        `<p><a href="https://app.example.com/waitlist/confirm?token=${token}">${copy.action}</a></p>`,
      ].join("\n"),
    );
  });

  it("hands the app's mailTemplate the link and its label", async () => {
    const inputs: WaitlistMailTemplateInput[] = [];
    const mailTemplate = (mail: WaitlistMailTemplateInput): string => {
      inputs.push(mail);
      return mail.kind === "confirmation" ? `<a class="button" href="${mail.action.href}">${mail.action.label}</a>` : mail.body;
    };
    test = await createTestWaitlist({ locale: "pl", waitlist: { ...OPTIONS, doubleOptIn: true, mailTemplate } });
    const { signup, token } = await requestSignup(test);
    expect((await deliverConfirmationMail(test.ctx, signup, token)).ok).toBe(true);

    const copy = waitlistMessages.pl.confirmationMail;
    const href = `https://app.example.com/waitlist/confirm?token=${token}`;
    expect(inputs).toHaveLength(1);
    expect(inputs[0]).toMatchObject({ kind: "confirmation", locale: "pl", subject: copy.subject, action: { href, label: copy.action } });
    expect(inputs[0]?.body.endsWith(`<p><a href="${href}">${copy.action}</a></p>`)).toBe(true);
    expect(test.provider.sent[0]?.html).toBe(`<a class="button" href="${href}">${copy.action}</a>`);
    expect(test.provider.sent[0]?.text).toBe(`${copy.text}\n\n${href}`);
  });

  it("writes in the sign-up's locale and follows a moved confirmation page", async () => {
    test = await createTestWaitlist({ locale: "pl", waitlist: { ...OPTIONS, doubleOptIn: true, routes: { confirm: "/dolacz" } } });
    const { signup, token } = await requestSignup(test);
    expect(getConfirmationLink(test.config, token)).toBe(`https://app.example.com/dolacz?token=${token}`);
    await deliverConfirmationMail(test.ctx, signup, token);
    expect(test.provider.sent[0]?.subject).toBe(waitlistMessages.pl.confirmationMail.subject);
  });

  it("sends no welcome mail before the confirmation, and one after", async () => {
    vi.stubEnv("MAILING_UNSUBSCRIBE_SECRET", SECRET);
    test = await createTestWaitlist(DOUBLE_OPT_IN);
    const { signup, token } = await requestSignup(test);
    expect(await deliverWelcomeMail(test.ctx, signup)).toEqual({ status: "skipped" });
    const confirmed = await confirm(test, token);
    const confirmedSignup: WaitlistSignup | undefined = confirmed.ok ? confirmed.value.signup : undefined;
    expect(confirmedSignup).toBeDefined();
    if (confirmedSignup === undefined) return;
    expect(await deliverWelcomeMail(test.ctx, confirmedSignup)).toMatchObject({ status: "sent" });
    expect(test.provider.sent.map((mail) => mail.subject)).toEqual([waitlistMessages.en.welcomeMail.subject]);
  });
});
