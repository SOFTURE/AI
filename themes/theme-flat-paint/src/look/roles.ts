/** The design system's data roles: available capital, money locked until an age, debt and errors. */
export type DataRole = "accessible" | "locked" | "debt";

/** The tone names `@softure-ai/ui` components take (`Card accent`, `Stat tone`). */
export type UiTone = "success" | "warning" | "danger";

/**
 * Each data role as the `@softure-ai/ui` tone that paints it: `sft-bridge.css` points the ui tones at these roles
 * (`--sft-color-success` is `accessible`), so a component given the tone draws in the role's colour.
 */
export const ROLE_TONE: Readonly<Record<DataRole, UiTone>> = {
  accessible: "success",
  locked: "warning",
  debt: "danger",
};
