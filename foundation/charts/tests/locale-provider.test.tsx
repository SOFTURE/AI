// @vitest-environment happy-dom
// Issue #435: the client components take their locale from the prop, then UiLocaleProvider, then `en`.
// Issue #446: English is the only built-in copy, so a locale without the app's translation reads English.
import { UiLocaleProvider } from "@softure-ai/ui";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { ChartCursor, chartsMessages, type CursorPoint, EventAxis, type EventAxisItem } from "../src/index.js";

afterEach(cleanup);

const POINTS: CursorPoint[] = [{ key: 0, xPercent: 0, heading: "Jan 2026", values: [] }];
const ITEMS: EventAxisItem[] = [{ kind: "milestone", key: "unlock", label: "Funds unlock", xPercent: 60 }];

function renderInGerman(children: ReactNode): string | null {
  render(<UiLocaleProvider locale="de">{children}</UiLocaleProvider>);
  return screen.getByRole("group").getAttribute("aria-label");
}

describe("ChartCursor under UiLocaleProvider", () => {
  it("reads the built-in English copy under a provider's locale with no translation", () => {
    const label = renderInGerman(<ChartCursor title="Savings" points={POINTS}><div /></ChartCursor>);
    expect(label).toBe(chartsMessages.en.cursor.label.replace("{title}", "Savings"));
  });

  it("reads the app's own translation under the provider's locale", () => {
    const messages = { cursor: { label: "Diagramm {title}" } };
    const label = renderInGerman(<ChartCursor title="Savings" points={POINTS} messages={messages}><div /></ChartCursor>);
    expect(label).toBe("Diagramm Savings");
  });

  it("keeps an explicit locale over the provider's", () => {
    const label = renderInGerman(<ChartCursor title="Savings" points={POINTS} locale="en"><div /></ChartCursor>);
    expect(label).toBe(chartsMessages.en.cursor.label.replace("{title}", "Savings"));
  });
});

describe("EventAxis under UiLocaleProvider", () => {
  it("reads the built-in English copy under a provider's locale with no translation", () => {
    const label = renderInGerman(<EventAxis title="Life events" items={ITEMS} />);
    expect(label).toBe(chartsMessages.en.eventAxis.label.replace("{title}", "Life events"));
  });

  it("reads the app's own translation under the provider's locale", () => {
    const messages = { eventAxis: { label: "Ereignisse {title}" } };
    const label = renderInGerman(<EventAxis title="Life events" items={ITEMS} messages={messages} />);
    expect(label).toBe("Ereignisse Life events");
  });

  it("keeps an explicit locale over the provider's", () => {
    const label = renderInGerman(<EventAxis title="Life events" items={ITEMS} locale="en" />);
    expect(label).toBe(chartsMessages.en.eventAxis.label.replace("{title}", "Life events"));
  });
});
