import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "../lib/utils.js";

import type { TravelStatus } from "./status.js";

/** A card as a surface: `surface`, one `border` hairline, the card radius, 24 px inside; flat, with no shadows or gradients. */
export function Card({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <article data-slot="card" className={cn("grid gap-3 rounded-card border border-border bg-surface p-6 text-foreground", className)} {...props} />;
}

export interface PhotoProps extends HTMLAttributes<HTMLDivElement> {
  /** The image (an `<img>` fills the frame, cropped), or a placeholder text. */
  readonly children?: ReactNode;
}

/** A 4:3 photo frame inside a card, its radius smaller than the card's. */
export function Photo({ className, ...props }: PhotoProps) {
  return (
    <div
      data-slot="photo"
      className={cn(
        "grid aspect-4/3 max-w-full place-items-center overflow-hidden rounded-photo border border-border bg-map-ocean text-meta text-muted [&_img]:size-full [&_img]:object-cover",
        className,
      )}
      {...props}
    />
  );
}

export interface PostcardStampProps {
  /** The year, in the display face with numbers untracked. */
  readonly year: ReactNode;
  /** The country's ISO 3166-1 alpha-2 code, in mono capitals. */
  readonly code: string;
  readonly status?: TravelStatus;
  readonly className?: string;
}

/**
 * The postmark in a postcard's corner: a 76 px circle with a double ring (a border and an inset outline, flat)
 * in the stamp ink, turned by -8 degrees; a planned trip has dashed passport-blue rings. The card's only ornament.
 */
export function PostcardStamp({ year, code, status = "visited", className }: PostcardStampProps) {
  const isPlanned = status === "planned";
  return (
    <div
      data-slot="postcard-stamp"
      data-status={status}
      className={cn(
        "flex size-postmark shrink-0 -rotate-8 flex-col items-center justify-center gap-1.25 rounded-pill border-[1.5px] text-center font-mono text-postmark uppercase outline -outline-offset-7",
        isPlanned ? "border-dashed border-planned text-planned outline-dashed outline-planned" : "border-visited text-muted outline-visited",
        className,
      )}
    >
      <b className="num block font-display text-postmark-year font-normal text-foreground normal-case">{year}</b>
      {code}
    </div>
  );
}

export interface PostcardProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  /** The place as a sentence ("Three weeks in Lisbon"). */
  readonly title: ReactNode;
  /** Country, dates in words: one line, wrapping with a 2 px gap. */
  readonly meta?: readonly ReactNode[];
  /** A `Photo` above the text. */
  readonly photo?: ReactNode;
  /** A `PostcardStamp` in the top right corner, level with the title. */
  readonly stamp?: ReactNode;
  /** The title's heading level; `h3` by default. */
  readonly headingLevel?: "h2" | "h3" | "h4";
}

/** A trip as a postcard: a card with an optional photo, the title in the display face, the meta and a postmark. */
export function Postcard({ title, meta, photo, stamp, headingLevel = "h3", children, className, ...props }: PostcardProps) {
  const Heading = headingLevel;
  return (
    <Card data-slot="postcard" className={className} {...props}>
      {photo}
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
        <div className="grid min-w-0 content-start gap-1.5">
          <Heading className="m-0 font-display text-subsection">{title}</Heading>
          {meta === undefined || meta.length === 0 ? null : (
            <p className="m-0 flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 text-meta text-muted">
              {meta.map((item, index) => (
                // The entries are positional text with no identity of their own.
                <span key={index}>{item}</span>
              ))}
            </p>
          )}
        </div>
        {stamp}
      </div>
      {children}
    </Card>
  );
}
