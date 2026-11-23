// A logout button for the app's own pages: `LogoutForm` posting to `logoutAction`, so it works without JavaScript.
// Server component. `next` rides along as a hidden field. To clear the device before the sign-out, render
// `LogoutForm` of `@softure-ai/auth/ui` with `beforeSignOut` from a client component instead.
import { getSoftureConfig } from "@softure-ai/core/next";
import type { ButtonSize, ButtonVariant, ClassNames } from "@softure-ai/ui";
import type { ReactNode } from "react";
import { LogoutForm, type LogoutFormSlot } from "../ui/logout-form.js";
import { logoutAction } from "./actions.js";
import { getAuthMessages } from "./messages.js";

export interface LogoutButtonProps {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  /** The button fills the form's width, e.g. a row in a sidebar footer. */
  readonly fullWidth?: boolean;
  /** Decorative icon before the label. */
  readonly iconLeft?: ReactNode;
  /** The button keeps its structure and busy state only; the app styles it through `classNames.button`. */
  readonly unstyled?: boolean;
  /** Classes of the form and of the button; app classes win over the button's defaults. */
  readonly classNames?: ClassNames<LogoutFormSlot>;
  /** The form's class; joins `classNames.form`. */
  readonly className?: string;
  /** Where to go after logout (a path on this app), e.g. `/login?next=…`; default `afterLogout`. */
  readonly next?: string;
}

export function LogoutButton({ variant = "secondary", next, ...look }: LogoutButtonProps) {
  return <LogoutForm action={logoutAction} messages={getAuthMessages(getSoftureConfig())} next={next} variant={variant} {...look} />;
}
