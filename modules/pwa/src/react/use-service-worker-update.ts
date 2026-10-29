"use client";

import { useEffect, useRef, useState } from "react";

import { watchServiceWorker, type ServiceWorkerWatch, type WatchServiceWorkerOptions } from "./watch-service-worker.js";

export type ServiceWorkerUpdateOptions = Omit<WatchServiceWorkerOptions, "onUpdateReady" | "onError"> & {
  /** Called when the registration fails; `console.error` by default. */
  readonly onError?: (error: unknown) => void;
};

export interface ServiceWorkerUpdate {
  /** A new build's worker waits: show the update prompt. */
  readonly isUpdateReady: boolean;
  /** The prompt's reload: the waiting worker takes over and the page reloads. */
  readonly activate: () => void;
}

function reportRegistrationError(error: unknown): void {
  console.error("@softure-ai/pwa: registering the service worker failed; the app works without it", error);
}

/**
 * Registers the worker once on mount and reports when a new build waits. Mount it once, near the root:
 * `const { isUpdateReady, activate } = useServiceWorkerUpdate();`. The options are read on mount.
 */
export function useServiceWorkerUpdate(options: ServiceWorkerUpdateOptions = {}): ServiceWorkerUpdate {
  const [isUpdateReady, setIsUpdateReady] = useState(false);
  const watch = useRef<ServiceWorkerWatch | null>(null);
  const initialOptions = useRef(options);

  useEffect(() => {
    const { onError = reportRegistrationError, ...rest } = initialOptions.current;
    const current = watchServiceWorker({ ...rest, onError, onUpdateReady: () => setIsUpdateReady(true) });
    watch.current = current;
    return () => {
      current.stop();
      watch.current = null;
    };
  }, []);

  return { isUpdateReady, activate: () => watch.current?.activate() };
}
