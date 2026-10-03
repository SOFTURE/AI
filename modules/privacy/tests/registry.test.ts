// The registry: which contributors take part, and in which order they export and delete.
import { defineSoftureConfig, ok } from "@softure-ai/core";
import { getDeletingContributors, getExportingContributors, getPrivacyContributors } from "@softure-ai/privacy/server";
import { describe, expect, it } from "vitest";
import { createConfig, profileContributor } from "./support.js";

const ids = (contributors: readonly { id: string }[]) => contributors.map((contributor) => contributor.id);

describe("the privacy registry", () => {
  it("lists every enabled module with user data, in dependency order, then the app's contributors", () => {
    const contributors = getPrivacyContributors(createConfig());
    expect(contributors.map((contributor) => `${contributor.source}:${contributor.id}`)).toEqual([
      "module:auth",
      "module:feature-switches",
      "module:notes",
      "app:profile",
    ]);
  });

  it("leaves out modules without user data", () => {
    expect(ids(getPrivacyContributors(createConfig()))).not.toContain("security");
    expect(ids(getPrivacyContributors(createConfig()))).not.toContain("privacy");
  });

  it("exports in registry order and deletes in reverse: the app first, auth last", () => {
    const config = createConfig();
    expect(ids(getExportingContributors(config))).toEqual(["auth", "feature-switches", "notes", "profile"]);
    expect(ids(getDeletingContributors(config))).toEqual(["profile", "notes", "feature-switches", "auth"]);
  });

  it("keeps an export-only or delete-only app contributor out of the other list", () => {
    const config = createConfig({
      contributors: [
        { id: "stats", exportUserData: () => Promise.resolve(ok({ visits: 3 })) },
        { id: "cache", deleteUserData: () => Promise.resolve(ok()) },
      ],
    });
    expect(ids(getExportingContributors(config))).toEqual(["auth", "feature-switches", "notes", "stats"]);
    expect(ids(getDeletingContributors(config))).toEqual(["cache", "notes", "feature-switches", "auth"]);
  });

  it("refuses an app contributor with the id of an enabled module", () => {
    const config = createConfig({ contributors: [{ ...profileContributor, id: "auth" }] });
    expect(() => getPrivacyContributors(config)).toThrow(
      '@softure-ai/privacy: app contributor "auth" has the id of an enabled module; give it another id',
    );
  });

  it("throws a clear error when the module is not enabled", () => {
    const config = defineSoftureConfig({ database: null, locale: "en", timezone: "UTC", appOrigin: "http://localhost:3000", modules: [] });
    expect(() => getPrivacyContributors(config)).toThrow("@softure-ai/privacy: the module is not enabled");
  });
});
