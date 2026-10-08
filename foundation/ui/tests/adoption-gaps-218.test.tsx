// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ActionForm,
  Button,
  Card,
  Field,
  type HintAppearance,
  Modal,
  ModalFooter,
  StandingPanel,
  TextField,
} from "../src/index.js";

afterEach(cleanup);

const APPEARANCE: HintAppearance = {
  classNames: { trigger: "app-trigger", bubble: "app-bubble" },
  triggerGap: 8,
};

function rect(r: { left: number; top: number; width: number; height: number }): DOMRect {
  return { ...r, right: r.left + r.width, bottom: r.top + r.height, x: r.left, y: r.top, toJSON: () => r };
}

/** Opens the hint named `name` with fixed rects and returns the bubble's top in px. */
function getOpenBubbleTop(name: string): string {
  const spy = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    return this.getAttribute("role") === "tooltip"
      ? rect({ left: 0, top: 0, width: 200, height: 50 })
      : rect({ left: 400, top: 300, width: 16, height: 16 });
  });
  const root = document.documentElement;
  Object.defineProperty(root, "clientWidth", { configurable: true, value: 1000 });
  Object.defineProperty(root, "clientHeight", { configurable: true, value: 800 });
  try {
    fireEvent.focus(screen.getByRole("button", { name }));
    return screen.getByRole("tooltip").style.top;
  } finally {
    spy.mockRestore();
    delete (root as { clientWidth?: number }).clientWidth;
    delete (root as { clientHeight?: number }).clientHeight;
  }
}

describe("Card hintProps", () => {
  it("puts the app's trigger and bubble classes on the card's hint", () => {
    const html = renderToStaticMarkup(
      <Card title="Savings" hint="How it is counted" hintId="savings-hint" hintProps={APPEARANCE}>
        body
      </Card>,
    );
    expect(html).toMatch(/<button[^>]*aria-describedby="savings-hint"[^>]*class="[^"]*app-trigger/);
    expect(html).toMatch(/id="savings-hint" role="tooltip"[^>]*class="[^"]*app-bubble/);
  });

  it("passes triggerGap to the placement of the card's open bubble", () => {
    render(
      <Card title="Savings" hint="How it is counted" hintProps={{ triggerGap: 8 }}>
        body
      </Card>,
    );
    // Trigger top 300, bubble height 50: 300 - 50 - 8.
    expect(getOpenBubbleTop("About: Savings")).toBe("242px");
  });

  it("keeps the default 6 px gap without hintProps", () => {
    render(
      <Card title="Savings" hint="How it is counted">
        body
      </Card>,
    );
    expect(getOpenBubbleTop("About: Savings")).toBe("244px");
  });
});

describe("Field hintProps", () => {
  it("styles the tooltip hint next to a Field label", () => {
    const html = renderToStaticMarkup(
      <Field label="Rate" hint="Yearly" hintAs="tooltip" hintId="rate-hint" hintProps={APPEARANCE}>
        <input />
      </Field>,
    );
    expect(html).toMatch(/<button[^>]*class="[^"]*app-trigger/);
    expect(html).toMatch(/id="rate-hint" role="tooltip"[^>]*class="[^"]*app-bubble/);
  });

  it("reaches the tooltip hint of a TextField", () => {
    render(<TextField name="rate" label="Rate" hint="Yearly" hintAs="tooltip" hintProps={APPEARANCE} />);
    expect(screen.getByRole("button", { name: "Hint: Rate" }).className).toContain("app-trigger");
    expect(getOpenBubbleTop("Hint: Rate")).toBe("242px");
  });
});

describe("dialog headingLevel", () => {
  it("renders a standing panel's title as h1 when asked, still naming the dialog", () => {
    render(
      <StandingPanel isOpen title="Review" headingLevel={1} onClose={() => undefined}>
        <p>x</p>
      </StandingPanel>,
    );
    const heading = screen.getByRole("heading", { level: 1, name: "Review" });
    expect(screen.getByRole("dialog").getAttribute("aria-labelledby")).toBe(heading.id);
  });

  it("keeps h2 by default on a standing panel and a modal", () => {
    render(
      <>
        <StandingPanel isOpen={false} title="Review" onClose={() => undefined}>
          <p>x</p>
        </StandingPanel>
        <Modal title="Edit" onClose={() => undefined}>
          <p>y</p>
        </Modal>
      </>,
    );
    expect(document.querySelectorAll("h2")).toHaveLength(2);
    expect(document.querySelector("h1")).toBeNull();
  });

  it("renders a modal's title at the given level", () => {
    render(
      <Modal title="Edit" headingLevel={3} onClose={() => undefined}>
        <p>y</p>
      </Modal>,
    );
    expect(screen.getByRole("heading", { level: 3, name: "Edit" }).id).toBe(screen.getByRole("dialog").getAttribute("aria-labelledby"));
  });
});

describe("Cancel slot", () => {
  it("adds the cancel classes to Cancel only, on top of the secondary look", () => {
    render(
      <ModalFooter onCancel={() => undefined} classNames={{ cancel: "app-cancel" }}>
        <Button type="submit" variant="primary">
          Save
        </Button>
      </ModalFooter>,
    );
    const cancel = screen.getByRole("button", { name: "Cancel" });
    expect(cancel.className).toContain("app-cancel");
    expect(cancel.className).toContain("sft:");
    expect(screen.getByRole("button", { name: "Save" }).className).not.toContain("app-cancel");
  });

  it("gives Cancel only the app's classes when unstyled", () => {
    render(<ModalFooter onCancel={() => undefined} classNames={{ cancel: "app-cancel" }} unstyled />);
    expect(screen.getByRole("button", { name: "Cancel" }).className).toBe("app-cancel");
  });

  it("forwards an ActionForm's cancel slot to its modal footer", () => {
    render(
      <ActionForm action={() => Promise.resolve({ ok: true })} submitLabel="Save" onCancel={() => undefined} classNames={{ cancel: "app-cancel" }}>
        <input name="x" aria-label="X" />
      </ActionForm>,
    );
    expect(screen.getByRole("button", { name: "Cancel" }).className).toContain("app-cancel");
  });
});
