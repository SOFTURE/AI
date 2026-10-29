import { SERVICE_WORKER_PATH } from "../paths.js";

/** The part of `ServiceWorkerContainer` the update flow uses. */
export interface WorkerContainer {
  readonly controller: unknown;
  register(url: string, options: RegistrationOptions): Promise<WorkerRegistration>;
  addEventListener(type: "controllerchange", listener: () => void): void;
  removeEventListener(type: "controllerchange", listener: () => void): void;
}

/** The part of `ServiceWorkerRegistration` the update flow uses. */
export interface WorkerRegistration {
  readonly installing: WaitingWorker | null;
  readonly waiting: WaitingWorker | null;
  update(): Promise<unknown>;
  addEventListener(type: "updatefound", listener: () => void): void;
  removeEventListener(type: "updatefound", listener: () => void): void;
}

/** The part of `ServiceWorker` the update flow uses. */
export interface WaitingWorker {
  readonly state: string;
  postMessage(message: unknown): void;
  addEventListener(type: "statechange", listener: () => void): void;
}

/** The part of `Document` the update flow uses. */
export interface VisibilitySource {
  readonly visibilityState: DocumentVisibilityState;
  addEventListener(type: "visibilitychange", listener: () => void): void;
  removeEventListener(type: "visibilitychange", listener: () => void): void;
}

export interface WatchServiceWorkerOptions {
  /** Called when a new build's worker has installed and waits for `activate()`. */
  readonly onUpdateReady: () => void;
  /** Called when the registration fails; the app keeps working without a worker. */
  readonly onError: (error: unknown) => void;
  /** `/sw.js` by default. */
  readonly url?: string;
  /** `navigator.serviceWorker` by default; nothing runs without one. */
  readonly container?: WorkerContainer | null;
  /** `document` by default. */
  readonly visibility?: VisibilitySource;
  /** `location.reload()` by default. */
  readonly reload?: () => void;
  /** `process.env.NODE_ENV === "development"` by default: no worker under `next dev`. */
  readonly isDevelopment?: boolean;
}

export interface ServiceWorkerWatch {
  /** Tells the waiting worker to take over; the page reloads once it controls the page. */
  activate(): void;
  /** Removes the listeners (the registration stays). */
  stop(): void;
}

function getDefaultContainer(): WorkerContainer | null {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  return navigator.serviceWorker;
}

/**
 * Registers the worker and runs the new-build update flow without React: a worker that installs while another
 * controls the page waits; `onUpdateReady` offers the reload; `activate()` lets it take over and the page reloads on
 * the next `controllerchange`, never on the first install. The registration is checked for a new build each time the
 * page comes back to the foreground.
 */
export function watchServiceWorker({
  onUpdateReady,
  onError,
  url = SERVICE_WORKER_PATH,
  container = getDefaultContainer(),
  visibility = typeof document === "undefined" ? undefined : document,
  reload = () => window.location.reload(),
  isDevelopment = process.env.NODE_ENV === "development",
}: WatchServiceWorkerOptions): ServiceWorkerWatch {
  if (container === null || isDevelopment) return { activate: () => undefined, stop: () => undefined };

  let isStopped = false;
  let isActivating = false;
  let registration: WorkerRegistration | null = null;
  let waiting: WaitingWorker | null = null;

  function offer(worker: WaitingWorker): void {
    waiting = worker;
    if (!isStopped) onUpdateReady();
  }

  function watchInstalling(): void {
    const worker = registration?.installing ?? null;
    if (worker === null) return;
    worker.addEventListener("statechange", () => {
      // With no controller this is the first install: it activates by itself and there is nothing to reload.
      if (worker.state === "installed" && container?.controller) offer(worker);
    });
  }

  function onControllerChange(): void {
    if (isActivating && !isStopped) reload();
  }

  function onVisibilityChange(): void {
    if (visibility?.visibilityState !== "visible" || registration === null) return;
    // A failed check (offline, a deploy in progress) is retried on the next return; there is nothing to show.
    registration.update().catch(() => undefined);
  }

  container.addEventListener("controllerchange", onControllerChange);
  visibility?.addEventListener("visibilitychange", onVisibilityChange);

  container.register(url, { scope: "/", updateViaCache: "none" }).then(
    (registered) => {
      registration = registered;
      if (isStopped) return;
      registered.addEventListener("updatefound", watchInstalling);
      if (registered.waiting !== null && container.controller) offer(registered.waiting);
    },
    (error: unknown) => {
      if (!isStopped) onError(error);
    },
  );

  return {
    activate() {
      if (waiting === null) return;
      isActivating = true;
      waiting.postMessage({ type: "skip-waiting" });
    },
    stop() {
      isStopped = true;
      container.removeEventListener("controllerchange", onControllerChange);
      visibility?.removeEventListener("visibilitychange", onVisibilityChange);
      registration?.removeEventListener("updatefound", watchInstalling);
    },
  };
}
