// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  Breadcrumb,
  BreadcrumbEllipsis,
  CommandDialog,
  Dialog,
  DialogContent,
  DialogTitle,
  notionMessages,
  Sheet,
  SheetContent,
  SheetTitle,
  SidePanel,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  Spinner,
} from "../../src/index.js";
import { installDomShims } from "../gallery/dom.js";

beforeAll(installDomShims);
afterEach(cleanup);

/** How a message reaches the page: rendered with the app's text (or without it), and read back from the DOM. */
interface MessageCase {
  readonly render: (text: string | undefined) => ReactElement;
  readonly read: () => string | null | undefined;
}

const textOf = (selector: string) => () => document.querySelector(selector)?.textContent;
const attributeOf = (selector: string, name: string) => () => document.querySelector(selector)?.getAttribute(name);

// An `aria-label` given as undefined would still replace the default (props spread last), so it is left out instead.
function labelled(text: string | undefined): { "aria-label"?: string } {
  return text === undefined ? {} : { "aria-label": text };
}

const CASES: Readonly<Record<string, MessageCase>> = {
  "breadcrumb.label": { render: (text) => <Breadcrumb {...labelled(text)} />, read: attributeOf('[data-slot="breadcrumb"]', "aria-label") },
  "breadcrumb.more": { render: (text) => <BreadcrumbEllipsis label={text} />, read: textOf('[data-slot="breadcrumb-ellipsis"] .sr-only') },
  "dialog.close": {
    render: (text) => (
      <Dialog open>
        <DialogContent closeLabel={text} aria-describedby={undefined}>
          <DialogTitle>Title</DialogTitle>
        </DialogContent>
      </Dialog>
    ),
    read: textOf('[data-slot="dialog-close"] .sr-only'),
  },
  "sheet.close": {
    render: (text) => (
      <Sheet open>
        <SheetContent closeLabel={text} aria-describedby={undefined}>
          <SheetTitle>Title</SheetTitle>
        </SheetContent>
      </Sheet>
    ),
    read: textOf('[data-slot="sheet-content"] > button .sr-only'),
  },
  "sidePanel.close": {
    render: (text) => (
      <SidePanel id="panel" heading="Layers" layout="over" isOpen onClose={() => undefined} closeLabel={text}>
        Content
      </SidePanel>
    ),
    read: () => document.querySelector('[data-slot="side-panel"] button')?.getAttribute("aria-label") ?? document.querySelector('[data-slot="side-panel"] button')?.textContent,
  },
  "sidebar.toggle": {
    render: (text) => (
      <SidebarProvider>
        <SidebarTrigger label={text} />
        <SidebarRail label={text} />
      </SidebarProvider>
    ),
    read: () => {
      const trigger = textOf('[data-slot="sidebar-trigger"] .sr-only')();
      const rail = attributeOf('[data-slot="sidebar-rail"]', "aria-label")();
      return trigger === rail ? trigger : `${String(trigger)} / ${String(rail)}`;
    },
  },
  "spinner.label": { render: (text) => <Spinner {...labelled(text)} />, read: attributeOf('[role="status"]', "aria-label") },
  "command.title": { render: (text) => <CommandDialog open title={text} />, read: textOf('[data-slot="dialog-title"]') },
  "command.description": { render: (text) => <CommandDialog open description={text} />, read: textOf('[data-slot="dialog-description"]') },
};

function readMessage(path: string): string {
  const [group = "", key = ""] = path.split(".");
  const messages = notionMessages.en as unknown as Record<string, Record<string, string>>;
  return messages[group]?.[key] ?? "";
}

const MESSAGE_PATHS = Object.entries(notionMessages.en).flatMap(([group, texts]) => Object.keys(texts).map((key) => `${group}.${key}`));
// The phone sheet's copy is checked where a phone is stubbed (tests/behaviour/sidebar.test.tsx).
const PHONE_ONLY = new Set(["sidebar.mobileTitle", "sidebar.mobileDescription"]);

describe("the message layer", () => {
  it("has a case for every built-in text", () => {
    expect([...Object.keys(CASES), ...PHONE_ONLY].sort()).toEqual([...MESSAGE_PATHS].sort());
  });

  it.each(MESSAGE_PATHS.filter((path) => !PHONE_ONLY.has(path)))("%s is English by default and the app's text when given", (path) => {
    const messageCase = CASES[path];
    if (messageCase === undefined) throw new Error(`no case for ${path}`);

    render(messageCase.render(undefined));
    expect(messageCase.read()).toBe(readMessage(path));
    cleanup();

    render(messageCase.render("App text"));
    expect(messageCase.read()).toBe("App text");
  });
});
