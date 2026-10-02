// A logout button for the app's own pages: a plain form posting to `logoutAction`, so it works
// without JavaScript. Server component.
import { getSoftureConfig } from "@softure-ai/core/next";
import { Button, type ButtonVariant } from "@softure-ai/ui";
import { logoutAction } from "./actions.js";
import { getAuthMessages } from "./messages.js";

export interface LogoutButtonProps {
  readonly variant?: ButtonVariant;
  readonly className?: string;
}

export function LogoutButton({ variant = "secondary", className }: LogoutButtonProps) {
  const messages = getAuthMessages(getSoftureConfig());
  return (
    <form action={logoutAction} className={className}>
      <Button type="submit" variant={variant}>
        {messages.logout.submit}
      </Button>
    </form>
  );
}
