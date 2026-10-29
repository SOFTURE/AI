// A fake `navigator.serviceWorker` with its registration, workers and `document` visibility, driven by the test.
import type { VisibilitySource, WaitingWorker, WorkerContainer, WorkerRegistration } from "@softure-ai/pwa/react";

class Events {
  private readonly listeners = new Map<string, Set<() => void>>();

  addEventListener(type: string, listener: () => void): void {
    this.listeners.set(type, (this.listeners.get(type) ?? new Set()).add(listener));
  }

  removeEventListener(type: string, listener: () => void): void {
    this.listeners.get(type)?.delete(listener);
  }

  emit(type: string): void {
    for (const listener of this.listeners.get(type) ?? []) listener();
  }

  count(type: string): number {
    return this.listeners.get(type)?.size ?? 0;
  }
}

export class FakeWorker extends Events implements WaitingWorker {
  state = "installing";
  readonly messages: unknown[] = [];

  postMessage(message: unknown): void {
    this.messages.push(message);
  }

  setState(state: string): void {
    this.state = state;
    this.emit("statechange");
  }
}

export class FakeRegistration extends Events implements WorkerRegistration {
  installing: FakeWorker | null = null;
  waiting: FakeWorker | null = null;
  updates = 0;
  updateError: Error | null = null;

  update(): Promise<unknown> {
    this.updates += 1;
    return this.updateError === null ? Promise.resolve(undefined) : Promise.reject(this.updateError);
  }

  /** A new build's worker starts installing. */
  findUpdate(): FakeWorker {
    const worker = new FakeWorker();
    this.installing = worker;
    this.emit("updatefound");
    return worker;
  }
}

export class FakeContainer extends Events implements WorkerContainer {
  controller: object | null = null;
  readonly registration = new FakeRegistration();
  readonly registered: { url: string; options: RegistrationOptions }[] = [];
  registerError: Error | null = null;

  register(url: string, options: RegistrationOptions): Promise<WorkerRegistration> {
    this.registered.push({ url, options });
    return this.registerError === null ? Promise.resolve(this.registration) : Promise.reject(this.registerError);
  }

  /** A worker takes control of the page. */
  changeController(): void {
    this.controller = {};
    this.emit("controllerchange");
  }
}

export class FakeVisibility extends Events implements VisibilitySource {
  visibilityState: DocumentVisibilityState = "visible";

  show(): void {
    this.visibilityState = "visible";
    this.emit("visibilitychange");
  }

  hide(): void {
    this.visibilityState = "hidden";
    this.emit("visibilitychange");
  }
}

/** Lets the registration's promise settle. */
export function flushPromises(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
