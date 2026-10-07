// A logout button for the app's own pages: a plain form posting to `logoutAction`, so it works
// without JavaScript. Server component. `next` rides along as a hidden field.
import { getSoftureConfig } from "@softure-ai/core/next";
import { Button, type ButtonVariant } from "@softure-ai/ui";
import { logoutAction } from "./actions.js";
import { getAuthMessages } from "./messages.js";

export interface LogoutButtonProps {
  readonly variant?: ButtonVariant;
  readonly className?: string;
  /** Where to go after logout (a path on this app), e.g. `/login?next=…`; default `afterLogout`. */
  readonly next?: string;
}

export function LogoutButton({ variant = "secondary", className, next }: LogoutButtonProps) {
  const messages = getAuthMessages(getSoftureConfig());
  return (
    <form action={logoutAction} className={className}>
      {next === undefined ? null : <input type="hidden" name="next" value={next} />}
      <Button type="submit" variant={variant}>
        {messages.logout.submit}
      </Button>
    </form>
  );
}
