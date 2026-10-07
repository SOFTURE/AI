import { type ClassNames, createSlotClassGetter } from "./class-names.js";

// Server-safe.

export type FormErrorSlot = "root";

export interface FormErrorProps {
  /** The error to announce; nothing renders when it is empty. */
  readonly message?: string;
  readonly classNames?: ClassNames<FormErrorSlot>;
  readonly unstyled?: boolean;
}

const DEFAULT_CLASSES: Readonly<Record<FormErrorSlot, string>> = {
  root: "sft:m-0 sft:rounded-control sft:border sft:border-danger/50 sft:bg-danger/10 sft:px-3 sft:py-2 sft:font-sans sft:text-sm sft:text-foreground",
};

/** A form-level error, announced by `role="alert"` when it appears. */
export function FormError({ message, classNames, unstyled }: FormErrorProps) {
  if (message === undefined || message === "") return null;
  const slot = createSlotClassGetter({ defaults: DEFAULT_CLASSES, classNames, unstyled });
  return (
    <p role="alert" className={slot("root")}>
      {message}
    </p>
  );
}
