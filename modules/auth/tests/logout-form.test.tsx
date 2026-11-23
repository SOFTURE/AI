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

  it("keeps className on the form and gives the button its defaults when no look is passed", () => {
    render(<LogoutForm action={() => undefined} messages={en} className="account-footer" />);

    const button = screen.getByRole("button", { name: en.logout.submit });
    expect(getForm().className).toBe("account-footer");
    expect(button.dataset.variant).toBe("secondary");
    expect(button.dataset.size).toBe("md");
    expect(button.className.split(" ")).not.toContain("sft:w-full");
  });

  it("styles the button as a full-width row through classNames.button, without selectors on the form", () => {
    render(
      <LogoutForm
        action={() => undefined}
        messages={en}
        variant="ghost"
        size="sm"
        fullWidth
        iconLeft={<svg data-testid="logout-icon" />}
        className="footer"
        classNames={{ form: "-mx-2", button: "justify-start px-2" }}
      />,
    );

    const button = screen.getByRole("button", { name: en.logout.submit });
    const classes = button.className.split(" ");
    expect(getForm().className).toBe("-mx-2 footer");
    expect(button.dataset.variant).toBe("ghost");
    expect(button.dataset.size).toBe("sm");
    expect(classes).toContain("sft:w-full");
    expect(classes.slice(-2)).toEqual(["justify-start", "px-2"]);
    expect(button.querySelector('[data-testid="logout-icon"]')).not.toBeNull();
  });

  it("renders only the app's class on an unstyled button and keeps it busy while beforeSignOut runs", async () => {
    const clearing = deferred();
    render(
      <LogoutForm
        action={() => undefined}
        messages={en}
        beforeSignOut={() => clearing.promise}
        unstyled
        classNames={{ button: "sidebar-row" }}
      />,
    );

    const button = screen.getByRole("button", { name: en.logout.submit });
    expect(button.className).toBe("sidebar-row");

    await submit();
    expect(button).toHaveProperty("disabled", true);
    expect(button.getAttribute("aria-busy")).toBe("true");

    await act(async () => {
      clearing.resolve();
      await new Promise((resolve) => setTimeout(resolve));
    });
  });
});
