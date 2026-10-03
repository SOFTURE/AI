// Signed unsubscribe links: the recipient key, the signature, rotation and the two URLs.
import { createHash, createHmac } from "node:crypto";
import {
  buildUnsubscribeLinks,
  getRecipientKey,
  readUnsubscribeSecrets,
  readUnsubscribeToken,
  signRecipientKey,
  verifyUnsubscribeToken,
  type UnsubscribeSecrets,
} from "@softure-ai/mailing/server";
import { fakeMailProvider } from "@softure-ai/mailing/testing";
import { describe, expect, it } from "vitest";
import { createConfig, PREVIOUS_SECRET, SECRET } from "./support.js";

const ADA_KEY = createHash("sha256").update("ada@example.org").digest("base64url");
const CURRENT: UnsubscribeSecrets = { current: SECRET, previous: null };

describe("getRecipientKey", () => {
  it("is the unpadded base64url SHA-256 of the address", () => {
    expect(getRecipientKey("ada@example.org")).toBe(ADA_KEY);
    expect(ADA_KEY).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("ignores case and surrounding spaces, so Ada@ and ada@ are one recipient", () => {
    expect(getRecipientKey("  Ada@Example.ORG ")).toBe(ADA_KEY);
  });

  it("differs per address", () => {
    expect(getRecipientKey("bob@example.org")).not.toBe(ADA_KEY);
  });
});

describe("signRecipientKey and verifyUnsubscribeToken", () => {
  it("signs with HMAC-SHA256 over a prefixed key, in base64url", () => {
    const expected = createHmac("sha256", SECRET).update(`softure.mailing.unsubscribe.v1:${ADA_KEY}`).digest("base64url");
    expect(signRecipientKey(ADA_KEY, SECRET)).toBe(expected);
  });

  it("accepts a token signed with the current secret", () => {
    expect(verifyUnsubscribeToken({ recipientKey: ADA_KEY, signature: signRecipientKey(ADA_KEY, SECRET) }, CURRENT)).toBe(true);
  });

  it("accepts a token signed with the previous secret during a rotation, and refuses it afterwards", () => {
    const token = { recipientKey: ADA_KEY, signature: signRecipientKey(ADA_KEY, PREVIOUS_SECRET) };
    expect(verifyUnsubscribeToken(token, { current: SECRET, previous: PREVIOUS_SECRET })).toBe(true);
    expect(verifyUnsubscribeToken(token, CURRENT)).toBe(false);
  });

  it("refuses a signature from another secret or for another recipient", () => {
    expect(verifyUnsubscribeToken({ recipientKey: ADA_KEY, signature: signRecipientKey(ADA_KEY, "x".repeat(32)) }, CURRENT)).toBe(false);
    const bobKey = getRecipientKey("bob@example.org");
    expect(verifyUnsubscribeToken({ recipientKey: bobKey, signature: signRecipientKey(ADA_KEY, SECRET) }, CURRENT)).toBe(false);
  });

  it("refuses a bare HMAC of the key without the prefix, so the key cannot sign for other purposes", () => {
    const unprefixed = createHmac("sha256", SECRET).update(ADA_KEY).digest("base64url");
    expect(verifyUnsubscribeToken({ recipientKey: ADA_KEY, signature: unprefixed }, CURRENT)).toBe(false);
  });

  it.each([
    ["an empty signature", ADA_KEY, ""],
    ["a hex signature", ADA_KEY, "ab".repeat(32)],
    ["a padded signature", ADA_KEY, `${"a".repeat(43)}=`],
    ["a signature of 42 characters", ADA_KEY, "a".repeat(42)],
    ["a key of 44 characters", `${ADA_KEY}a`, "a".repeat(43)],
    ["a plain address as the key", "ada@example.org", "a".repeat(43)],
  ])("refuses %s without throwing", (_case, recipientKey, signature) => {
    expect(verifyUnsubscribeToken({ recipientKey, signature }, CURRENT)).toBe(false);
  });

  it("refuses everything when no secret is set", () => {
    const token = { recipientKey: ADA_KEY, signature: signRecipientKey(ADA_KEY, SECRET) };
    expect(verifyUnsubscribeToken(token, { current: null, previous: null })).toBe(false);
  });
});

describe("readUnsubscribeSecrets", () => {
  it("reads both variables", () => {
    expect(readUnsubscribeSecrets({ MAILING_UNSUBSCRIBE_SECRET: SECRET, MAILING_UNSUBSCRIBE_SECRET_PREVIOUS: PREVIOUS_SECRET })).toEqual({
      current: SECRET,
      previous: PREVIOUS_SECRET,
    });
  });

  it("treats a secret shorter than 32 characters, or none, as not set", () => {
    expect(readUnsubscribeSecrets({ MAILING_UNSUBSCRIBE_SECRET: SECRET.slice(1), MAILING_UNSUBSCRIBE_SECRET_PREVIOUS: "" })).toEqual({
      current: null,
      previous: null,
    });
    expect(readUnsubscribeSecrets({})).toEqual({ current: null, previous: null });
  });
});

describe("buildUnsubscribeLinks", () => {
  const signature = signRecipientKey(ADA_KEY, SECRET);

  it("points the page and the one-click route at the app's origin, without the address", () => {
    const links = buildUnsubscribeLinks(createConfig(fakeMailProvider()), "Ada@example.org", SECRET);
    expect(links).toEqual({
      page: `https://app.example.com/unsubscribe?r=${ADA_KEY}&t=${signature}`,
      oneClick: `https://app.example.com/api/mailing/unsubscribe?r=${ADA_KEY}&t=${signature}`,
    });
    expect(links.page).not.toContain("ada");
  });

  it("follows the app's route overrides", () => {
    const config = createConfig(fakeMailProvider(), { mailingInput: { from: "hello@mail.example.com", provider: fakeMailProvider(), routes: { unsubscribe: "/opt-out", oneClick: "/api/opt-out" } } });
    const links = buildUnsubscribeLinks(config, "ada@example.org", SECRET);
    expect(links.page).toBe(`https://app.example.com/opt-out?r=${ADA_KEY}&t=${signature}`);
    expect(links.oneClick).toBe(`https://app.example.com/api/opt-out?r=${ADA_KEY}&t=${signature}`);
  });

  it("round-trips: the token read back from either link verifies", () => {
    const links = buildUnsubscribeLinks(createConfig(fakeMailProvider()), "ada@example.org", SECRET);
    for (const link of [links.page, links.oneClick]) {
      const token = readUnsubscribeToken(new URL(link).searchParams);
      expect(token).toEqual({ recipientKey: ADA_KEY, signature });
      expect(token !== null && verifyUnsubscribeToken(token, CURRENT)).toBe(true);
    }
  });
});

describe("readUnsubscribeToken", () => {
  it("reads r and t from a query or a form", () => {
    const form = new FormData();
    form.set("r", "key");
    form.set("t", "sig");
    expect(readUnsubscribeToken(form)).toEqual({ recipientKey: "key", signature: "sig" });
    expect(readUnsubscribeToken(new URLSearchParams("r=key&t=sig"))).toEqual({ recipientKey: "key", signature: "sig" });
  });

  it("is null when a parameter is missing or a form value is a file", () => {
    expect(readUnsubscribeToken(new URLSearchParams("r=key"))).toBeNull();
    const form = new FormData();
    form.set("r", new Blob(["key"]));
    form.set("t", "sig");
    expect(readUnsubscribeToken(form)).toBeNull();
  });
});
