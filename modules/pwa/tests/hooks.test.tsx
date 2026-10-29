// @vitest-environment happy-dom
import { useIsOnline, useServiceWorkerUpdate, type ServiceWorkerUpdate } from "@softure-ai/pwa/react";
import { act, cleanup, render } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FakeContainer, FakeVisibility, flushPromises } from "./support/fake-container.js";

function setOnline(isOnline: boolean): void {
  Object.defineProperty(navigator, "onLine", { configurable: true, get: () => isOnline });
  window.dispatchEvent(new Event(isOnline ? "online" : "offline"));
}

function OnlineState() {
  return <p>{useIsOnline() ? "online" : "offline"}</p>;
}

describe("useIsOnline", () => {
  afterEach(() => {
    cleanup();
    setOnline(true);
  });

  it("renders online on the server", () => {
    expect(renderToString(<OnlineState />)).toBe("<p>online</p>");
  });

  it("follows the browser's online and offline events", () => {
    setOnline(true);
    const { container } = render(<OnlineState />);
    expect(container.textContent).toBe("online");

    act(() => setOnline(false));
    expect(container.textContent).toBe("offline");

    act(() => setOnline(true));
    expect(container.textContent).toBe("online");
  });
});

describe("useServiceWorkerUpdate", () => {
  afterEach(() => {
    cleanup();
  });

  it("reports a waiting build and activates it on the prompt's reload", async () => {
    const workerContainer = new FakeContainer();
    workerContainer.controller = {};
    const reload = vi.fn();
    let update: ServiceWorkerUpdate | null = null;
    function Probe() {
      update = useServiceWorkerUpdate({ container: workerContainer, visibility: new FakeVisibility(), reload, isDevelopment: false });
      return null;
    }

    render(<Probe />);
    await act(flushPromises);
    expect(update).toMatchObject({ isUpdateReady: false });

    const worker = workerContainer.registration.findUpdate();
    act(() => worker.setState("installed"));
    expect(update).toMatchObject({ isUpdateReady: true });

    act(() => update?.activate());
    workerContainer.changeController();
    expect(worker.messages).toEqual([{ type: "skip-waiting" }]);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("reports a failed registration to console.error by default", async () => {
    const workerContainer = new FakeContainer();
    workerContainer.registerError = new Error("SecurityError");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    function Probe() {
      useServiceWorkerUpdate({ container: workerContainer, visibility: new FakeVisibility(), isDevelopment: false });
      return null;
    }

    render(<Probe />);
    await act(flushPromises);

    expect(consoleError).toHaveBeenCalledWith(
      "@softure-ai/pwa: registering the service worker failed; the app works without it",
      workerContainer.registerError,
    );
    consoleError.mockRestore();
  });

  it("stops watching on unmount", async () => {
    const workerContainer = new FakeContainer();
    function Probe() {
      useServiceWorkerUpdate({ container: workerContainer, visibility: new FakeVisibility(), isDevelopment: false });
      return null;
    }

    const { unmount } = render(<Probe />);
    await act(flushPromises);
    unmount();

    expect(workerContainer.count("controllerchange")).toBe(0);
  });
});
