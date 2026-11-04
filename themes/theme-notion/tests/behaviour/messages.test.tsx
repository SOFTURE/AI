// @vitest-environment happy-dom
import { cleanup, fireEvent, render } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  AsidePanel,
  AsidePanelProvider,
  AsidePanelSidebarOpener,
  AsidePanelToggle,
  Breadcrumb,
  BreadcrumbEllipsis,
  CommandDialog,
  FilterChipAdd,
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
  SortableHandle,
  SortableItem,
  SortableList,
  Spinner,
  Steps,
  type StepState,
  UploadField,
  UploadItem,
  type UploadFileItem,
  type UploadState,
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

const UPLOAD_ITEM: UploadFileItem = { id: "file", name: "{name}", size: 1000, state: "queued" };

const CASES: Readonly<Record<string, MessageCase>> = {
  ...Object.fromEntries(
    (
      [
        ["show", false, '[data-slot="aside-panel-toggle"]'],
        ["hide", true, '[data-slot="aside-panel-toggle"]'],
        ["showSidebar", true, '[data-slot="aside-panel-sidebar-opener"]'],
      ] as const
    ).map(([key, isOpen, selector]): [string, MessageCase] => [
      `asidePanel.${key}`,
      {
        render: (text) => (
          <AsidePanelProvider initialState={{ isOpen, width: "standard" }}>
            <AsidePanelToggle {...(key === "show" ? { showLabel: text } : { hideLabel: text })} />
            <AsidePanelSidebarOpener label={text} />
          </AsidePanelProvider>
        ),
        read: attributeOf(selector, "aria-label"),
      },
    ]),
  ),
  ...Object.fromEntries(
    (
      [
        ["widen", "standard"],
        ["narrow", "half"],
      ] as const
    ).map(([key, width]): [string, MessageCase] => [
      `asidePanel.${key}`,
      {
        render: (text) => (
          <AsidePanelProvider initialState={{ isOpen: true, width }}>
            <AsidePanel title="Map" {...(key === "widen" ? { widenLabel: text } : { narrowLabel: text })}>
              Body
            </AsidePanel>
          </AsidePanelProvider>
        ),
        read: attributeOf('[data-slot="aside-panel-header"] [data-slot="button"]', "aria-label"),
      },
    ]),
  ),
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
  "filterChip.add": { render: (text) => <FilterChipAdd label={text}>{null}</FilterChipAdd>, read: textOf('[data-slot="filter-chip-add"] span') },
  ...Object.fromEntries(
    (["done", "current", "todo", "failed"] as const satisfies readonly StepState[]).map((state) => [
      `steps.${state}`,
      {
        render: (text: string | undefined) => (
          <Steps label="Run" steps={[{ key: "one", title: "One", state }]} stateLabels={text === undefined ? undefined : { [state]: text }} />
        ),
        read: () => document.querySelector('[data-slot="steps"] .sr-only')?.textContent?.replace(/^, /, ""),
      },
    ]),
  ),
  "sortable.instructions": {
    render: (text) => (
      <SortableList label="List" items={["a"]} onReorder={() => undefined} {...(text === undefined ? {} : { instructions: text })}>
        <SortableItem id="a">A</SortableItem>
      </SortableList>
    ),
    read: () => {
      const describedBy = document.querySelector('[data-slot="sortable-item"]')?.getAttribute("aria-describedby") ?? "";
      return document.getElementById(describedBy)?.textContent;
    },
  },
  "sortable.handle": {
    render: (text) => (
      <SortableList label="List" items={["a"]} onReorder={() => undefined} dragBy="handle">
        <SortableItem id="a">
          <SortableHandle label={text} />
        </SortableItem>
      </SortableList>
    ),
    read: attributeOf('[data-slot="sortable-handle"]', "aria-label"),
  },
  // The upload field's button and drop hint, with one file and with several.
  ...Object.fromEntries(
    ([
      ["choose", true, '[data-slot="button"]'],
      ["chooseOne", false, '[data-slot="button"]'],
      ["drop", true, '[data-slot="upload-drop-hint"]'],
      ["dropOne", false, '[data-slot="upload-drop-hint"]'],
    ] as const).map(([key, multiple, selector]) => [
      `upload.${key}`,
      {
        render: (text: string | undefined) => (
          <UploadField label="Files" multiple={multiple} messages={text === undefined ? undefined : { [key]: text }} onFilesSelected={() => undefined} />
        ),
        read: textOf(selector),
      },
    ]),
  ),
  "upload.dropping": {
    render: (text) => <UploadField label="Files" messages={text === undefined ? undefined : { dropping: text }} onFilesSelected={() => undefined} />,
    // Dragged over first, so the hint reads "drop to add".
    read: () => {
      const area = document.querySelector('[data-slot="upload-drop-area"]');
      if (area !== null) fireEvent.dragOver(area, { dataTransfer: { files: [], dropEffect: "none" } });
      return document.querySelector('[data-slot="upload-drop-hint"]')?.textContent;
    },
  },
  // A file named "{name}", so the filled-in text reads as the template itself.
  ...Object.fromEntries(
    ([
      ["retry", "failed", () => document.querySelector('[data-slot="upload-item-actions"] [data-slot="button"]')?.textContent],
      ["pause", "uploading", attributeOf('[data-slot="upload-item-actions"] [data-slot="button"]', "aria-label")],
      ["resume", "paused", attributeOf('[data-slot="upload-item-actions"] [data-slot="button"]', "aria-label")],
      ["progress", "uploading", attributeOf('[data-slot="progress"]', "aria-label")],
    ] as const).map(([key, state, read]) => [
      `upload.${key}`,
      {
        render: (text: string | undefined) => (
          <UploadItem
            item={{ ...UPLOAD_ITEM, state }}
            messages={text === undefined ? undefined : { [key]: text }}
            onRetry={() => undefined}
            onPause={() => undefined}
            onResume={() => undefined}
          />
        ),
        read,
      },
    ]),
  ),
  "upload.remove": {
    render: (text) => <UploadItem item={UPLOAD_ITEM} messages={text === undefined ? undefined : { remove: text }} onRemove={() => undefined} />,
    read: attributeOf('[data-slot="upload-item-actions"] [data-slot="button"]', "aria-label"),
  },
  ...Object.fromEntries(
    (["queued", "uploading", "paused", "done", "failed"] as const satisfies readonly UploadState[]).map((state) => [
      `upload.${state}`,
      {
        render: (text: string | undefined) => <UploadItem item={{ ...UPLOAD_ITEM, state }} messages={text === undefined ? undefined : { [state]: text }} />,
        read: textOf('[data-slot="status-label"]'),
      },
    ]),
  ),
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
// Checked elsewhere: the phone sheet's copy where a phone is stubbed (tests/behaviour/sidebar.test.tsx), the drag
// announcements during a keyboard drag (tests/notion/Sortable.test.tsx).
const CHECKED_ELSEWHERE = new Set([
  "sidebar.mobileTitle",
  "sidebar.mobileDescription",
  "sortable.pickedUp",
  "sortable.moved",
  "sortable.dropped",
  "sortable.cancelled",
]);

describe("the message layer", () => {
  it("has a case for every built-in text", () => {
    expect([...Object.keys(CASES), ...CHECKED_ELSEWHERE].sort()).toEqual([...MESSAGE_PATHS].sort());
  });

  it.each(MESSAGE_PATHS.filter((path) => !CHECKED_ELSEWHERE.has(path)))("%s is English by default and the app's text when given", (path) => {
    const messageCase = CASES[path];
    if (messageCase === undefined) throw new Error(`no case for ${path}`);

    render(messageCase.render(undefined));
    expect(messageCase.read()).toBe(readMessage(path));
    cleanup();

    render(messageCase.render("App text"));
    expect(messageCase.read()).toBe("App text");
  });
});
