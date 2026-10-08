// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ActionForm } from "../src/index.js";

afterEach(cleanup);

const succeed = () => Promise.resolve({ ok: true } as const);

function getSubmitClass(): string {
  return screen.getByRole("button", { name: "Save" }).className;
}

describe("ActionForm submit slot", () => {
  it("adds the submit classes to the page form's submit button, on top of the package look", () => {
    render(
      <ActionForm action={succeed} submitLabel="Save" classNames={{ submit: "app-submit" }}>
        <input name="x" aria-label="X" />
      </ActionForm>,
    );
    const submit = screen.getByRole("button", { name: "Save" });
    expect(submit.className).toContain("app-submit");
    expect(submit.className).toContain("sft:");
    expect(submit.parentElement?.className).not.toContain("app-submit");
  });

  it("adds the submit classes to the modal footer's submit button and not to Cancel", () => {
    render(
      <ActionForm action={succeed} submitLabel="Save" onCancel={() => undefined} classNames={{ submit: "app-submit" }}>
        <input name="x" aria-label="X" />
      </ActionForm>,
    );
    expect(getSubmitClass()).toContain("app-submit");
    expect(screen.getByRole("button", { name: "Cancel" }).className).not.toContain("app-submit");
  });

  it("gives the submit button only the app's classes when unstyled", () => {
    render(
      <ActionForm action={succeed} submitLabel="Save" classNames={{ submit: "app-submit" }} unstyled>
        <input name="x" aria-label="X" />
      </ActionForm>,
    );
    expect(getSubmitClass()).toBe("app-submit");
  });

  it("leaves the submit button's classes as they were without the slot", () => {
    for (const onCancel of [undefined, () => undefined]) {
      const { unmount } = render(
        <ActionForm action={succeed} submitLabel="Save" onCancel={onCancel}>
          <input name="x" aria-label="X" />
        </ActionForm>,
      );
      const plain = getSubmitClass();
      unmount();
      render(
        <ActionForm action={succeed} submitLabel="Save" onCancel={onCancel} classNames={{ root: "app-root" }}>
          <input name="x" aria-label="X" />
        </ActionForm>,
      );
      expect(getSubmitClass()).toBe(plain);
      cleanup();
    }
  });
});
