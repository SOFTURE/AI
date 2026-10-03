import { auth, AUTH_RATE_LIMIT_BUCKETS, authMessages, type AuthUser } from "@softure-ai/auth";
import { mailingResetSender, renderPasswordResetMail } from "@softure-ai/auth/mailing";
import { deliverPasswordReset, registerUser } from "@softure-ai/auth/server";
import { createTestClock, defineSoftureConfig, formatMessage, type SoftureConfig } from "@softure-ai/core";
import { clearSoftureConfig, registerSoftureConfig } from "@softure-ai/core/next";
import { createTestDatabase } from "@softure-ai/db/testing";
import { mailing, type ProviderOutcome } from "@softure-ai/mailing";
import { fakeMailProvider, type FakeMailProvider } from "@softure-ai/mailing/testing";
import { headerIp, security } from "@softure-ai/security";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CLIENT, FAST_SCRYPT, NOW, PASSWORD } from "./support.js";

const LINK = "https://app.example.com/reset-password?token=AbC_123-xyz";
const USER: AuthUser = { id: "00000000-0000-4000-8000-000000000001", email: "ada@example.com", createdAt: NOW };
const FROM = "Plan <hello@mail.example.com>";

/** The Polish expiry line for `count` minutes in the plural form `form` (one, few or many). */
function plExpiry(form: "one" | "few" | "many", count: number): string {
  const copy = authMessages.pl.resetMail;
  return formatMessage(copy.expiry, { duration: formatMessage(copy.minutes[form], { count }) });
}

interface SetupOptions {
  readonly locale?: "en" | "pl";
  readonly ttlMinutes?: number;
  readonly messages?: NonNullable<Parameters<typeof auth>[0]>["messages"];
  readonly respond?: (message: unknown) => Exclude<ProviderOutcome, { status: "sent" }> | undefined;
}

function setUp(options: SetupOptions = {}): { config: SoftureConfig; provider: FakeMailProvider } {
  const provider = fakeMailProvider(options.respond === undefined ? {} : { respond: options.respond });
  const config = defineSoftureConfig({
    database: { url: "pglite://" },
    locale: options.locale ?? "en",
    timezone: "Europe/Warsaw",
    appOrigin: "https://app.example.com",
    modules: [
      security({ clientIp: headerIp("x-real-ip"), buckets: { ...AUTH_RATE_LIMIT_BUCKETS }, cleanupProbability: 0 }),
      auth({
        password: { scrypt: FAST_SCRYPT },
        passwordReset: { send: mailingResetSender(), ...(options.ttlMinutes === undefined ? {} : { ttlMinutes: options.ttlMinutes }) },
        ...(options.messages === undefined ? {} : { messages: options.messages }),
      }),
      mailing({ from: FROM, provider }),
    ],
  });
  registerSoftureConfig(config);
  return { config, provider };
}

function sendWith(config: SoftureConfig): Promise<void> {
  const send = mailingResetSender();
  return send(LINK, USER, { expiresAt: new Date(NOW.getTime() + 60 * 60 * 1000), locale: config.locale });
}

afterEach(() => {
  clearSoftureConfig();
  vi.restoreAllMocks();
});

describe("renderPasswordResetMail", () => {
  it("renders the English mail with the bare link in text and an anchor in HTML", () => {
    expect(renderPasswordResetMail(authMessages.en, "en", { link: LINK, ttlMinutes: 60 })).toEqual({
      subject: "Reset your password",
      text: [
        "Hello,",
        "We got a request to reset the password of your account. Open this link to set a new one:",
        LINK,
        "The link works for 60 minutes and only once.",
        "If you did not ask for this, ignore this mail: your password stays as it is.",
      ].join("\n\n"),
      html: [
        "<p>Hello,</p>",
        "<p>We got a request to reset the password of your account. Open this link to set a new one:</p>",
        `<p><a href="${LINK}">Set a new password</a></p>`,
        "<p>The link works for 60 minutes and only once.</p>",
        "<p>If you did not ask for this, ignore this mail: your password stays as it is.</p>",
      ].join("\n"),
    });
  });

  it("renders the Polish mail with the Polish plural of minutes", () => {
    const mail = renderPasswordResetMail(authMessages.pl, "pl", { link: LINK, ttlMinutes: 60 });
    expect(mail.subject).toBe(authMessages.pl.resetMail.subject);
    expect(mail.text.split("\n\n")).toEqual([
      authMessages.pl.resetMail.greeting,
      authMessages.pl.resetMail.intro,
      LINK,
      plExpiry("many", 60),
      authMessages.pl.resetMail.ignore,
    ]);
    expect(renderPasswordResetMail(authMessages.pl, "pl", { link: LINK, ttlMinutes: 22 }).text).toContain(plExpiry("few", 22));
    expect(renderPasswordResetMail(authMessages.pl, "pl", { link: LINK, ttlMinutes: 1 }).text).toContain(plExpiry("one", 1));
  });

  it("uses the singular in English for one minute", () => {
    expect(renderPasswordResetMail(authMessages.en, "en", { link: LINK, ttlMinutes: 1 }).text).toContain("The link works for 1 minute and only once.");
  });

  it("escapes copy and the link in HTML and keeps them verbatim in text", () => {
    const messages = { ...authMessages.en, resetMail: { ...authMessages.en.resetMail, action: `Go <b>"now"</b> & 'here'` } };
    const link = `${LINK}&x="><script>`;
    const mail = renderPasswordResetMail(messages, "en", { link, ttlMinutes: 60 });
    expect(mail.html).toContain(
      '<p><a href="https://app.example.com/reset-password?token=AbC_123-xyz&amp;x=&quot;&gt;&lt;script&gt;">Go &lt;b&gt;&quot;now&quot;&lt;/b&gt; &amp; &#39;here&#39;</a></p>',
    );
    expect(mail.html).not.toContain("<script>");
    expect(mail.text).toContain(link);
  });
});

