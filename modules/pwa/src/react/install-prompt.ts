/** Chromium's `beforeinstallprompt` event: `prompt()` opens the install sheet, once. */
export interface InstallPromptEvent extends Event {
  readonly prompt: () => Promise<unknown>;
}

/** The window events the store listens to. */
export type InstallPromptTarget = Pick<EventTarget, "addEventListener">;

/** The kept prompt as an external store for `useSyncExternalStore`. */
export interface InstallPromptStore {
  readonly subscribe: (onChange: () => void) => () => void;
  /** The kept, unused prompt, or `null`. */
  readonly getSnapshot: () => InstallPromptEvent | null;
  /** The server has no prompt. */
  readonly getServerSnapshot: () => null;
  /** Opens the kept prompt once and answers whether the sheet opened; `false` without a prompt or when it fails. */
  readonly open: () => Promise<boolean>;
}

function isInstallPromptEvent(event: Event): event is InstallPromptEvent {
  return typeof (event as Partial<InstallPromptEvent>).prompt === "function";
}

function getServerSnapshot(): null {
  return null;
}

/**
 * Keeps the browser's `beforeinstallprompt` event from the moment it is created: `preventDefault()` stops the
 * browser's own mini bar, `appinstalled` forgets it. Create it as early as possible: Chromium fires the event once the
 * manifest qualifies, often before React hydrates.
 */
export function createInstallPromptStore(target: InstallPromptTarget): InstallPromptStore {
  let kept: InstallPromptEvent | null = null;
  const listeners = new Set<() => void>();

  function keep(next: InstallPromptEvent | null): void {
    kept = next;
    for (const listener of listeners) listener();
  }

  target.addEventListener("beforeinstallprompt", (event) => {
    if (!isInstallPromptEvent(event)) return;
    event.preventDefault();
    keep(event);
  });
  target.addEventListener("appinstalled", () => keep(null));

  return {
    subscribe: (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    getSnapshot: () => kept,
    getServerSnapshot,
    open: async () => {
      const event = kept;
      if (event === null) return false;
      // The event is spent by its first prompt(), whatever the user chooses.
      keep(null);
      try {
        await event.prompt();
        return true;
      } catch {
        // The browser refused the sheet (no user gesture, an event it no longer honours): the offer just closes.
        return false;
      }
    },
  };
}

const EMPTY_TARGET: InstallPromptTarget = { addEventListener: () => undefined };

/** The page's store, listening from the moment this module loads in a browser; on the server it never has a prompt. */
export const installPromptStore: InstallPromptStore = createInstallPromptStore(typeof window === "undefined" ? EMPTY_TARGET : window);

/** Opens the page's kept prompt once (`installPromptStore.open()`); answers whether the sheet opened. */
export function openInstallPrompt(): Promise<boolean> {
  return installPromptStore.open();
}
