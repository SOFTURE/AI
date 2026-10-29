// A logout button for the app's own pages: `LogoutForm` posting to `logoutAction`, so it works without JavaScript.
// Server component. `next` rides along as a hidden field. To clear the device before the sign-out, render
// `LogoutForm` of `@softure-ai/auth/ui` with `beforeSignOut` from a client component instead.
import { getSoftureConfig } from "@softure-ai/core/next";
import type { ButtonVariant } from "@softure-ai/ui";
import { LogoutForm } from "../ui/logout-form.js";
import { logoutAction } from "./actions.js";
import { getAuthMessages } from "./messages.js";

export interface LogoutButtonProps {
  readonly variant?: ButtonVariant;
  readonly className?: string;
  /** Where to go after logout (a path on this app), e.g. `/login?next=…`; default `afterLogout`. */
  readonly next?: string;
}

export function LogoutButton({ variant = "secondary", className, next }: LogoutButtonProps) {
  return <LogoutForm action={logoutAction} messages={getAuthMessages(getSoftureConfig())} next={next} variant={variant} className={className} />;
}
