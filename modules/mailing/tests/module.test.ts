// The module definition: its manifest and the options an app passes in softure.config.ts.
import { readFileSync } from "node:fs";
import { defineSoftureConfig, toModuleJson } from "@softure-ai/core";
import { DEFAULT_TIMEOUT_MS, mailing, resend } from "@softure-ai/mailing";
import { getMailingOptions } from "@softure-ai/mailing/server";
import { fakeMailProvider } from "@softure-ai/mailing/testing";
import { describe, expect, it } from "vitest";
import { FROM, REPLY_TO } from "./support.js";

describe("the mailing module", () => {
  it("ships a module.json equal to its manifest", () => {
    const moduleJson: unknown = JSON.parse(readFileSync(new URL("../module.json", import.meta.url), "utf8"));
    expect(moduleJson).toEqual(toModuleJson(mailing));
  });

  it("keeps the package version and the manifest version in step", () => {
    const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string };
    expect(mailing.manifest.version).toBe(manifest.version);
  });

  it("needs no database and no other module", () => {
    expect(mailing.manifest.dbSchema).toBeNull();
    expect(mailing.manifest.dependsOn).toEqual({});
  });

  it("keeps the options it was given and defaults the timeout to ten seconds", () => {
    const provider = resend({ apiKey: "re_test" });
    expect(mailing({ from: FROM, replyTo: REPLY_TO, provider }).options).toEqual({ from: FROM, replyTo: REPLY_TO, provider, timeoutMs: 10_000 });
    expect(DEFAULT_TIMEOUT_MS).toBe(10_000);
  });

  it("accepts a bare address as the sender and no reply-to", () => {
    const options = mailing({ from: "hello@mail.example.com", provider: fakeMailProvider() }).options;
    expect(options.from).toBe("hello@mail.example.com");
    expect(options.replyTo).toBeUndefined();
  });

  it("refuses options it cannot send with, listing every problem", () => {
    expect(() =>
      mailing({
        from: "Example <hello@example.com>, eve@example.com",
        replyTo: "a@example.com; b@example.com",
        // @ts-expect-error: a JavaScript config can pass something that is not a provider.
        provider: { send: "nope" },
        timeoutMs: 500,
      }),
    ).toThrow(
      [
        'Invalid SOFTURE configuration in module "mailing":',
        "- options.from: must be an address or Name <address>, e.g. Plan <hello@example.com>",
        "- options.replyTo: must be one address, e.g. support@example.com",
        "- options.provider: must be a mail provider such as resend()",
        "- options.timeoutMs: Too small: expected number to be >=1000",
      ].join("\n"),
    );
  });

  it.each([
    ["a sender with a line break", "Example <hello@example.com>\r\nBcc: eve@example.com"],
    ["a sender without a domain", "hello"],
    ["a display name without an address", "Example <>"],
  ])("refuses %s", (_case, from) => {
    expect(() => mailing({ from, provider: fakeMailProvider() })).toThrow("options.from");
  });

  it("refuses an unknown option, so a typo does not go unnoticed", () => {
    // @ts-expect-error: `replyto` is not an option.
    expect(() => mailing({ from: FROM, provider: fakeMailProvider(), replyto: REPLY_TO })).toThrow('options: Unrecognized key: "replyto"');
  });

  it("reads its options from a configuration and fails loudly when the app did not enable it", () => {
    const provider = fakeMailProvider();
    const config = defineSoftureConfig({ locale: "en", timezone: "UTC", appOrigin: "http://localhost:3000", modules: [mailing({ from: FROM, provider })] });
    expect(getMailingOptions(config).provider).toBe(provider);
    const empty = defineSoftureConfig({ locale: "en", timezone: "UTC", appOrigin: "http://localhost:3000", modules: [] });
    expect(() => getMailingOptions(empty)).toThrow("@softure-ai/mailing: the module is not enabled");
  });
});