describe("mailingResetSender", () => {
  it("sends the reset mail to the account's address through the mailing provider, with no extra headers", async () => {
    const { config, provider } = setUp();
    await sendWith(config);
    expect(provider.sent).toEqual([
      {
        id: expect.stringMatching(/^fake-1-/) as unknown,
        from: FROM,
        to: USER.email,
        replyTo: null,
        ...renderPasswordResetMail(authMessages.en, "en", { link: LINK, ttlMinutes: 60 }),
        headers: {},
        idempotencyKey: null,
      },
    ]);
  });

  it("writes in the locale it is given, with the configured link lifetime", async () => {
    const { config, provider } = setUp({ locale: "pl", ttlMinutes: 30 });
    await sendWith(config);
    expect(provider.sent[0]?.subject).toBe(authMessages.pl.resetMail.subject);
    expect(provider.sent[0]?.text).toContain(plExpiry("many", 30));
  });

  it("applies the app's copy overrides", async () => {
    const { config, provider } = setUp({ messages: { en: { resetMail: { subject: "Your Acme password" } } } });
    await sendWith(config);
    expect(provider.sent[0]?.subject).toBe("Your Acme password");
    expect(provider.sent[0]?.text).toContain(LINK);
  });

  it.each([
    ["rejected", { status: "rejected", httpStatus: 422 }],
    ["unavailable", { status: "unavailable", httpStatus: 503 }],
  ] as const)("throws naming mailing.%s, without the address or the link", async (code, outcome) => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { config, provider } = setUp({ respond: () => outcome });
    const failure = await sendWith(config).then(
      () => null,
      (error: unknown) => error,
    );
    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toBe(`@softure-ai/auth: the password reset mail was not sent (mailing.${code})`);
    expect((failure as Error).message).not.toContain(USER.email);
    expect(provider.sent).toEqual([]);
  });

  it("throws when the app did not enable mailing", async () => {
    const config = defineSoftureConfig({
      database: { url: "pglite://" },
      locale: "en",
      timezone: "Europe/Warsaw",
      appOrigin: "https://app.example.com",
      modules: [
        security({ clientIp: headerIp("x-real-ip"), buckets: { ...AUTH_RATE_LIMIT_BUCKETS }, cleanupProbability: 0 }),
        auth({ passwordReset: { send: mailingResetSender() } }),
      ],
    });
    registerSoftureConfig(config);
    await expect(sendWith(config)).rejects.toThrow("@softure-ai/mailing: the module is not enabled");
  });
});

describe("password reset through mailing", () => {
  it("mails a working reset link for an existing account and nothing for an unknown email", async () => {
    const { config, provider } = setUp();
    const database = await createTestDatabase(config.modules);
    try {
      const ctx = { db: database.db, clock: createTestClock(NOW), config };
      const registered = await registerUser(ctx, { email: USER.email, password: PASSWORD, hasConsented: true, clientKey: CLIENT });
      expect(registered.ok).toBe(true);

      expect(await deliverPasswordReset(ctx, "nobody@example.com")).toBe("no_account");
      expect(provider.sent).toEqual([]);

      expect(await deliverPasswordReset(ctx, USER.email)).toBe("sent");
      expect(provider.sent).toHaveLength(1);
      const mail = provider.sent[0];
      expect(mail?.to).toBe(USER.email);
      const link = mail?.text.split("\n\n")[2] ?? "";
      expect(link).toMatch(/^https:\/\/app\.example\.com\/reset-password\?token=[A-Za-z0-9_-]{43}$/);
      expect(mail?.html).toContain(`href="${link}"`);
    } finally {
      await database.close();
    }
  });
});
