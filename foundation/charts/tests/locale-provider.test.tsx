// @vitest-environment happy-dom
// Issue #435: the client components take their locale from the prop, then UiLocaleProvider, then `en`.
import { UiLocaleProvider } from "@softure-ai/ui";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { ChartCursor, chartsMessages, type CursorPoint, EventAxis, type EventAxisItem } from "../src/index.js";

afterEach(cleanup);

const POINTS: CursorPoint[] = [{ key: 0, xPercent: 0, heading: "Jan 2026", values: [] }];
const ITEMS: EventAxisItem[] = [{ kind: "milestone", key: "unlock", label: "Funds unlock", xPercent: 60 }];

function renderInPolish(children: ReactNode): string | null {
  render(<UiLocaleProvider locale="pl">{children}</UiLocaleProvider>);
  return screen.getByRole("group").getAttribute("aria-label");
}

describe("ChartCursor under UiLocaleProvider", () => {
  it("takes the provider's locale when given none", () => {
    const label = renderInPolish(<ChartCursor title="Savings" points={POINTS}><div /></ChartCursor>);
    expect(label).toBe(chartsMessages.pl.cursor.label.replace("{title}", "Savings"));
  });

  it("keeps an explicit locale over the provider's", () => {
    const label = renderInPolish(<ChartCursor title="Savings" points={POINTS} locale="en"><div /></ChartCursor>);
    expect(label).toBe(chartsMessages.en.cursor.label.replace("{title}", "Savings"));
  });
});

describe("EventAxis under UiLocaleProvider", () => {
  it("takes the provider's locale when given none", () => {
    const label = renderInPolish(<EventAxis title="Life events" items={ITEMS} />);
    expect(label).toBe(chartsMessages.pl.eventAxis.label.replace("{title}", "Life events"));
  });

  it("keeps an explicit locale over the provider's", () => {
    const label = renderInPolish(<EventAxis title="Life events" items={ITEMS} locale="en" />);
    expect(label).toBe(chartsMessages.en.eventAxis.label.replace("{title}", "Life events"));
  });
});
