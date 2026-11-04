// A plain module (no "use client"), so a Server Component can call the formatter (issue #1005).
const SIZE_UNITS = ["kilobyte", "megabyte", "gigabyte", "terabyte"] as const;

/** A file size for people, in decimal steps (1 kB = 1000 bytes), written by the locale: `formatFileSize(1500)` is "1.5 kB". Safe on the server. */
export function formatFileSize(bytes: number, locale = "en"): string {
  const size = Number.isFinite(bytes) ? Math.max(0, bytes) : 0;
  // Bytes in full ("820 bytes"): the short form of the unit is the bare word "byte" in English.
  if (size < 1000) return new Intl.NumberFormat(locale, { style: "unit", unit: "byte", unitDisplay: "long" }).format(Math.round(size));
  let value = size / 1000;
  let unit = 0;
  while (value >= 1000 && unit < SIZE_UNITS.length - 1) {
    value /= 1000;
    unit += 1;
  }
  return new Intl.NumberFormat(locale, { style: "unit", unit: SIZE_UNITS[unit], unitDisplay: "short", maximumFractionDigits: 1 }).format(value);
}
