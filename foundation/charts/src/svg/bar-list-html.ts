// `BarList` as an HTML string, for a server renderer outside React (a blog body, a calculator's static markup). The
// markup is the component's, character for character (tests/adoption-gaps-321.test.tsx, tests/adoption-gaps-378.test.tsx),
// so styles.css applies alike.
import { type BarListProps, type BarListRow, getBarClass, getBarListClass, getBarListRows, getMissingTrackClass } from "./bar-list.js";

const ESCAPES: Readonly<Record<string, string>> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#x27;" };

/** Text or an attribute value made safe for HTML, the way React escapes them. */
function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (character) => ESCAPES[character] ?? character);
}

/** A `style` attribute from declarations, or nothing when there are none. */
function styleAttribute(declarations: readonly string[]): string {
  return declarations.length === 0 ? "" : ` style="${escapeHtml(declarations.join(";"))}"`;
}

function colourDeclarations(row: BarListRow): string[] {
  return row.color === undefined ? [] : [`--sft-chart-series:${row.color.trim()}`];
}

function trackHtml(row: BarListRow): string {
  if (row.missing) return `<span aria-hidden="true" class="${escapeHtml(getMissingTrackClass(row))}"${styleAttribute(colourDeclarations(row))}></span>`;
  const bar = `<span class="${escapeHtml(getBarClass(row))}"${styleAttribute([`width:${row.width}`, ...colourDeclarations(row)])}></span>`;
  return `<span aria-hidden="true" class="sft-chart-bar-track">${bar}</span>`;
}

/** The markup of `<BarList {...props} />`, escaped. */
export function renderBarListHtml({ items, max, layout, className }: BarListProps): string {
  const rows = getBarListRows(items, max === undefined ? {} : { max });
  const body = rows
    .map((row) =>
      [
        '<li class="sft-chart-bar-row">',
        `<span class="sft-chart-bar-label">${escapeHtml(row.label)}</span>`,
        trackHtml(row),
        `<span class="sft-chart-bar-value">${escapeHtml(row.valueLabel)}</span>`,
        row.description === undefined ? "" : `<span class="sft-chart-bar-description">${escapeHtml(row.description)}</span>`,
        "</li>",
      ].join(""),
    )
    .join("");
  return `<ul class="${escapeHtml(getBarListClass(layout, className))}">${body}</ul>`;
}
