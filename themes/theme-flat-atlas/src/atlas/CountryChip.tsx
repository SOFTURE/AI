import { cn } from "../lib/utils.js";

import type { TravelStatus } from "./status.js";

export interface CountryChipProps {
  /** ISO 3166-1 alpha-2 code, shown in capitals in the mono face; never a flag emoji. */
  readonly code: string;
  /** The country's name in the site's language. */
  readonly name: string;
  readonly status?: TravelStatus;
  readonly className?: string;
}

/** A country label: the ISO code on the stamp ink and the name; a planned one in a dashed passport-blue outline. */
export function CountryChip({ code, name, status = "visited", className }: CountryChipProps) {
  const isPlanned = status === "planned";
  return (
    <span
      data-slot="country-chip"
      data-status={status}
      className={cn(
        "inline-flex h-chip items-center gap-2.5 rounded-pill border border-border bg-surface pr-3.5 pl-1 text-label text-foreground",
        isPlanned && "border-dashed border-planned",
        className,
      )}
    >
      <span
        className={cn(
          "inline-flex h-chip-code min-w-9 items-center justify-center rounded-pill px-2 font-mono text-iso-sm uppercase",
          isPlanned ? "border border-planned bg-transparent text-planned" : "bg-accent-fill text-on-accent",
        )}
      >
        {code}
      </span>
      {name}
    </span>
  );
}
