"use client";

import { useSyncExternalStore } from "react";

export interface StreamedScriptProps {
  /** The inline script's text, e.g. a launch counter from `@softure-ai/pwa`. */
  readonly script: string;
}

function subscribe(): () => void {
  return () => undefined;
}

function isClientRender(): boolean {
  return false;
}

function isServerRender(): boolean {
  return true;
}

/**
 * An inline script that runs only where the browser parses it: in the HTML the server streams. React keeps it while it
 * hydrates that HTML (the server snapshot) and drops it afterwards, once it has run. A render that starts on the client
 * (a loading state shown by a client-side navigation) draws no script at all: React never runs a script it creates and
 * warns about one in development ("Encountered a script tag while rendering React component").
 */
export function StreamedScript({ script }: StreamedScriptProps) {
  const isServerHtml = useSyncExternalStore(subscribe, isClientRender, isServerRender);
  return isServerHtml ? <script dangerouslySetInnerHTML={{ __html: script }} /> : null;
}
