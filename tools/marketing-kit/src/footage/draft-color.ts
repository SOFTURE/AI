/**
 * A hex colour (`#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`) as an ASS colour, `&HAABBGGRR&`-style without the closing
 * `&`: ASS writes blue first and counts alpha the other way round (00 is opaque).
 */
export function toAssColor(hex: string): string {
  const digits = hex.replace(/^#/, "");
  const full = digits.length <= 4 ? [...digits].map((digit) => digit + digit).join("") : digits;
  if (!/^(?:[0-9a-f]{6}|[0-9a-f]{8})$/i.test(full)) throw new Error(`Not a hex colour: "${hex}".`);
  const pair = (index: number): string => full.slice(index, index + 2).toUpperCase();
  const alpha = full.length === 8 ? (255 - parseInt(full.slice(6, 8), 16)).toString(16).padStart(2, "0").toUpperCase() : "00";
  return `&H${alpha}${pair(4)}${pair(2)}${pair(0)}`;
}
