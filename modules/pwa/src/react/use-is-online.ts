"use client";

import { useSyncExternalStore } from "react";

function subscribeToConnection(onChange: () => void): () => void {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

function isOnline(): boolean {
  return navigator.onLine;
}

// The server renders the online view; the browser switches on hydration.
function isOnlineOnServer(): boolean {
  return true;
}

/** Whether the browser has a network (`navigator.onLine`), updated on `online` and `offline`. */
export function useIsOnline(): boolean {
  return useSyncExternalStore(subscribeToConnection, isOnline, isOnlineOnServer);
}
