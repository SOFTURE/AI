import { Inbox } from "lucide-react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import * as theme from "../../src/index.js";
import { TabBar } from "../../src/notion/TabBar.js";

const LINK_CLASS =
  "relative inline-flex h-control-height items-center gap-1.5 rounded-md px-2 text-ui-medium whitespace-nowrap text-muted-foreground transition-colors duration-120 after:absolute after:inset-x-0 after:-bottom-1 after:h-0.5 after:bg-foreground after:opacity-0 hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none aria-[current=page]:text-foreground aria-[current=page]:after:opacity-100 [&amp;_svg]:size-4 [&amp;_svg]:shrink-0";

const TABS = [
  { key: "open", label: "Open", href: "?tab=open", count: 3 },
  { key: "empty", label: "Empty", href: "?tab=empty", count: 0 },
  { key: "all", label: "All", href: "?tab=all" },
] as const;

describe("TabBar", () => {
  it("renders a labelled nav of links with the line-tab classes", () => {
    expect(renderToStaticMarkup(<TabBar label="Views" tabs={[{ key: "all", label: "All", href: "/all" }]} current="all" />)).toBe(
      `<nav aria-label="Views" data-slot="tab-bar" class="overflow-x-auto border-b border-border"><ul class="flex gap-1 pb-1"><li><a href="/all" class="${LINK_CLASS}" data-tab="all" aria-current="page">All</a></li></ul></nav>`,
    );
  });

  it("marks only the current tab with aria-current", () => {
    const html = renderToStaticMarkup(<TabBar label="Views" tabs={TABS} current="empty" />);

    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    expect(html).toContain('data-tab="empty" aria-current="page"');
    expect(html).toContain('data-tab="open">');
    expect(html).toContain('data-tab="all">');
  });

  it("draws the count only when it is given, 0 included", () => {
    const html = renderToStaticMarkup(<TabBar label="Views" tabs={TABS} current="open" />);

    expect(html.match(/data-slot="tab-bar-count"/g)).toHaveLength(2);
    expect(html).toContain(
      'Open<span data-slot="tab-bar-count" class="rounded-xs bg-accent px-1 text-small text-muted-foreground tabular-nums">3</span>',
    );
    expect(html).toContain('Empty<span data-slot="tab-bar-count" class="rounded-xs bg-accent px-1 text-small text-muted-foreground tabular-nums">0</span>');
    expect(html).toContain('data-tab="all">All</a>');
  });

  it("draws the icon before the label", () => {
    const html = renderToStaticMarkup(
      <TabBar label="Views" tabs={[{ key: "inbox", label: "Inbox", href: "/inbox", icon: <Inbox aria-hidden /> }]} current="inbox" />,
    );

    expect(html).toMatch(/aria-current="page"><svg[^>]*>.*<\/svg>Inbox<\/a>/);
  });

  it("is exported from the package root", () => {
    expect(theme.TabBar).toBe(TabBar);
  });
});
