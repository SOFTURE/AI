import {
  getInstallOfferKey,
  isInstalledApp,
  isInstallOfferClosed,
  isIosDevice,
  isPhoneDevice,
  pickInstallOffer,
  rememberInstallOfferClosed,
  type DeviceNavigator,
  type InstallOfferFacts,
  type InstallOfferStorage,
} from "@softure-ai/pwa/react";
import { describe, expect, it } from "vitest";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const IPAD_AS_MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const ANDROID_PHONE = "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36";
const WINDOWS = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

function device(userAgent: string, extra: Partial<DeviceNavigator> = {}): DeviceNavigator {
  return { userAgent, maxTouchPoints: 0, ...extra };
}

const NOTHING: InstallOfferFacts = { isIos: false, isPhone: false, isInstalled: false, isClosed: false, hasPrompt: false };

describe("pickInstallOffer", () => {
  it("offers the iOS steps on an iOS device, phone or not", () => {
    expect(pickInstallOffer({ ...NOTHING, isIos: true, isPhone: true })).toBe("ios_steps");
    expect(pickInstallOffer({ ...NOTHING, isIos: true, isPhone: false })).toBe("ios_steps");
  });

  it("offers the browser's prompt on a phone that has one", () => {
    expect(pickInstallOffer({ ...NOTHING, isPhone: true, hasPrompt: true })).toBe("browser_prompt");
  });

  it("offers nothing on a phone without a kept prompt", () => {
    expect(pickInstallOffer({ ...NOTHING, isPhone: true })).toBe("none");
  });

  it("never offers anything on a desktop, even with a kept prompt", () => {
    expect(pickInstallOffer({ ...NOTHING, hasPrompt: true })).toBe("none");
  });

  it("offers nothing inside the installed app or after the user closed it", () => {
    expect(pickInstallOffer({ ...NOTHING, isIos: true, isInstalled: true })).toBe("none");
    expect(pickInstallOffer({ ...NOTHING, isPhone: true, hasPrompt: true, isInstalled: true })).toBe("none");
    expect(pickInstallOffer({ ...NOTHING, isIos: true, isClosed: true })).toBe("none");
    expect(pickInstallOffer({ ...NOTHING, isPhone: true, hasPrompt: true, isClosed: true })).toBe("none");
  });
});

describe("device facts", () => {
  it("tells an iPhone and an iPad reporting a Mac user agent from a Mac", () => {
    expect(isIosDevice(device(IPHONE, { maxTouchPoints: 5 }))).toBe(true);
    expect(isIosDevice(device(IPAD_AS_MAC, { maxTouchPoints: 5 }))).toBe(true);
    expect(isIosDevice(device(IPAD_AS_MAC, { maxTouchPoints: 0 }))).toBe(false);
    expect(isIosDevice(device(IPAD_AS_MAC, { maxTouchPoints: 1 }))).toBe(false);
    expect(isIosDevice(device(ANDROID_PHONE, { maxTouchPoints: 5 }))).toBe(false);
  });

  it("reads a phone from userAgentData.mobile where the browser has it", () => {
    expect(isPhoneDevice(device(WINDOWS, { userAgentData: { mobile: true } }))).toBe(true);
    expect(isPhoneDevice(device(ANDROID_PHONE, { userAgentData: { mobile: false } }))).toBe(false);
  });

  it("falls back to Mobi or Android in the user agent", () => {
    expect(isPhoneDevice(device(ANDROID_PHONE))).toBe(true);
    expect(isPhoneDevice(device(IPHONE))).toBe(true);
    expect(isPhoneDevice(device(WINDOWS))).toBe(false);
    expect(isPhoneDevice(device(IPAD_AS_MAC, { maxTouchPoints: 5 }))).toBe(false);
  });

  it("counts the standalone display mode and iOS navigator.standalone as installed", () => {
    const queries: string[] = [];
    const standalone = { navigator: device(ANDROID_PHONE), matchMedia: (query: string) => (queries.push(query), { matches: true }) };

    expect(isInstalledApp(standalone)).toBe(true);
    expect(queries).toEqual(["(display-mode: standalone)"]);
    expect(isInstalledApp({ navigator: device(IPHONE, { standalone: true }), matchMedia: () => ({ matches: false }) })).toBe(true);
    expect(isInstalledApp({ navigator: device(IPHONE, { standalone: false }), matchMedia: () => ({ matches: false }) })).toBe(false);
    expect(isInstalledApp({ navigator: device(WINDOWS), matchMedia: () => ({ matches: false }) })).toBe(false);
  });
});

class MemoryStorage implements InstallOfferStorage {
  readonly items = new Map<string, string>();
  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.items.set(key, value);
  }
}

function blockedStorage(): InstallOfferStorage {
  throw new DOMException("The operation is insecure.", "SecurityError");
}

describe("the closed flag", () => {
  it("prefixes the key with the app's id", () => {
    expect(getInstallOfferKey("fire")).toBe("fire:pwa-install-closed");
    expect(getInstallOfferKey("fire-2")).toBe("fire-2:pwa-install-closed");
  });

  it("refuses an app id outside lowercase letters, digits and dashes", () => {
    expect(() => getInstallOfferKey("")).toThrow('getInstallOfferKey: app must be lowercase letters, digits and dashes, got ""');
    expect(() => getInstallOfferKey("Fire")).toThrow('got "Fire"');
    expect(() => getInstallOfferKey("-fire")).toThrow('got "-fire"');
  });

  it("is not closed until remembered, then closed for that key only", () => {
    const storage = new MemoryStorage();

    expect(isInstallOfferClosed("fire:pwa-install-closed", () => storage)).toBe(false);
    expect(rememberInstallOfferClosed("fire:pwa-install-closed", () => storage)).toBe(true);
    expect(storage.items.get("fire:pwa-install-closed")).toBe("1");
    expect(isInstallOfferClosed("fire:pwa-install-closed", () => storage)).toBe(true);
    expect(isInstallOfferClosed("other:pwa-install-closed", () => storage)).toBe(false);
  });

  it("reads a blocked storage as not closed and answers false for a refused write", () => {
    expect(isInstallOfferClosed("fire:pwa-install-closed", blockedStorage)).toBe(false);
    expect(rememberInstallOfferClosed("fire:pwa-install-closed", blockedStorage)).toBe(false);
  });

  it("answers false when the storage refuses the write itself", () => {
    const full: InstallOfferStorage = {
      getItem: () => null,
      setItem: () => {
        throw new DOMException("Quota exceeded", "QuotaExceededError");
      },
    };

    expect(rememberInstallOfferClosed("fire:pwa-install-closed", () => full)).toBe(false);
  });
});
