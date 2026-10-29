/** The storage the closed flag lives in; `localStorage` by default. */
export type InstallOfferStorage = Pick<Storage, "getItem" | "setItem">;

// The same rule as `createServiceWorkerRoute`'s `app`: lowercase letters, digits and dashes.
const APP_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

const CLOSED_VALUE = "1";

// Reading `window.localStorage` itself throws where storage is blocked (a sandboxed frame, some private windows).
function getBrowserStorage(): InstallOfferStorage {
  return window.localStorage;
}

/** The key of the closed flag, prefixed by the app's id: `<app>:pwa-install-closed`. */
export function getInstallOfferKey(app: string): string {
  if (!APP_ID_PATTERN.test(app)) {
    throw new Error(`getInstallOfferKey: app must be lowercase letters, digits and dashes, got ${JSON.stringify(app)}`);
  }
  return `${app}:pwa-install-closed`;
}

/** Whether the user closed the offer on this device. A blocked storage reads as not closed. */
export function isInstallOfferClosed(key: string, getStorage: () => InstallOfferStorage = getBrowserStorage): boolean {
  try {
    return getStorage().getItem(key) === CLOSED_VALUE;
  } catch {
    // Blocked storage: the default, the offer stays.
    return false;
  }
}

/**
 * Keeps the closed flag on this device and answers whether it was kept. A refused write (blocked storage, a full
 * quota) answers `false`: the caller closes the offer for the open page only.
 */
export function rememberInstallOfferClosed(key: string, getStorage: () => InstallOfferStorage = getBrowserStorage): boolean {
  try {
    getStorage().setItem(key, CLOSED_VALUE);
    return true;
  } catch {
    return false;
  }
}
