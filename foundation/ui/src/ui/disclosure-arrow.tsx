// The disclosure arrow: a drawn chevron, turned 90° when open. Shared by `CardDisclosure` and
// `CollapsibleSection`, so a collapsed card and a collapsed section look the same. Server-safe.

export interface DisclosureArrowProps {
  readonly className: string | undefined;
}

/** The chevron of a disclosure; the caller passes the class with or without its open rotation. */
export function DisclosureArrow({ className }: DisclosureArrowProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}
