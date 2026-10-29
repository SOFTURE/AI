// @vitest-environment happy-dom
import { createInstallPromptStore, installPromptStore, useInstallOffer, type InstallOfferState, type InstallPromptStore } from "@softure-ai/pwa/react";
import { act, cleanup, render } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ANDROID_PHONE = "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const WINDOWS = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";
const KEY = "fire:pwa-install-closed";

function createPromptEvent(prompt: () => Promise<unknown> = () => Promise.resolve()) {
  const event = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), { prompt: vi.fn(prompt) });
  return event;
}

describe("createInstallPromptStore", () => {
  it("keeps the browser's prompt and stops its mini bar", () => {
    const target = new EventTarget();
    const store = createInstallPromptStore(target);
    const onChange = vi.fn();
    store.subscribe(onChange);
    const event = createPromptEvent();

    target.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(store.getSnapshot()).toBe(event);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("ignores an event without prompt()", () => {
    const target = new EventTarget();
    const store = createInstallPromptStore(target);
    const event = new Event("beforeinstallprompt", { cancelable: true });

    target.dispatchEvent(event);

    expect(store.getSnapshot()).toBeNull();
    expect(event.defaultPrevented).toBe(false);
  });

  it("forgets the prompt on appinstalled", () => {
    const target = new EventTarget();
    const store = createInstallPromptStore(target);
    target.dispatchEvent(createPromptEvent());

    target.dispatchEvent(new Event("appinstalled"));

    expect(store.getSnapshot()).toBeNull();
  });

  it("has no prompt on the server", () => {
    expect(createInstallPromptStore(new EventTarget()).getServerSnapshot()).toBeNull();
  });

  it("opens the prompt once and answers that the sheet opened", async () => {
    const target = new EventTarget();
    const store = createInstallPromptStore(target);
    const event = createPromptEvent();
    target.dispatchEvent(event);

    await expect(store.open()).resolves.toBe(true);
    await expect(store.open()).resolves.toBe(false);
    expect(event.prompt).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot()).toBeNull();
  });

  it("answers false without a prompt and when the browser refuses the sheet", async () => {
    const target = new EventTarget();
    const store = createInstallPromptStore(target);
    await expect(store.open()).resolves.toBe(false);

    target.dispatchEvent(createPromptEvent(() => Promise.reject(new DOMException("No user gesture", "NotAllowedError"))));

    await expect(store.open()).resolves.toBe(false);
    expect(store.getSnapshot()).toBeNull();
  });

  it("stops calling a listener once it unsubscribes", () => {
    const target = new EventTarget();
    const store = createInstallPromptStore(target);
    const onChange = vi.fn();
    const unsubscribe = store.subscribe(onChange);

    unsubscribe();
    target.dispatchEvent(createPromptEvent());

    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("installPromptStore", () => {
  it("listens on the window from the moment the module loads", () => {
    const event = createPromptEvent();

    window.dispatchEvent(event);

    expect(installPromptStore.getSnapshot()).toBe(event);
    window.dispatchEvent(new Event("appinstalled"));
    expect(installPromptStore.getSnapshot()).toBeNull();
  });
});

function setDevice({ userAgent, maxTouchPoints = 0, isStandalone = false }: { userAgent: string; maxTouchPoints?: number; isStandalone?: boolean }): void {
  Object.defineProperty(navigator, "userAgent", { configurable: true, get: () => userAgent });
  Object.defineProperty(navigator, "maxTouchPoints", { configurable: true, get: () => maxTouchPoints });
  vi.spyOn(window, "matchMedia").mockImplementation((query) => ({ matches: isStandalone && query === "(display-mode: standalone)" }) as MediaQueryList);
}

function renderOffer(store: InstallPromptStore) {
  const state: { current: InstallOfferState | null } = { current: null };
  function Probe() {
    state.current = useInstallOffer({ app: "fire", store });
    return <p>{state.current.offer}</p>;
  }
  const result = render(<Probe />);
  return { ...result, state };
}

describe("useInstallOffer", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders no offer on the server", () => {
    setDevice({ userAgent: IPHONE });
    function Probe() {
      return <p>{useInstallOffer({ app: "fire", store: createInstallPromptStore(new EventTarget()) }).offer}</p>;
    }

    expect(renderToString(<Probe />)).toBe("<p>none</p>");
  });

  it("offers the browser's prompt on a phone once the prompt is kept, and installs through it", async () => {
    setDevice({ userAgent: ANDROID_PHONE });
    const target = new EventTarget();
    const store = createInstallPromptStore(target);
    const { container, state } = renderOffer(store);
    expect(container.textContent).toBe("none");

    const event = createPromptEvent();
    act(() => {
      target.dispatchEvent(event);
    });
    expect(container.textContent).toBe("browser_prompt");

    let opened: boolean | null = null;
    await act(async () => {
      opened = (await state.current?.install()) ?? null;
    });
    expect(opened).toBe(true);
    expect(event.prompt).toHaveBeenCalledTimes(1);
    expect(container.textContent).toBe("none");
  });

  it("offers the iOS steps on an iPhone", () => {
    setDevice({ userAgent: IPHONE, maxTouchPoints: 5 });

    const { container } = renderOffer(createInstallPromptStore(new EventTarget()));

    expect(container.textContent).toBe("ios_steps");
  });

  it("offers nothing on a desktop or inside the installed app", () => {
    setDevice({ userAgent: WINDOWS });
    const target = new EventTarget();
    const { container } = renderOffer(createInstallPromptStore(target));
    act(() => {
      target.dispatchEvent(createPromptEvent());
    });
    expect(container.textContent).toBe("none");
    cleanup();

    setDevice({ userAgent: IPHONE, maxTouchPoints: 5, isStandalone: true });
    expect(renderOffer(createInstallPromptStore(new EventTarget())).container.textContent).toBe("none");
  });

  it("closes the offer and keeps it closed on this device", () => {
    setDevice({ userAgent: IPHONE, maxTouchPoints: 5 });
    const { container, state } = renderOffer(createInstallPromptStore(new EventTarget()));

    act(() => state.current?.close());

    expect(container.textContent).toBe("none");
    expect(localStorage.getItem(KEY)).toBe("1");
    cleanup();
    expect(renderOffer(createInstallPromptStore(new EventTarget())).container.textContent).toBe("none");
  });

  it("closes the offer for the open page when the storage refuses the write", () => {
    setDevice({ userAgent: IPHONE, maxTouchPoints: 5 });
    const full = {
      getItem: () => null,
      setItem: () => {
        throw new DOMException("Quota exceeded", "QuotaExceededError");
      },
    };
    vi.spyOn(window, "localStorage", "get").mockReturnValue(full as unknown as Storage);
    const { container, state } = renderOffer(createInstallPromptStore(new EventTarget()));

    act(() => state.current?.close());

    expect(container.textContent).toBe("none");
    vi.restoreAllMocks();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it("shows the offer when the storage is blocked", () => {
    localStorage.setItem(KEY, "1");
    setDevice({ userAgent: IPHONE, maxTouchPoints: 5 });
    vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
      throw new DOMException("The operation is insecure.", "SecurityError");
    });

    expect(renderOffer(createInstallPromptStore(new EventTarget())).container.textContent).toBe("ios_steps");
  });
});
