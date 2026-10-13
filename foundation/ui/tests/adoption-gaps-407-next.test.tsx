// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getQueryHref } from "../src/index.js";

// Issue #407.7: the query-parameter segmented nav of `@softure-ai/ui/next`. Issue #454: outside a Next request
// (both hooks return `null`) and with the active view passed by the server.

interface NavigationState {
  pathname: string | null;
  search: string | null;
}

const navigation = vi.hoisted((): NavigationState => ({ pathname: "/plan", search: "" }));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useSearchParams: () => (navigation.search === null ? null : new URLSearchParams(navigation.search)),
}));

vi.mock("next/link", () => ({
  default: ({ scroll, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { readonly scroll?: boolean }) => (
    <a data-scroll={String(scroll)} {...props} />
  ),
}));

const { QuerySegmentedNav } = await import("../src/next/index.js");

afterEach(cleanup);

describe("getQueryHref", () => {
  it("sets the parameter and keeps the others in order", () => {
    expect(getQueryHref({ pathname: "/plan", search: "?year=2026&view=table", param: "view", value: "chart" })).toBe(
      "/plan?year=2026&view=chart",
    );
    expect(getQueryHref({ pathname: "/plan", search: "year=2026", param: "view", value: "chart" })).toBe("/plan?year=2026&view=chart");
  });

  it("removes the parameter for the default view, and the question mark with it", () => {
    expect(getQueryHref({ pathname: "/plan", search: "view=chart&year=2026", param: "view", value: null })).toBe("/plan?year=2026");
    expect(getQueryHref({ pathname: "/plan", search: "?view=chart", param: "view", value: null })).toBe("/plan");
  });
});

describe("QuerySegmentedNav (#407.7)", () => {
  const items = [
    { id: "table", label: "Table" },
    { id: "chart", label: "Chart" },
  ] as const;

  beforeEach(() => {
    navigation.pathname = "/plan";
    navigation.search = "";
  });

  it("links each view through the parameter, keeps the other parameters and never scrolls", () => {
    navigation.search = "year=2026&view=chart";
    render(<QuerySegmentedNav label="View" param="view" items={items} defaultId="table" />);
    const table = screen.getByRole("link", { name: "Table" });
    const chart = screen.getByRole("link", { name: "Chart" });
    expect(table.getAttribute("href")).toBe("/plan?year=2026");
    expect(chart.getAttribute("href")).toBe("/plan?year=2026&view=chart");
    expect(chart.getAttribute("aria-current")).toBe("page");
    expect(table.getAttribute("aria-current")).toBeNull();
    expect(table.getAttribute("data-scroll")).toBe("false");
  });

  it("marks the default view without the parameter or with an unknown value", () => {
    navigation.search = "view=nope";
    render(<QuerySegmentedNav label="View" param="view" items={items} defaultId="table" />);
    expect(screen.getByRole("link", { name: "Table" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("navigation", { name: "View" })).toBeDefined();
  });
});

describe("QuerySegmentedNav (#454)", () => {
  const items = [
    { id: "table", label: "Table" },
    { id: "chart", label: "Chart" },
  ] as const;

  beforeEach(() => {
    navigation.pathname = "/plan";
    navigation.search = "";
  });

  it("renders outside a Next request with query-only links and the default view current", () => {
    navigation.pathname = null;
    navigation.search = null;
    render(<QuerySegmentedNav label="View" param="view" items={items} defaultId="table" />);
    const table = screen.getByRole("link", { name: "Table" });
    expect(table.getAttribute("href")).toBe("?");
    expect(screen.getByRole("link", { name: "Chart" }).getAttribute("href")).toBe("?view=chart");
    expect(table.getAttribute("aria-current")).toBe("page");
  });

  it("treats a null query as empty when the pathname is known", () => {
    navigation.search = null;
    render(<QuerySegmentedNav label="View" param="view" items={items} defaultId="table" />);
    expect(screen.getByRole("link", { name: "Table" }).getAttribute("href")).toBe("/plan");
    expect(screen.getByRole("link", { name: "Chart" }).getAttribute("href")).toBe("/plan?view=chart");
  });

  it("marks the active view the server passed when the URL has no parameter", () => {
    render(<QuerySegmentedNav label="View" param="view" items={items} defaultId="table" active="chart" />);
    expect(screen.getByRole("link", { name: "Chart" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Table" }).getAttribute("aria-current")).toBeNull();
  });

  it("lets the active view win over the URL and still keeps the other parameters in the links", () => {
    navigation.search = "year=2026&view=chart";
    render(<QuerySegmentedNav label="View" param="view" items={items} defaultId="table" active="table" />);
    const table = screen.getByRole("link", { name: "Table" });
    expect(table.getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Chart" }).getAttribute("aria-current")).toBeNull();
    expect(table.getAttribute("href")).toBe("/plan?year=2026");
    expect(screen.getByRole("link", { name: "Chart" }).getAttribute("href")).toBe("/plan?year=2026&view=chart");
  });
});
