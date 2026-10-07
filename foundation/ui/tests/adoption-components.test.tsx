// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type ActionResult,
  Button,
  Card,
  ChildIcon,
  DEFAULT_THEME,
  LoanIcon,
  Modal,
  NUMBER_INPUT_CLASS,
  SEGMENT_ACTIVE_CLASS,
  SEGMENT_IDLE_CLASS,
  SEGMENTED_GROUP_CLASS,
  StandingPanel,
  themeFromDesignJson,
  uiMessages,
} from "../src/index.js";

afterEach(cleanup);

describe("ActionResult", () => {
  it("accepts a bare success, ok() and a success with a value", () => {
    const results: ActionResult[] = [{ ok: true }, { ok: true, value: undefined }, { ok: true, value: { id: 7 } }, { ok: false, error: "app.failed" }];
    expect(results.map((result) => result.ok)).toEqual([true, true, true, false]);
  });
});

describe("Button ink variants", () => {
  it("fills with the text colour, or outlines in it", () => {
    const ink = renderToStaticMarkup(<Button variant="ink">Go</Button>);
    expect(ink).toContain('data-variant="ink"');
    expect(ink).toContain("sft:bg-foreground");
    expect(ink).toContain("sft:text-background");
    const outline = renderToStaticMarkup(<Button variant="ink-outline">Go</Button>);
    expect(outline).toContain("sft:border-foreground/45");
    expect(outline).toContain("sft:bg-transparent");
  });
});

describe("Button pendingLabel", () => {
  it("shows the label and reserves the pending label while idle", () => {
    render(<Button variant="primary" pendingLabel="Saving…">Save</Button>);
    const button = screen.getByRole("button");
    expect(button.textContent).toBe("Save");
    expect(button.querySelector("[data-reserve]")?.getAttribute("data-reserve")).toBe("Saving…");
    expect(button.querySelector("svg")).toBeNull();
  });

  it("shows the pending label with a spinner and reserves the idle label while pending", () => {
    render(
      <Button variant="primary" pending pendingLabel="Saving…">
        Save
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Saving…" });
    expect(button.textContent).toBe("Saving…");
    expect(button.querySelector("[data-reserve]")?.getAttribute("data-reserve")).toBe("Save");
    expect(button.querySelectorAll("svg")).toHaveLength(1);
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(button.hasAttribute("disabled")).toBe(true);
  });

  it("puts the spinner in place of the left icon, so the reserve needs no room for it", () => {
    const html = renderToStaticMarkup(
      <Button variant="primary" pending pendingLabel="Saving…" iconLeft={<ChildIcon />}>
        Save
      </Button>,
    );
    expect(html.match(/<svg/g)).toHaveLength(1);
    expect(html).not.toContain("sft:after:pl-");
  });

  it("keeps the old behaviour without pendingLabel", () => {
    expect(renderToStaticMarkup(<Button variant="primary" pending>Save</Button>)).not.toContain("data-reserve");
  });
});

describe("Modal panel and overlay", () => {
  it("draws the overlay in the overlay token", () => {
    render(
      <Modal title="T" onClose={() => undefined}>
        <p>x</p>
      </Modal>,
    );
    const overlay = screen.getByRole("dialog").parentElement;
    expect(overlay?.className).toContain("sft:bg-overlay");
    expect(overlay?.className).not.toContain("bg-background/80");
  });

  it("stands at the right edge, full height, with width panel", () => {
    render(
      <Modal title="T" width="panel" onClose={() => undefined}>
        <p>x</p>
      </Modal>,
    );
    const panel = screen.getByRole("dialog");
    expect(panel.className).toContain("sft:h-dvh");
    expect(panel.className).toContain("sft:sm:w-150");
    expect(panel.parentElement?.className).toContain("sft:justify-end");
  });

  it("has an overlay token in both schemes and in design.json", () => {
    expect(DEFAULT_THEME.light["color-overlay"]).toBe("rgb(246 247 248 / 0.8)");
    expect(DEFAULT_THEME.dark["color-overlay"]).toBe("rgb(12 12 13 / 0.8)");
    const result = themeFromDesignJson({ schemaVersion: 2, themes: { dark: { roles: { overlay: "rgb(0 0 0 / 0.6)" } } } });
    expect(result.ok && result.value.theme.dark?.["color-overlay"]).toBe("rgb(0 0 0 / 0.6)");
  });
});

function PanelHarness({ onClose }: { readonly onClose?: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setIsOpen(true)}>
        Open
      </button>
      <main>page</main>
      <StandingPanel
        isOpen={isOpen}
        title="Review"
        onClose={() => {
          onClose?.();
          setIsOpen(false);
        }}
      >
        <input aria-label="Draft" />
        <button type="button" onClick={() => setIsConfirming(true)}>
          Confirm
        </button>
        {isConfirming ? (
          <Modal title="Sure?" width="confirmation" onClose={() => setIsConfirming(false)}>
            <p>?</p>
          </Modal>
        ) : null}
      </StandingPanel>
    </div>
  );
}

