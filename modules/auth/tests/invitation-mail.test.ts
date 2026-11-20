// The invitation mail and its mailing sender: copy from the dictionaries, the link placed by the code, escaped HTML.
import { auth, AUTH_RATE_LIMIT_BUCKETS, authMessages } from "@softure-ai/auth";
import { mailingInvitationSender, renderInvitationMail } from "@softure-ai/auth/mailing";
import { defineSoftureConfig, type SoftureConfig } from "@softure-ai/core";
import { clearSoftureConfig, registerSoftureConfig } from "@softure-ai/core/next";
import { mailing, type ProviderOutcome } from "@softure-ai/mailing";
import { fakeMailProvider, type FakeMailProvider } from "@softure-ai/mailing/testing";
import { headerIp, security } from "@softure-ai/security";
import { afterEach, describe, expect, it } from "vitest";
import { FAST_SCRYPT, NOW } from "./support.js";

const LINK = "https://app.example.com/register?invitation=AbC_123-xyz";
const FROM = "Plan <hello@mail.example.com>";
const DETAILS = { expiresAt: new Date(NOW.getTime() + 72 * 60 * 60 * 1000), locale: "en", roles: ["editor"] } as const;

function setUp(respond?: (message: unknown) => Exclude<ProviderOutcome, { status: "sent" }> | undefined): { config: SoftureConfig; provider: FakeMailProvider } {
  const provider = fakeMailProvider(respond === undefined ? {} : { respond });
  const config = defineSoftureConfig({
    database: { url: "pglite://" },
    locale: "en",
    timezone: "Europe/Warsaw",
    appOrigin: "https://app.example.com",
    modules: [
      security({ clientIp: headerIp("x-real-ip"), buckets: { ...AUTH_RATE_LIMIT_BUCKETS }, cleanupProbability: 0 }),
      auth({ password: { scrypt: FAST_SCRYPT }, invitations: { send: mailingInvitationSender() } }),
      mailing({ from: FROM, provider }),
    ],
  });
  registerSoftureConfig(config);
  return { config, provider };
}

afterEach(() => {
  clearSoftureConfig();
});

describe("renderInvitationMail", () => {
  it("renders the English mail with the bare link in text and an anchor in HTML", () => {
    expect(renderInvitationMail(authMessages.en, "en", { link: LINK, ttlHours: 72 })).toEqual({
      subject: "You are invited to create an account",
      text: [
        "Hello,",
        "You have been invited to create an account. Open this link to choose a password:",
        LINK,
        "The link works for 72 hours and only once.",
        "If you did not expect this invitation, ignore this mail: no account is created without the link.",
      ].join("\n\n"),
      html: [
        "<p>Hello,</p>",
        "<p>You have been invited to create an account. Open this link to choose a password:</p>",
        `<p><a href="${LINK}">Accept the invitation</a></p>`,
        "<p>The link works for 72 hours and only once.</p>",
        "<p>If you did not expect this invitation, ignore this mail: no account is created without the link.</p>",
      ].join("\n"),
    });
    expect(renderInvitationMail(authMessages.en, "en", { link: LINK, ttlHours: 1 }).text).toContain("The link works for 1 hour and only once.");
  });

  it("reads the English copy for a dictionary written before invitations, and escapes HTML", () => {
    const older = Object.fromEntries(Object.entries(authMessages.en).filter(([key]) => key !== "invitationMail")) as Omit<typeof authMessages.en, "invitationMail">;
    expect(renderInvitationMail(older, "en", { link: LINK, ttlHours: 72 }).subject).toBe("You are invited to create an account");
    const link = `${LINK}&x="><script>`;
    const mail = renderInvitationMail(authMessages.en, "en", { link, ttlHours: 72 });
    expect(mail.html).not.toContain("<script>");
    expect(mail.text).toContain(link);
  });
});

describe("mailingInvitationSender", () => {
  it("sends the invitation mail to the invited address through the mailing provider", async () => {
    const { provider } = setUp();
    await mailingInvitationSender()(LINK, { email: "grace@example.com" }, DETAILS);
    expect(provider.sent).toHaveLength(1);
    expect(provider.sent[0]).toMatchObject({ to: "grace@example.com", from: FROM, ...renderInvitationMail(authMessages.en, "en", { link: LINK, ttlHours: 72 }) });
  });

  it("throws an error naming the mailing code, never the address or the link", async () => {
    setUp(() => ({ status: "rejected", httpStatus: 422 }));
    const failure = mailingInvitationSender()(LINK, { email: "grace@example.com" }, DETAILS);
    await expect(failure).rejects.toThrow(/invitation mail was not sent/);
    await expect(failure).rejects.not.toThrow(/grace@example.com|AbC_123/);
  });
});
