// The chat look as a browser draws it: ui's compiled styles.css, then an app's Tailwind with the theme and its
// stylesheets, around a full chat rendered with the look maps. Both schemes at a phone (390 px) and a desktop
// (1440 px) width; the test measures the computed look rather than comparing pixels. Set `FLAT_PAINT_SHOTS_DIR` to
// also write a screenshot of each run there.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium, type Browser } from "@playwright/test";
import { isColorAlias, type ColorValue } from "@softure-ai/theme-kit";
import { buildThemeStylesheet, parseThemePackageConfig } from "@softure-ai/theme-kit/build";
import * as ui from "@softure-ai/ui";
import { ChatComposer, ChatEmptyState, ChatError, ChatLog, ChatMessage, ReasoningDisclosure, ToolCallCard } from "@softure-ai/ui";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { CHAT_LOOK, FLAT_PAINT_THEME } from "../src/index.js";

const PACKAGE_DIR = fileURLToPath(new URL("..", import.meta.url));
const UI_BUILD_SCRIPT = new URL("../../../foundation/ui/scripts/build-css.mjs", import.meta.url).href;
const STYLESHEETS = [
  fileURLToPath(new URL("../src/sft-bridge.css", import.meta.url)),
  fileURLToPath(new URL("../../theme-kit/src/base.css", import.meta.url)),
  fileURLToPath(new URL("../src/page.css", import.meta.url)),
];

/** The Chromium to drive: `PLAYWRIGHT_CHROMIUM_PATH` (CI sets it) or Playwright's own build; without either, skip. */
const CHROMIUM_PATH = process.env["PLAYWRIGHT_CHROMIUM_PATH"] || undefined;
const hasChromium = CHROMIUM_PATH !== undefined || existsSync(chromium.executablePath());
const SHOTS_DIR = process.env["FLAT_PAINT_SHOTS_DIR"] || undefined;

type Scheme = "light" | "dark";
const WIDTHS = [390, 1440] as const;
const SCHEMES: readonly Scheme[] = ["light", "dark"];

interface UiBuildScript {
  buildCss: (options: { outDir: string; theme: unknown }) => { gzipBytes: number };
}

function getTokenValue(name: string, scheme: Scheme): string {
  const value: ColorValue | undefined = (FLAT_PAINT_THEME.colors as Readonly<Record<string, ColorValue>>)[name];
  if (value === undefined) throw new Error(`Unknown colour token "${name}"`);
  return isColorAlias(value) ? getTokenValue(value.alias, scheme) : value[scheme];
}

/** A `#rrggbb` token as the browser reports a computed colour. */
function getTokenRgb(name: string, scheme: Scheme): string {
  const hex = getTokenValue(name, scheme).slice(1);
  const [r, g, b] = [0, 2, 4].map((index) => parseInt(hex.slice(index, index + 2), 16));
  return `rgb(${String(r)}, ${String(g)}, ${String(b)})`;
}