describe("StandingPanel", () => {
  it("is mounted but hidden and not a dialog while closed", () => {
    render(<PanelHarness />);
    expect(screen.queryByRole("dialog")).toBeNull();
    const overlay = document.querySelector("[data-standing-panel]");
    expect(overlay?.hasAttribute("hidden")).toBe(true);
    expect(screen.getByText("page").closest("[inert]")).toBeNull();
  });

  it("opens as a modal dialog, makes the page inert and keeps a draft across a close", () => {
    render(<PanelHarness />);
    fireEvent.click(screen.getByText("Open"));
    const dialog = screen.getByRole("dialog", { name: "Review" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(document.activeElement).toBe(dialog);
    expect(screen.getByText<HTMLElement>("page").inert).toBe(true);
    fireEvent.change(screen.getByLabelText("Draft"), { target: { value: "half done" } });
    fireEvent.click(screen.getByRole("button", { name: uiMessages.en.modal.close }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText<HTMLElement>("page").inert).toBe(false);
    expect((document.querySelector("input[aria-label=Draft]") as HTMLInputElement).value).toBe("half done");
  });

  it("closes on Escape from inside, not from outside", () => {
    const onClose = vi.fn();
    render(<PanelHarness onClose={onClose} />);
    fireEvent.click(screen.getByText("Open"));
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByLabelText("Draft"), { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("leaves a nested modal's Escape to the modal", () => {
    const onClose = vi.fn();
    render(<PanelHarness onClose={onClose} />);
    fireEvent.click(screen.getByText("Open"));
    fireEvent.click(screen.getByText("Confirm"));
    fireEvent.keyDown(screen.getByRole("dialog", { name: "Sure?" }), { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Sure?" })).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Review" })).toBeTruthy();
  });
});

describe("Card", () => {
  it("shows a step badge, a tick when done, and an accent bar, all hidden from assistive technology", () => {
    const html = renderToStaticMarkup(
      <Card title="Income" step={2} accent="success">
        x
      </Card>,
    );
    expect(html).toMatch(/<span aria-hidden="true" class="[^"]*sft:rounded-pill[^"]*">2<\/span>/);
    expect(html).toMatch(/<span aria-hidden="true" data-accent="success" class="[^"]*sft:bg-success/);
    const done = renderToStaticMarkup(
      <Card title="Income" step={2} done>
        x
      </Card>,
    );
    expect(done).toMatch(/data-done="true" class="[^"]*sft:text-success[^"]*"><svg/);
  });

  it("sets the heading level apart from its size", () => {
    const html = renderToStaticMarkup(
      <Card title="Plan" headingLevel={3} headingSize="section">
        x
      </Card>,
    );
    expect(html).toMatch(/<h3 class="[^"]*sft:text-xl[^"]*sft:sm:text-2xl[^"]*">Plan<\/h3>/);
    expect(renderToStaticMarkup(<Card title="Plan">x</Card>)).toMatch(/<h2 class="[^"]*sft:text-lg[^"]*">Plan<\/h2>/);
  });

  it("collapses its content under the header, keeping it mounted", () => {
    render(
      <Card title="Stress" collapsible action={<button type="button">Add</button>}>
        <input aria-label="Note" />
      </Card>,
    );
    const toggle = screen.getByRole("button", { name: uiMessages.en.card.expand.replace("{title}", "Stress") });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    const note = document.querySelector("input[aria-label=Note]");
    expect(note?.closest("[hidden]")).not.toBeNull();
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(toggle.getAttribute("aria-label")).toBe(uiMessages.en.card.collapse.replace("{title}", "Stress"));
    expect(note?.closest("[hidden]")).toBeNull();
    expect(screen.getByRole("heading", { name: "Stress" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add" })).toBeTruthy();
  });

  it("starts open with defaultOpen and ignores collapsible without a title", () => {
    render(
      <Card title="Open" collapsible defaultOpen>
        x
      </Card>,
    );
    expect(screen.getByRole("button", { expanded: true })).toBeTruthy();
    cleanup();
    expect(renderToStaticMarkup(<Card collapsible>x</Card>)).not.toContain("aria-expanded");
  });
});

describe("icons, segments and number inputs", () => {
  it("has the child and loan icons", () => {
    expect(renderToStaticMarkup(<ChildIcon />)).toContain('<circle cx="12" cy="13" r="8">');
    expect(renderToStaticMarkup(<LoanIcon />)).toContain('<path d="M19 5 5 19">');
  });

  it("exports the segment looks for an app's own segments", () => {
    expect(SEGMENTED_GROUP_CLASS).toContain("sft:rounded-control");
    expect(SEGMENT_ACTIVE_CLASS).toContain("sft:bg-accent-fill");
    expect(SEGMENT_IDLE_CLASS).toContain("sft:text-muted");
  });

  it("draws numbers with a slashed zero", () => {
    expect(NUMBER_INPUT_CLASS.split(" ")).toContain("sft:slashed-zero");
  });
});
