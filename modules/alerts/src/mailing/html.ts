// The default HTML part of an alert mail: one column of at most 600 px with inline styles (mail clients drop
// stylesheets and CSS variables, so the design tokens cannot reach them and the colours below are literal), a
// severity badge, the title, the details, the repeats line and a link button. Every value is escaped.
import type { AlertDelivery } from "../channels.js";
import type { AlertMessage } from "../contract.js";

interface BadgeColours {
  readonly background: string;
  readonly text: string;
}

// Literal colours on purpose: see the file comment.
const BADGE_COLOURS: Readonly<Record<"info" | "warning" | "critical" | "resolved" | "test", BadgeColours>> = {
  info: { background: "#e0ecff", text: "#1d4ed8" },
  warning: { background: "#fff4d6", text: "#92400e" },
  critical: { background: "#fde2e2", text: "#b91c1c" },
  resolved: { background: "#dcfce7", text: "#15803d" },
  test: { background: "#ececec", text: "#404040" },
};
const TEXT_COLOUR = "#1f2937";
const MUTED_COLOUR = "#6b7280";
const BUTTON_COLOUR = "#111827";
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

/** One block of `details`: a paragraph, or a list whose items carry their indented sub-lines. */
export type AlertDetailsBlock =
  | { readonly kind: "paragraph"; readonly text: string }
  | { readonly kind: "list"; readonly items: readonly { readonly text: string; readonly lines: readonly string[] }[] };

/**
 * Reads the `details` line convention: a line starting with `- ` is a list item, the lines after it indented by a
 * space or a tab are its sub-lines, any other non-empty line is a paragraph. The text part keeps the raw details.
 */
export function parseAlertDetails(details: string): AlertDetailsBlock[] {
  const blocks: AlertDetailsBlock[] = [];
  let list: { text: string; lines: string[] }[] | null = null;
  for (const line of details.split(/\r?\n/)) {
    if (line.startsWith("- ")) {
      if (list === null) {
        list = [];
        blocks.push({ kind: "list", items: list });
      }
      list.push({ text: line.slice(2).trim(), lines: [] });
      continue;
    }
    const item = list?.at(-1);
    if (item !== undefined && /^[ \t]/.test(line) && line.trim() !== "") {
      item.lines.push(line.trim());
      continue;
    }
    list = null;
    if (line.trim() !== "") blocks.push({ kind: "paragraph", text: line.trim() });
  }
  return blocks;
}

/**
 * The default HTML part of `delivery`, built from its rendered `parts` (the app's copy). Undefined for a delivery
 * without parts (built by hand), which then goes out as text only.
 */
export function renderAlertMailHtml(delivery: AlertDelivery): string | undefined {
  const parts = delivery.parts;
  if (parts === undefined) return undefined;
  const colours = BADGE_COLOURS[getBadgeKind(delivery.message)];
  const body: string[] = [
    `<p style="margin:0 0 12px"><span style="display:inline-block;padding:2px 10px;border-radius:999px;background:${colours.background};color:${colours.text};font-size:12px;font-weight:600">${escapeHtml(parts.tag)}</span></p>`,
    `<h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;color:${TEXT_COLOUR}">${escapeHtml(parts.title)}</h1>`,
  ];
  if (parts.details !== null) body.push(...parseAlertDetails(parts.details).map(renderBlock));
  if (parts.repeats !== null) body.push(`<p style="margin:0 0 16px;font-size:14px;color:${MUTED_COLOUR}">${escapeHtml(parts.repeats)}</p>`);
  if (parts.link !== null) {
    body.push(
      `<p style="margin:8px 0 0"><a href="${escapeHtml(parts.link.url)}" style="display:inline-block;padding:10px 18px;border-radius:6px;background:${BUTTON_COLOUR};color:#ffffff;font-size:14px;font-weight:600;text-decoration:none">${escapeHtml(parts.link.label)}</a></p>`,
    );
  }
  return [
    "<!doctype html>",
    `<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(delivery.subject)}</title></head>`,
    `<body style="margin:0;padding:0;background:#ffffff">`,
    `<div style="max-width:600px;margin:0 auto;padding:24px 16px;font-family:${FONT};font-size:15px;line-height:1.5;color:${TEXT_COLOUR}">`,
    ...body,
    "</div></body></html>",
  ].join("\n");
}

function getBadgeKind(message: AlertMessage): keyof typeof BADGE_COLOURS {
  if (message.kind === "resolved" || message.kind === "test") return message.kind;
  return message.severity;
}

function renderBlock(block: AlertDetailsBlock): string {
  if (block.kind === "paragraph") return `<p style="margin:0 0 12px">${escapeHtml(block.text)}</p>`;
  const items = block.items.map((item) => {
    const lines = item.lines.map((line) => `<br><span style="color:${MUTED_COLOUR};font-size:14px">${escapeHtml(line)}</span>`).join("");
    return `<li style="margin:0 0 8px">${escapeHtml(item.text)}${lines}</li>`;
  });
  return `<ul style="margin:0 0 16px;padding-left:20px">${items.join("")}</ul>`;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
