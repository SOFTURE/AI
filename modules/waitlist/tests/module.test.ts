// The module definition: its manifest, its options, its dependencies and its health check.
import { readFileSync } from "node:fs";
import { defineSoftureConfig, toModuleJson } from "@softure-ai/core";
import { mailing } from "@softure-ai/mailing";
import { fakeMailProvider } from "@softure-ai/mailing/testing";
import { headerIp, security } from "@softure-ai/security";
import { waitlist, WAITLIST_RATE_LIMIT_BUCKETS } from "@softure-ai/waitlist";
import { checkSignupsTable } from "@softure-ai/waitlist/server";
import { describe, expect, it } from "vitest";
import { createTestWaitlist, OPTIONS } from "./support.js";

const LABEL = { en: "Tell me when it opens." };

describe("the waitlist module", () => {
  it("ships a module.json equal to its manifest", () => {
    const moduleJson: unknown = JSON.parse(readFileSync(new URL("../module.json", import.meta.url), "utf8"));
    expect(moduleJson).toEqual(toModuleJson(waitlist));
  });

  it("keeps the package version and the manifest version in step", () => {
    const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string };
    expect(waitlist.manifest.version).toBe(manifest.version);
  });

  it("fills in the defaults: optional scopes, one default placement, the welcome mail on", () => {
    expect(waitlist({ scopes: [{ id: "launch", label: LABEL }] }).options).toEqual({
      scopes: [{ id: "launch", required: false, label: LABEL }],
      placements: ["default"],
      welcomeMail: true,
      doubleOptIn: null,
    });
    expect(waitlist(OPTIONS).options.scopes.map((scope) => [scope.id, scope.required, scope.document])).toEqual([
      ["launch", true, "privacy-policy"],
      ["newsletter", false, undefined],
    ]);
  });

  it("refuses scopes and placements it cannot store, listing every problem", () => {
    expect(() =>
      waitlist({
        scopes: [
          { id: "Launch", label: LABEL },
          { id: "news", label: { pl: "Nowosci" } },
          { id: "news", document: "Privacy Policy", label: LABEL },
        ],
        placements: ["hero", "hero", "side bar"],
      }),
    ).toThrow(
      [
        'Invalid SOFTURE configuration in module "waitlist":',
        "- options.scopes.0.id: must be kebab-case, e.g. launch-news",
        "- options.scopes.1.label: needs at least an en text",
        "- options.scopes.2.document: must be kebab-case, e.g. launch-news",
        "- options.placements.2: must be kebab-case, e.g. launch-news",
      ].join("\n"),
    );
    expect(() => waitlist({ scopes: [] })).toThrow("- options.scopes: needs at least one scope");
    expect(() => waitlist({ scopes: [{ id: "news", label: LABEL }, { id: "news", label: LABEL }], placements: ["hero", "hero"] })).toThrow(
      ['- options.scopes.1.id: "news" is listed twice', '- options.placements.1: "hero" is listed twice'].join("\n"),
    );
  });

  it("parses double opt-in to null or its link expiry, 7 days unless set", () => {
    const scopes = [{ id: "launch", label: LABEL }];
    expect(waitlist({ scopes, doubleOptIn: false }).options.doubleOptIn).toBeNull();
    expect(waitlist({ scopes, doubleOptIn: true }).options.doubleOptIn).toEqual({ expiresInHours: 168 });
    expect(waitlist({ scopes, doubleOptIn: {} }).options.doubleOptIn).toEqual({ expiresInHours: 168 });
    expect(waitlist({ scopes, doubleOptIn: { expiresInHours: 24 } }).options.doubleOptIn).toEqual({ expiresInHours: 24 });
    expect(() => waitlist({ scopes, doubleOptIn: { expiresInHours: 721 } })).toThrow("options.doubleOptIn.expiresInHours");
    expect(() => waitlist({ scopes, doubleOptIn: { expiresInHours: 0 } })).toThrow("options.doubleOptIn.expiresInHours");
  });

  it("takes a mailTemplate function and refuses anything else", () => {
    const scopes = [{ id: "launch", label: LABEL }];
    const mailTemplate = () => "<p>Hi</p>";
    expect(waitlist({ scopes, mailTemplate }).options.mailTemplate).toBe(mailTemplate);
    // @ts-expect-error: a string is not a template function.
    expect(() => waitlist({ scopes, mailTemplate: "<p>Hi</p>" })).toThrow("options.mailTemplate: must be a function");
  });

  it("declares the confirmation page, whose path the app can move", () => {
    expect(waitlist({ scopes: [{ id: "launch", label: LABEL }] }).routes).toEqual({ confirm: "/waitlist/confirm" });
    expect(waitlist({ scopes: [{ id: "launch", label: LABEL }], routes: { confirm: "/join/confirm" } }).routes).toEqual({ confirm: "/join/confirm" });
  });

  it("needs security, mailing and privacy in the config", () => {
    expect(() =>
      defineSoftureConfig({
        database: { url: "pglite://" },
        locale: "en",
        timezone: "UTC",
        appOrigin: "https://app.example.com",
        modules: [security({ clientIp: headerIp("x-real-ip"), buckets: WAITLIST_RATE_LIMIT_BUCKETS }), mailing({ from: "hello@example.com", provider: fakeMailProvider() }), waitlist(OPTIONS)],
      }),
    ).toThrow('module "waitlist" needs module "privacy" (^0.1.0), which is not listed');
  });

  it("reports healthy once its table exists", async () => {
    const test = await createTestWaitlist();
    try {
      expect(await checkSignupsTable(test.ctx)).toEqual({ ok: true, value: undefined });
      await test.database.client.exec("DROP TABLE waitlist.signups");
      await expect(checkSignupsTable(test.ctx)).rejects.toThrow();
    } finally {
      await test.database.close();
    }
  });
});