function getTailwindCli(): string {
  const manifestPath = createRequire(import.meta.url).resolve("@tailwindcss/cli/package.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { bin: { tailwindcss: string } };
  return join(dirname(manifestPath), manifest.bin.tailwindcss);
}

/** ui's styles.css (from its sources) and an app's globals.css on the theme, as the README wires them. */
async function buildStylesheets(workDir: string): Promise<{ uiCss: string; appCss: string }> {
  const script = (await import(UI_BUILD_SCRIPT)) as UiBuildScript;
  script.buildCss({ outDir: workDir, theme: ui });
  const manifest = JSON.parse(readFileSync(join(PACKAGE_DIR, "package.json"), "utf8")) as { softureTheme?: unknown };
  const parsed = parseThemePackageConfig(manifest.softureTheme);
  if (!parsed.ok) throw new Error(parsed.error);
  const sources = parsed.config.sources.map((source) => join(PACKAGE_DIR, "src", source));
  writeFileSync(join(workDir, "theme.css"), buildThemeStylesheet({ theme: FLAT_PAINT_THEME, sources, imports: parsed.config.imports }));
  const imports = STYLESHEETS.map((path) => `@import ${JSON.stringify(path)};\n`).join("");
  writeFileSync(
    join(workDir, "app.css"),
    `@import "tailwindcss" source(none);\n@import "./theme.css";\n${imports}@source inline("${PAGE_CLASSES}");\n`,
  );
  execFileSync(process.execPath, [getTailwindCli(), "-i", join(workDir, "app.css"), "-o", join(workDir, "out.css")], {
    cwd: workDir,
    stdio: ["ignore", "ignore", "pipe"],
  });
  return { uiCss: readFileSync(join(workDir, "styles.css"), "utf8"), appCss: readFileSync(join(workDir, "out.css"), "utf8") };
}

// The page's own classes around the chat, as an app writes them.
const PAGE_CLASSES = "mx-auto flex max-w-3xl flex-col gap-6 p-4 text-page";

/** A full chat: empty state, a user question, an answer with reasoning and three tool calls, a failed message. */
function renderChat(): string {
  const noop = (): void => undefined;
  return renderToStaticMarkup(
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-4">
      <h1 className="text-page">Project assistant</h1>
      <ChatEmptyState suggestions={["How is the Apollo project doing?", "What is due this week?"]} onSuggestion={noop} classNames={CHAT_LOOK.emptyState} />
      <ChatLog classNames={CHAT_LOOK.log}>
        <ChatMessage role="user" classNames={CHAT_LOOK.message}>
          How is the Apollo project doing?
        </ChatMessage>
        <ChatMessage role="assistant" classNames={CHAT_LOOK.message} meta="0.00432 USD, 1072 tokens">
          <ReasoningDisclosure defaultOpen classNames={CHAT_LOOK.reasoning}>
            The user asks about Apollo; the status tool has the figures.
          </ReasoningDisclosure>
          <ToolCallCard title="Project status" state="pending" classNames={CHAT_LOOK.toolCall} />
          <ToolCallCard title="Project status" state="done" classNames={CHAT_LOOK.toolCall}>
            64 % done, 7 tasks open
          </ToolCallCard>
          <ToolCallCard title="Calendar" state="error" errorText="The calendar did not answer in time." classNames={CHAT_LOOK.toolCall} />
          Apollo is at risk: it is 64 % done with 7 tasks still open.
        </ChatMessage>
        <ChatMessage role="assistant" status="error" classNames={CHAT_LOOK.message}>
          The answer stopped halfway.
        </ChatMessage>
      </ChatLog>
      <ChatError onRetry={noop} classNames={CHAT_LOOK.error} />
      <ChatComposer onSend={noop} defaultValue="What is due this week?" classNames={CHAT_LOOK.composer} />
    </main>,
  );
}

interface Measurement {
  userBubble: { background: string; border: string };
  answerBubble: { border: string };
  failedBubble: { leftWidth: string; leftColor: string };
  cards: Record<string, { style: string; leftWidth: string; statusColor: string; statusBorderStyle: string; statusContrast: number }>;
  limeFills: string[];
  overflow: number;
}

describe.skipIf(!hasChromium)("the chat look in a browser", () => {
  let browser: Browser;
  let workDir = "";
  let page = "";

  beforeAll(async () => {
    workDir = mkdtempSync(join(PACKAGE_DIR, ".chat-browser-"));
    const { uiCss, appCss } = await buildStylesheets(workDir);
    page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${uiCss}</style><style>${appCss}</style></head><body>${renderChat()}</body></html>`;
    browser = await chromium.launch({ executablePath: CHROMIUM_PATH });
    if (SHOTS_DIR !== undefined) mkdirSync(SHOTS_DIR, { recursive: true });
  }, 60_000);

  afterAll(async () => {
    await browser.close();
    if (workDir !== "") rmSync(workDir, { recursive: true, force: true });
  });

  async function measure(scheme: Scheme, width: number): Promise<Measurement> {
    const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme });
    try {
      const tab = await context.newPage();
      await tab.setContent(page.replace("<html lang=\"en\">", `<html lang="en" class="${scheme}">`));
      if (SHOTS_DIR !== undefined) await tab.screenshot({ path: join(SHOTS_DIR, `chat-${scheme}-${String(width)}.png`), fullPage: true });
      return await tab.evaluate((limeRgb) => {
        const style = (element: Element | null): CSSStyleDeclaration => {
          if (element === null) throw new Error("missing element");
          return getComputedStyle(element);
        };
        const bubble = (selector: string): Element | null => document.querySelector(`${selector} > div`);
        const luminance = (rgb: string): number => {
          const channels = (rgb.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map((part) => {
            const value = Number(part) / 255;
            return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
          });
          const [r = 0, g = 0, b = 0] = channels;
          return 0.2126 * r + 0.7152 * g + 0.0722 * b;
        };
        const contrast = (first: string, second: string): number => {
          const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a) as [number, number];
          return (lighter + 0.05) / (darker + 0.05);
        };
        const cards: Measurement["cards"] = {};
        for (const card of document.querySelectorAll("section[data-state]")) {
          const status = card.querySelector("span");
          const cardStyle = style(card);
          cards[card.getAttribute("data-state") ?? ""] = {
            style: cardStyle.borderTopStyle,
            leftWidth: cardStyle.borderLeftWidth,
            statusColor: style(status).color,
            statusBorderStyle: style(status).borderTopStyle,
            statusContrast: contrast(style(status).color, cardStyle.backgroundColor),
          };
        }
        const limeFills = [...document.querySelectorAll("*")]
          .filter((element) => getComputedStyle(element).backgroundColor === limeRgb)
          .map((element) => `${element.tagName.toLowerCase()}[${element.getAttribute("data-variant") ?? ""}]`);
        return {
          userBubble: { background: style(bubble("li[data-role=user]")).backgroundColor, border: style(bubble("li[data-role=user]")).borderTopColor },
          answerBubble: { border: style(bubble("li[data-role=assistant][data-status=done]")).borderTopColor },
          failedBubble: {
            leftWidth: style(bubble("li[data-status=error]")).borderLeftWidth,
            leftColor: style(bubble("li[data-status=error]")).borderLeftColor,
          },
          cards,
          limeFills,
          overflow: document.documentElement.scrollWidth - window.innerWidth,
        };
      }, getTokenRgb("accent-fill", scheme));
    } finally {
      await context.close();
    }
  }

  describe.each(SCHEMES)("%s scheme", (scheme) => {
    it.each(WIDTHS)("draws the chat in the Flat Paint look at %i px", async (width) => {
      const look = await measure(scheme, width);

      // The user's bubble: surface-raised (ui, through the bridge) outlined in line-strong; the answer keeps the hairline.
      expect(look.userBubble).toEqual({ background: getTokenRgb("surface-raised", scheme), border: getTokenRgb("line-strong", scheme) });
      expect(look.answerBubble.border).toBe(getTokenRgb("border", scheme));
      // A failed message carries a 4 px debt edge, not only a colour.
      expect(look.failedBubble).toEqual({ leftWidth: "4px", leftColor: getTokenRgb("debt", scheme) });

      // Tool states: border style and edge besides colour, the word in an outlined flag at AA contrast.
      expect(look.cards["pending"]).toMatchObject({ style: "dashed", leftWidth: "1px", statusBorderStyle: "dashed", statusColor: getTokenRgb("muted", scheme) });
      expect(look.cards["done"]).toMatchObject({ style: "solid", leftWidth: "1px", statusBorderStyle: "solid", statusColor: getTokenRgb("accessible", scheme) });
      expect(look.cards["error"]).toMatchObject({ style: "solid", leftWidth: "4px", statusBorderStyle: "solid", statusColor: getTokenRgb("debt", scheme) });
      for (const card of Object.values(look.cards)) expect(card.statusContrast).toBeGreaterThanOrEqual(4.5);

      // Lime is paint on one control only: the primary Send button.
      expect(look.limeFills).toEqual(["button[primary]"]);
      // Nothing scrolls sideways, on a phone either.
      expect(look.overflow).toBeLessThanOrEqual(0);
    }, 30_000);
  });
});
