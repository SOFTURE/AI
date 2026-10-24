import type { ReactNode } from "react";

import { Field, FieldGroup, FieldLabel } from "../ui/field.js";
import { cn } from "../lib/utils.js";

export interface Property {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
}

export interface PropertyListProps {
  items: Property[];
  className?: string;
}

// Properties as in a Notion database page: a 160 px label with its type icon, then the value.
export function PropertyList({ items, className }: PropertyListProps) {
  return (
    <FieldGroup data-slot="property-list" className={cn("gap-0.5", className)}>
      {items.map((item) => (
        <Field
          key={item.label}
          orientation="horizontal"
          className="min-h-row-height items-center gap-0 [&>[data-slot=field-label]]:flex-none"
        >
          <FieldLabel className="w-40 flex-none gap-1.5 px-1.5 font-normal text-muted-foreground [&>svg]:size-4">
            {item.icon}
            {item.label}
          </FieldLabel>
          <div className="flex min-h-row-height min-w-0 flex-1 flex-wrap items-center gap-1 rounded-xs px-2 hover:bg-accent">
            {item.value}
          </div>
        </Field>
      ))}
    </FieldGroup>
  );
}
