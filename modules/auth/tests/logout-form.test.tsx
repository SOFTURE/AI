// @vitest-environment happy-dom
import { authMessages } from "@softure-ai/auth";
import { LogoutForm } from "@softure-ai/auth/ui";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const en = authMessages.en;

function getForm(): HTMLFormElement {
  const form = screen.getByRole("button", { name: en.logout.submit }).closest("form");
  if (form === null) throw new Error("the logout button is outside a form");
  return form;
}

async function submit(): Promise<void> {
  await act(async () => {
    fireEvent.submit(getForm());
    await new Promise((resolve) => setTimeout(resolve));
  });
}

/** A promise the test settles by hand. */
function deferred() {
  let resolve: () => void = () => undefined;
  let reject: (error: unknown) => void = () => undefined;
  const promise = new Promise<void>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

describe("LogoutForm", () => {
  it("posts to the action at once without beforeSignOut, with the next path", async () => {
    const action = vi.fn<(formData: FormData) => Promise<void>>(() => Promise.resolve());
    render(<LogoutForm action={action} messages={en} next="/login?next=/account" />);

    await submit();

    expect(action).toHaveBeenCalledTimes(1);
    expect(action.mock.calls[0]?.[0].get("next")).toBe("/login?next=/account");
  });

  it("signs out only after beforeSignOut has settled, and keeps the button busy meanwhile", async () => {
    const order: string[] = [];
    const clearing = deferred();
    const beforeSignOut = vi.fn(() => {
      order.push("before");
      return clearing.promise.then(() => order.push("cleared"));
    });
    const action = vi.fn(() => {
      order.push("action");
      return Promise.resolve();
    });
    render(<LogoutForm action={action} messages={en} beforeSignOut={beforeSignOut} />);

    await submit();
    expect(action).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: en.logout.submit })).toHaveProperty("disabled", true);

    await submit();
    expect(beforeSignOut).toHaveBeenCalledTimes(1);

    await act(async () => {
      clearing.resolve();
      await new Promise((resolve) => setTimeout(resolve));
    });
    expect(order).toEqual(["before", "cleared", "action"]);
  });

  it("signs out when beforeSignOut fails, and logs only the failure's kind", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const action = vi.fn(() => Promise.resolve());
    const beforeSignOut = () => Promise.reject(new TypeError("ada@example.com has no database"));
    render(<LogoutForm action={action} messages={en} beforeSignOut={beforeSignOut} />);

    await submit();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve));
    });

    expect(action).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledWith("@softure-ai/auth: before sign-out failed: TypeError");
  });

  it("signs out when beforeSignOut throws at once", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const action = vi.fn(() => Promise.resolve());
    render(
      <LogoutForm
        action={action}
        messages={en}
        beforeSignOut={() => {
          throw new Error("no IndexedDB");
        }}
      />,
    );

    await submit();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve));
    });

    expect(action).toHaveBeenCalledTimes(1);
  });

  it("runs beforeSignOut again on a later sign-out that did not leave the page", async () => {
    const action = vi.fn(() => Promise.resolve());
    const beforeSignOut = vi.fn(() => Promise.resolve());
    render(<LogoutForm action={action} messages={en} beforeSignOut={beforeSignOut} />);

    await submit();
    await submit();

    expect(beforeSignOut).toHaveBeenCalledTimes(2);
    expect(action).toHaveBeenCalledTimes(2);
  });
});
