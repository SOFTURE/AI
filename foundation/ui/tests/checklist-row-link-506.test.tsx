// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Checklist, ChevronRightIcon, type ChecklistItem, type LinkComponentProps } from "../src/index.js";

// Issue #506: a whole-row link with a trailing adornment, and a done item that still links.

afterEach(() => {
  cleanup();
});

function TestLink(props: LinkComponentProps) {
  return <a data-router="" {...props} />;
}

const ITEMS: readonly ChecklistItem[] = [
  { id: "profile", label: "Fill in your profile", done: true, href: "/profile" },
  { id: "goal", label: "Add a goal", done: false, href: "/goals/new", description: "Takes a minute." },
  { id: "invite", label: "Invite a partner", done: false },
];

describe("Checklist linkDone (#506)", () => {
  it("keeps a done item as text by default", () => {
    render(<Checklist items={ITEMS} />);
    expect(screen.queryByRole("link", { name: "Fill in your profile (done)" })).toBeNull();
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("links a done item with an href and keeps its state in the name", () => {
    render(<Checklist items={ITEMS} linkDone />);
    const profile = screen.getByRole("link", { name: "Fill in your profile (done)" });
    expect(profile.getAttribute("href")).toBe("/profile");
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });
});

describe("Checklist rowLink and trailing (#506)", () => {
  it("makes the marker, the body and the trailing node one link", () => {
    render(
      <Checklist
        items={ITEMS}
        LinkComponent={TestLink}
        rowLink
        trailing={
          <span data-testid="chevron">
            <ChevronRightIcon />
          </span>
        }
        classNames={{ row: "app-row" }}
      />,
    );
    const goal = screen.getByRole("link", { name: "Add a goal (to do) Takes a minute." });
    expect(goal.getAttribute("href")).toBe("/goals/new");
    expect(goal.hasAttribute("data-router")).toBe(true);
    expect(goal.className).toContain("app-row");
    expect(goal.className).toContain("sft:flex");
    expect(goal.querySelector("[aria-hidden='true']")).not.toBeNull();
    expect(goal.querySelector("[data-testid='chevron']")).not.toBeNull();
    expect(goal.parentElement?.tagName).toBe("LI");
    expect(goal.className).not.toContain("sft:underline");
  });

  it("renders a row with no link as today, with the trailing node after the body", () => {
    render(<Checklist items={ITEMS} rowLink trailing={<span data-testid="after">›</span>} />);
    const invite = screen.getByText("Invite a partner").closest("li");
    expect(invite?.querySelector("a")).toBeNull();
    expect(invite?.querySelector("[data-testid='after']")).not.toBeNull();
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("passes the item and whether it links to a trailing function", () => {
    render(
      <Checklist
        items={ITEMS}
        rowLink
        linkDone
        trailing={(item, { isLink }) => (isLink ? <span aria-hidden="true" data-testid={`chevron-${item.id}`}>›</span> : null)}
      />,
    );
    expect(screen.getByTestId("chevron-profile")).toBeDefined();
    expect(screen.getByTestId("chevron-goal")).toBeDefined();
    expect(screen.queryByTestId("chevron-invite")).toBeNull();
    expect(screen.getByRole("link", { name: "Fill in your profile (done)" }).getAttribute("href")).toBe("/profile");
  });

  it("puts the trailing node after the body without rowLink, outside the label link", () => {
    render(<Checklist items={ITEMS} trailing={<span data-testid="after">›</span>} />);
    const link = screen.getByRole("link", { name: "Add a goal (to do)" });
    expect(link.querySelector("[data-testid='after']")).toBeNull();
    expect(screen.getAllByTestId("after")).toHaveLength(3);
  });

  it("adds no row link and no trailing element by default", () => {
    const { container } = render(<Checklist items={ITEMS} />);
    expect(container.querySelectorAll("li > a")).toHaveLength(0);
    expect(container.querySelectorAll("li > span")).toHaveLength(6);
  });
});
