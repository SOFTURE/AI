import { watchServiceWorker, type WatchServiceWorkerOptions } from "@softure-ai/pwa/react";
import { describe, expect, it, vi } from "vitest";

import { FakeContainer, FakeVisibility, FakeWorker, flushPromises } from "./support/fake-container.js";

function watch(options: Partial<WatchServiceWorkerOptions> = {}) {
  const container = options.container instanceof FakeContainer ? options.container : new FakeContainer();
  const visibility = new FakeVisibility();
  const onUpdateReady = vi.fn();
  const onError = vi.fn();
  const reload = vi.fn();
  const handle = watchServiceWorker({ container, visibility, onUpdateReady, onError, reload, isDevelopment: false, ...options });
  return { handle, container, visibility, onUpdateReady, onError, reload };
}

/** A page a worker already controls, as after the first visit. */
function controlledContainer(): FakeContainer {
  const container = new FakeContainer();
  container.controller = {};
  return container;
}

describe("watchServiceWorker", () => {
  it("registers /sw.js for the whole app, past the HTTP cache", async () => {
    const { container } = watch();
    await flushPromises();

    expect(container.registered).toEqual([{ url: "/sw.js", options: { scope: "/", updateViaCache: "none" } }]);
  });

  it("does not register under next dev", async () => {
    const { container } = watch({ isDevelopment: true });
    await flushPromises();

    expect(container.registered).toEqual([]);
  });

  it("does nothing in a browser without service workers", () => {
    const { handle } = watch({ container: null });

    expect(() => handle.activate()).not.toThrow();
  });

  it("reports a failed registration and offers nothing", async () => {
    const container = new FakeContainer();
    container.registerError = new Error("SecurityError");
    const { onError, onUpdateReady } = watch({ container });
    await flushPromises();

    expect(onError).toHaveBeenCalledWith(container.registerError);
    expect(onUpdateReady).not.toHaveBeenCalled();
  });

  it("offers nothing and never reloads on the first install", async () => {
    const { container, onUpdateReady, reload } = watch();
    await flushPromises();

    const worker = container.registration.findUpdate();
    worker.setState("installed");
    worker.setState("activated");
    // The first worker claims the page.
    container.changeController();

    expect(onUpdateReady).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it("offers the update when a new build's worker has installed while another controls the page", async () => {
    const { container, onUpdateReady } = watch({ container: controlledContainer() });
    await flushPromises();

    const worker = container.registration.findUpdate();
    expect(onUpdateReady).not.toHaveBeenCalled();
    worker.setState("installed");

    expect(onUpdateReady).toHaveBeenCalledTimes(1);
  });

  it("offers a worker that was already waiting when the page loaded", async () => {
    const container = controlledContainer();
    container.registration.waiting = new FakeWorker();
    const { onUpdateReady } = watch({ container });
    await flushPromises();

    expect(onUpdateReady).toHaveBeenCalledTimes(1);
  });

  it("reloads only after activate, when the new worker takes control", async () => {
    const { container, handle, reload } = watch({ container: controlledContainer() });
    await flushPromises();
    const worker = container.registration.findUpdate();
    worker.setState("installed");

    // Another tab activated it: the controller changes, but this page did not ask.
    container.changeController();
    expect(reload).not.toHaveBeenCalled();

    handle.activate();
    expect(worker.messages).toEqual([{ type: "skip-waiting" }]);
    expect(reload).not.toHaveBeenCalled();
    container.changeController();

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("ignores activate with no waiting worker", async () => {
    const { container, handle, reload } = watch({ container: controlledContainer() });
    await flushPromises();

    handle.activate();
    container.changeController();

    expect(reload).not.toHaveBeenCalled();
  });

  it("checks for a new build on every return to the foreground and ignores a failed check", async () => {
    const { container, visibility, onError } = watch();
    await flushPromises();
    container.registration.updateError = new Error("offline");

    visibility.hide();
    visibility.show();
    visibility.show();
    await flushPromises();

    expect(container.registration.updates).toBe(2);
    expect(onError).not.toHaveBeenCalled();
  });

  it("removes its listeners on stop", async () => {
    const { container, visibility, handle, onUpdateReady } = watch({ container: controlledContainer() });
    await flushPromises();

    handle.stop();
    visibility.show();
    container.registration.findUpdate().setState("installed");

    expect(container.registration.updates).toBe(0);
    expect(container.count("controllerchange")).toBe(0);
    expect(visibility.count("visibilitychange")).toBe(0);
    expect(onUpdateReady).not.toHaveBeenCalled();
  });

  it("does not report after stop when the registration fails late", async () => {
    const container = new FakeContainer();
    container.registerError = new Error("late");
    const { handle, onError } = watch({ container });

    handle.stop();
    await flushPromises();

    expect(onError).not.toHaveBeenCalled();
  });
});
