// Result types and error codes of the feature-switches module. No user-facing copy here: the UI
// translates codes through `messages` (docs/02-module-standard.md §6).
import type { CoreErrorCode } from "@softure-ai/core";

export type FeatureSwitchesErrorCode = "feature-switches.unknown_switch";

/** Every code the panel can show: its own, the role refusal and the generic ones. */
export type SwitchFormErrorCode = FeatureSwitchesErrorCode | "auth.forbidden" | CoreErrorCode;

/** Where a switch's current value comes from. */
export type SwitchSource =
  /** Its environment override. */
  | "env"
  /** The value an admin stored. */
  | "stored"
  /** The declared default: nothing is stored. */
  | "default"
  /** The fail mode: the stored state or the override could not be read. */
  | "fail-mode";

/** A declared switch as the panel shows it. */
export interface SwitchView {
  readonly name: string;
  readonly label: string;
  readonly description: string | null;
  readonly isEnabled: boolean;
  readonly source: SwitchSource;
  /** The variable that overrides it; set or not. */
  readonly envName: string;
  readonly updatedAt: Date | null;
  readonly updatedBy: string | null;
}

/** What the panel's server action returns to one switch's form (`useActionState`). */
export interface SwitchFormState {
  readonly status: "idle" | "ok" | "error";
  /** The value the switch shows after the submit: the new one, or the old one after a refusal. */
  readonly isEnabled: boolean;
  readonly error?: SwitchFormErrorCode;
}
