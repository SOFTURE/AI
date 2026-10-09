// `BarList` as an HTML string, for a server renderer outside React (a blog body, a calculator's static markup). The
// markup is the component's, character for character (tests/adoption-gaps-321.test.tsx), so styles.css applies alike.
import { type BarListProps, getBarClass, getBarListRows } from "./bar-list.js";
import { cx } from "./class-names.js";

const ESCAPES: Readonly<Record<string, string>> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#x27;" };

/** Text or an attribute value made safe for HTML, the way React escapes them. */
function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (character) => ESCAPES[character] ?? character);
}

/** The markup of `<BarList {...props} />`, escaped. */
export function renderBarListHtml({ items, max, className }: BarListProps): string {
  const rows = getBarListRows(items, max === undefined ? {} : { max });
  const body = rows
    .map((row) => {
      const style = [`width:${row.width}`, ...(row.color === undefined ? [] : [`--sft-chart-series:${row.color.trim()}`])].join(";");
      return [
        '<li class="sft-chart-bar-row">',
        `<span class="sft-chart-bar-label">${escapeHtml(row.label)}</span>`,
        `<span aria-hidden="true" class="sft-chart-bar-track"><span class="${escapeHtml(getBarClass(row))}" style="${escapeHtml(style)}"></span></span>`,
        `<span class="sft-chart-bar-value">${escapeHtml(row.valueLabel)}</span>`,
        "</li>",
      ].join("");
    })
    .join("");
  return `<ul class="${escapeHtml(cx("sft-chart-bar-list", className))}">${body}</ul>`;
}
