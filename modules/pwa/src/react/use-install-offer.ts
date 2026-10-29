"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

import { isInstalledApp, isIosDevice, isPhoneDevice } from "./device.js";
import { pickInstallOffer, type InstallOffer } from "./install-offer.js";
import { getInstallOfferKey, isInstallOfferClosed, rememberInstallOfferClosed } from "./install-offer-storage.js";
import { installPromptStore, type InstallPromptStore } from "./install-prompt.js";

export interface InstallOfferOptions {
  /** The app's id, the closed flag's prefix: the same id as `createServiceWorkerRoute`'s `app`. */
  readonly app: string;
  /** The page's `installPromptStore` by default. */
  readonly store?: InstallPromptStore;
}

export interface InstallOfferState {
  /** What to show; `none` on the server and in the first client render. */
  readonly offer: InstallOffer;
  /** The browser's prompt, once; answers whether the sheet opened. */
  readonly install: () => Promise<boolean>;
  /** Closes the offer on this device (for the open page only when the storage refuses the write). */
  readonly close: () => void;
}

interface DeviceFacts {
  readonly isIos: boolean;
  readonly isPhone: boolean;
  readonly isInstalled: boolean;
  readonly isClosed: boolean;
}

/**
 * The install offer for phones: `const { offer, install, close } = useInstallOffer({ app: "fire" });`. The device
 * facts and the closed flag are read after mount, so the server render and hydration show no offer.
 */
export function useInstallOffer({ app, store = installPromptStore }: InstallOfferOptions): InstallOfferState {
  const key = getInstallOfferKey(app);
  const prompt = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  const [facts, setFacts] = useState<DeviceFacts | null>(null);

  useEffect(() => {
    setFacts({ isIos: isIosDevice(), isPhone: isPhoneDevice(), isInstalled: isInstalledApp(), isClosed: isInstallOfferClosed(key) });
  }, [key]);

  const close = useCallback(() => {
    rememberInstallOfferClosed(key);
    setFacts((current) => (current === null ? current : { ...current, isClosed: true }));
  }, [key]);

  const offer = facts === null ? "none" : pickInstallOffer({ ...facts, hasPrompt: prompt !== null });
  return { offer, install: store.open, close };
}
