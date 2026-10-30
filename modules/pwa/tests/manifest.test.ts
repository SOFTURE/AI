import { buildManifest, getIconMetadata, findPwaIcon, PWA_ICONS, pwaMessages } from "@softure-ai/pwa";
import { describe, expect, it } from "vitest";

import { THEME } from "./support/theme.js";

const COPY = { name: "Fire Tracker", shortName: "Fire", description: "Track your path to financial independence." };

describe("buildManifest", () => {
  it("fills the manifest from the app's copy, the theme's token values and the defaults", () => {
    expect(buildManifest({ theme: THEME, copy: COPY, lang: "en" })).toEqual({
      id: "/",
      name: "Fire Tracker",
      short_name: "Fire",
      description: "Track your path to financial independence.",
      lang: "en",
      start_url: "/",
      scope: "/",
      display: "standalone",
      background_color: "#fefefe",
      theme_color: "#fefefe",
      icons: [
        { src: "/pwa/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/pwa/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "/pwa/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    });
  });

  it("takes the start URL, scope, display and colour roles from its options, following aliases", () => {
    const manifest = buildManifest({
      theme: THEME,
      copy: COPY,
      lang: "pl",
      startUrl: "/app",
      scope: "/app/",
      display: "fullscreen",
      backgroundRole: "card",
      themeRole: "link",
    });

    expect(manifest).toMatchObject({
      id: "/app",
      lang: "pl",
      start_url: "/app",
      scope: "/app/",
      display: "fullscreen",
      background_color: "#f7f7f5",
      theme_color: "#0171cf",
    });
  });

  it("fails on a colour role the theme does not define", () => {
    expect(() => buildManifest({ theme: THEME, copy: COPY, lang: "en", themeRole: "brand" })).toThrow('theme "Test" has no colour "brand"');
  });
});

describe("the icon registry", () => {
  it("lists the tab, apple and manifest icons with unique names", () => {
    expect(PWA_ICONS.map((icon) => [icon.name, icon.size, icon.shape])).toEqual([
      ["icon-32.png", 32, "rounded"],
      ["apple-icon-180.png", 180, "square"],
      ["icon-192.png", 192, "rounded"],
      ["icon-512.png", 512, "rounded"],
      ["icon-maskable-512.png", 512, "maskable"],
    ]);
  });

  it("finds an icon by name and nothing outside the registry", () => {
    expect(findPwaIcon("icon-192.png")?.size).toBe(192);
    expect(findPwaIcon("icon-64.png")).toBeNull();
    expect(findPwaIcon("../manifest.webmanifest")).toBeNull();
  });

  it("gives the head's links from the same registry", () => {
    expect(getIconMetadata()).toEqual({
      icon: [{ url: "/pwa/icons/icon-32.png", sizes: "32x32", type: "image/png" }],
      apple: [{ url: "/pwa/icons/apple-icon-180.png", sizes: "180x180", type: "image/png" }],
    });
  });
});

describe("pwa messages", () => {
  it("ship the update prompt's copy in English only", () => {
    expect(Object.keys(pwaMessages)).toEqual(["en"]);
    expect(pwaMessages.en.update).toEqual({
      title: "A new version is ready",
      description: "Reload to use it. Anything you have not saved on this page will be lost.",
      reload: "Reload",
    });
  });

  it("name the launch screen's progress bar", () => {
    expect(pwaMessages.en.launch).toEqual({ label: "Loading" });
  });
});
