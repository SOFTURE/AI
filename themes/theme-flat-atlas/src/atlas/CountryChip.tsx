import type { ReactNode } from "react";

import { cn } from "../lib/utils.js";

import type { TravelStatus } from "./status.js";

export interface CountryChipProps {
  /** ISO 3166-1 alpha-2 code, shown in capitals in the mono face when there is no flag; never a flag emoji. */
  readonly code: string;
  /** The country's name in the site's language. */
  readonly name: string;
  readonly status?: TravelStatus;
  /**
   * The country's flag as an image (an `<img>` or an inline SVG, 4:3 or 3:2), shown instead of the ISO code. The chip
   * gives it a rounded frame; the flag is decorative, the name carries the meaning.
   */
  readonly flag?: ReactNode;
  readonly className?: string;
}

/**
 * A country label: the flag (or the ISO code on the stamp ink) and the name; a planned one in a dashed passport-blue
 * outline.
 */
export function CountryChip({ code, name, status = "visited", flag, className }: CountryChipProps) {
  const isPlanned = status === "planned";
  return (
    <span
      data-slot="country-chip"
      data-status={status}
      className={cn(
        "inline-flex h-chip items-center gap-2.5 rounded-pill border border-border bg-surface pr-3.5 pl-1 text-label text-foreground",
        flag !== undefined && "pl-2",
        isPlanned && "border-dashed border-planned",
        className,
      )}
    >
      {flag === undefined ? (
        <span
          className={cn(
            "inline-flex h-chip-code min-w-9 items-center justify-center rounded-pill px-2 font-mono text-iso-sm uppercase",
            isPlanned ? "border border-planned bg-transparent text-planned" : "bg-accent-fill text-on-accent",
          )}
        >
          {code}
        </span>
      ) : (
        <span
          aria-hidden="true"
          data-slot="country-chip-flag"
          className="inline-flex h-4 w-6 shrink-0 overflow-hidden rounded-[3px] outline outline-1 -outline-offset-1 outline-foreground/15 [&>*]:size-full [&>img]:object-cover"
        >
          {flag}
        </span>
      )}
      {name}
    </span>
  );
}
