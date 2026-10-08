// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CardDisclosure,
  CollapsibleSection,
  type LinkComponentProps,
  SEGMENT_ACTIVE_CLASS,
  SEGMENT_IDLE_CLASS,
  SegmentedNav,
  TabPanels,
  Tabs,
} from "../src/index.js";

afterEach(cleanup);

const ITEMS = [
  { id: "overview", label: "Overview", content: <p>overview panel</p> },
  { id: "history", label: "History", content: <p>history panel</p> },
  { id: "settings", label: "Settings", content: <input aria-label="Draft" /> },
] as const;

function getTab(name: string): HTMLElement {
  return screen.getByRole("tab", { name });
}

function getSelectedTab(): string {
  return screen.getAllByRole("tab").find((tab) => tab.getAttribute("aria-selected") === "true")?.textContent ?? "";
}

describe("Tabs", () => {
  it("renders a named tablist whose tabs point at their panel and back", () => {
    render(<Tabs label="Views" items={ITEMS} />);
    expect(screen.getByRole("tablist", { name: "Views" })).toBeDefined();
    const tab = getTab("Overview");
    const panel = screen.getByRole("tabpanel");
    expect(tab.getAttribute("aria-controls")).toBe(panel.id);
    expect(panel.getAttribute("aria-labelledby")).toBe(tab.id);
    expect(panel.textContent).toBe("overview panel");
  });

  it("keeps only the selected tab in the Tab order", () => {
    render(<Tabs label="Views" items={ITEMS} defaultValue="history" />);
    expect(screen.getAllByRole("tab").map((tab) => tab.tabIndex)).toEqual([-1, 0, -1]);
    expect(getSelectedTab()).toBe("History");
  });

  it("selects with arrows, wraps at both ends and jumps with Home and End", () => {
    render(<Tabs label="Views" items={ITEMS} />);
    fireEvent.keyDown(getTab("Overview"), { key: "ArrowLeft" });
    expect(getSelectedTab()).toBe("Settings");
    expect(document.activeElement).toBe(getTab("Settings"));
    fireEvent.keyDown(getTab("Settings"), { key: "ArrowRight" });
    expect(getSelectedTab()).toBe("Overview");
    fireEvent.keyDown(getTab("Overview"), { key: "End" });
    expect(getSelectedTab()).toBe("Settings");
    fireEvent.keyDown(getTab("Settings"), { key: "Home" });
    expect(getSelectedTab()).toBe("Overview");
    expect(screen.getByRole("tabpanel").textContent).toBe("overview panel");
  });

  it("moves focus without selecting under manual activation until Enter", () => {
    render(<Tabs label="Views" items={ITEMS} activation="manual" />);
    getTab("Overview").focus();
    fireEvent.keyDown(getTab("Overview"), { key: "ArrowRight" });
    expect(getSelectedTab()).toBe("Overview");
    expect(document.activeElement).toBe(getTab("History"));
    expect(screen.getAllByRole("tab").map((tab) => tab.tabIndex)).toEqual([-1, 0, -1]);
    fireEvent.keyDown(getTab("History"), { key: "Enter" });
    expect(getSelectedTab()).toBe("History");
  });

  it("asks the parent when controlled and follows its value", () => {
    const onChange = vi.fn();
    const { rerender } = render(<Tabs label="Views" items={ITEMS} value="overview" onChange={onChange} />);
    fireEvent.click(getTab("History"));
    expect(onChange).toHaveBeenCalledWith("history");
    expect(getSelectedTab()).toBe("Overview");
    rerender(<Tabs label="Views" items={ITEMS} value="history" onChange={onChange} />);
    expect(getSelectedTab()).toBe("History");
  });

  it("unmounts inactive panels but keeps an always-mounted one hidden with its typed text", () => {
    const items = ITEMS.map((item) => ({ ...item, isAlwaysMounted: item.id === "settings" }));
    render(<Tabs label="Views" items={items} defaultValue="settings" />);
    fireEvent.change(screen.getByLabelText("Draft"), { target: { value: "half typed" } });
    fireEvent.click(getTab("Overview"));
    const panels = document.querySelectorAll("[role=tabpanel]");
    expect([...panels].map((panel) => [panel.getAttribute("data-tab-panel"), panel.hasAttribute("hidden")])).toEqual([
      ["overview", false],
      ["settings", true],
    ]);
    fireEvent.click(getTab("Settings"));
    expect(screen.getByLabelText<HTMLInputElement>("Draft").value).toBe("half typed");
  });

  it("draws tabs with the segment classes and takes slots, or only the app's classes when unstyled", () => {
    const { rerender } = render(<Tabs label="Views" items={ITEMS} classNames={{ tab: "app-tab" }} />);
    expect(getTab("Overview").className).toBe(`${SEGMENT_ACTIVE_CLASS} app-tab`);
    expect(getTab("History").className).toBe(`${SEGMENT_IDLE_CLASS} app-tab`);
    rerender(<Tabs label="Views" items={ITEMS} classNames={{ tab: "app-tab" }} unstyled />);
    expect(getTab("Overview").className).toBe("app-tab");
    expect(screen.getByRole("tablist").getAttribute("class")).toBeNull();
  });
});

describe("TabPanels", () => {
  it("renders the active panel and the always-mounted ones hidden, nothing else", () => {
    const html = renderToStaticMarkup(
      <TabPanels
        active="history"
        panels={[
          { id: "overview", content: <p>a</p> },
          { id: "history", content: <p>b</p>, className: "app-panel" },
          { id: "update", content: <p>c</p>, isAlwaysMounted: true },
        ]}
      />,
    );
    expect(html).toBe('<div data-tab-panel="history" class="app-panel"><p>b</p></div><div data-tab-panel="update" hidden=""><p>c</p></div>');
  });

  it("shows an always-mounted panel when it is the active one", () => {
    const html = renderToStaticMarkup(<TabPanels active="update" panels={[{ id: "update", content: "c", isAlwaysMounted: true }]} />);
    expect(html).toBe('<div data-tab-panel="update">c</div>');
  });
});

describe("CollapsibleSection", () => {
  it("toggles its content from the whole bar and keeps it mounted while collapsed", () => {
    render(
      <CollapsibleSection title="Goal" subtitle="3 of 5 set">
        <input aria-label="Amount" />
      </CollapsibleSection>,
    );
    const toggle = screen.getByRole("button", { name: "Goal 3 of 5 set" });
    const content = document.getElementById(toggle.getAttribute("aria-controls") ?? "");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(content?.hidden).toBe(true);
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(content?.hidden).toBe(false);
    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "120" } });
    fireEvent.click(toggle);
    fireEvent.click(toggle);
    expect(screen.getByLabelText<HTMLInputElement>("Amount").value).toBe("120");
  });

  it("opens on first render with defaultOpen and turns the arrow", () => {
    render(<CollapsibleSection title="Goal" defaultOpen>x</CollapsibleSection>);
    expect(screen.getByRole("button", { name: "Goal" }).getAttribute("aria-expanded")).toBe("true");
    expect(document.querySelector("svg")?.getAttribute("class")).toContain("sft:rotate-90");
  });

  it("wraps the toggle in the requested heading and has none by default", () => {
    const { rerender } = render(<CollapsibleSection title="Goal">x</CollapsibleSection>);
    expect(screen.queryByRole("heading")).toBeNull();
    rerender(<CollapsibleSection title="Goal" headingLevel={3}>x</CollapsibleSection>);
    const heading = screen.getByRole("heading", { level: 3, name: "Goal" });
    expect(heading.firstElementChild?.tagName).toBe("BUTTON");
  });

  it("adds slot classes, or only them when unstyled", () => {
    const { container, rerender } = render(<CollapsibleSection title="Goal" classNames={{ root: "app-root", content: "app-content" }}>x</CollapsibleSection>);
    const root = container.firstElementChild;
    expect(root?.className).toContain("sft:rounded-card");
    expect(root?.className).toContain("app-root");
    rerender(<CollapsibleSection title="Goal" classNames={{ root: "app-root" }} unstyled>x</CollapsibleSection>);
    expect(container.firstElementChild?.className).toBe("app-root");
    expect(document.querySelector("svg")?.getAttribute("class")).toBeNull();
  });
});

describe("CardDisclosure arrow", () => {
  it("keeps its markup after moving into the shared arrow", () => {
    const html = renderToStaticMarkup(<CardDisclosure title="Card" header={<header>Card</header>} defaultOpen={false} />);
    expect(html).toContain(
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" class="sft:pointer-events-none sft:size-3.5 sft:shrink-0 sft:text-muted sft:transition-transform sft:duration-(--sft-duration-fast) sft:group-hover:text-foreground sft:motion-reduce:transition-none"><path d="m9 6 6 6-6 6"></path></svg>',
    );
  });
});

describe("SegmentedNav", () => {
  const VIEWS = [
    { id: "chart", href: "/plan?view=chart", label: "Chart" },
    { id: "table", href: "/plan?view=table", label: "Table" },
  ] as const;

  it("renders a named nav of links with aria-current only on the current one", () => {
    render(<SegmentedNav label="View" items={VIEWS} current="table" />);
    const nav = screen.getByRole("navigation", { name: "View" });
    const links = screen.getAllByRole("link");
    expect(nav.contains(links[0] ?? null)).toBe(true);
    expect(links.map((link) => [link.textContent, link.getAttribute("href"), link.getAttribute("aria-current")])).toEqual([
      ["Chart", "/plan?view=chart", null],
      ["Table", "/plan?view=table", "page"],
    ]);
    expect(links.map((link) => link.className)).toEqual([SEGMENT_IDLE_CLASS, SEGMENT_ACTIVE_CLASS]);
  });

  it("passes the link props to an injected LinkComponent and takes another aria-current", () => {
    const seen: LinkComponentProps[] = [];
    function AppLink(props: LinkComponentProps) {
      seen.push(props);
      return <a {...props} data-app-link="" />;
    }
    render(<SegmentedNav label="View" items={VIEWS} current="chart" LinkComponent={AppLink} ariaCurrent="true" classNames={{ link: "app-link" }} />);
    expect(seen.map((props) => [props.href, props["aria-current"]])).toEqual([
      ["/plan?view=chart", "true"],
      ["/plan?view=table", undefined],
    ]);
    expect(screen.getAllByRole("link").every((link) => link.hasAttribute("data-app-link"))).toBe(true);
    expect(screen.getAllByRole("link")[0]?.className).toBe(`${SEGMENT_ACTIVE_CLASS} app-link`);
  });

  it("gives links only the app's classes when unstyled", () => {
    render(<SegmentedNav label="View" items={VIEWS} current="chart" classNames={{ link: "app-link" }} unstyled />);
    expect(screen.getAllByRole("link").map((link) => link.className)).toEqual(["app-link", "app-link"]);
    expect(screen.getByRole("navigation").getAttribute("class")).toBeNull();
  });
});
