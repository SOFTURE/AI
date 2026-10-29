"use client";

import { errorLogLabel } from "@softure-ai/core";
import { Button, type ButtonVariant } from "@softure-ai/ui";
import { type FormEvent, useEffect, useRef, useState } from "react";
import type { AuthMessages } from "../messages/index.js";

// The sign-out control: a plain form posting to the logout action (`logoutAction` of `@softure-ai/auth/next`), so it
// works without JavaScript. With `beforeSignOut`, the first submit is held while the app clears what the device keeps
// (e.g. `clearDeviceData` of `@softure-ai/pwa`); then the form is submitted again and the action runs, whatever
// `beforeSignOut` did.

export interface LogoutFormProps {
  readonly action: (formData: FormData) => void | Promise<void>;
  readonly messages: AuthMessages;
  /** Where to go after logout (a path on this app), e.g. `/login?next=…`; checked again on the server. */
  readonly next?: string;
  /** Awaited before the sign-out. A throw or rejection is logged by its kind only, and the sign-out goes on. */
  readonly beforeSignOut?: () => unknown;
  readonly variant?: ButtonVariant;
  readonly className?: string;
}

async function runBeforeSignOut(beforeSignOut: () => unknown): Promise<void> {
  try {
    await beforeSignOut();
  } catch (error) {
    // The kind only: a message could carry the user's data, and the sign-out must not wait for a fix.
    console.error(`@softure-ai/auth: before sign-out failed: ${errorLogLabel(error)}`);
  }
}

type LogoutStage = "idle" | "holding" | "submitting";

export function LogoutForm({ action, messages, next, beforeSignOut, variant = "secondary", className }: LogoutFormProps) {
  const [stage, setStage] = useState<LogoutStage>("idle");
  const formRef = useRef<HTMLFormElement>(null);
  const isClearedRef = useRef(false);

  // Submitted again once the button is enabled, with the button as the submitter, as a click would.
  useEffect(() => {
    const form = formRef.current;
    if (stage !== "submitting" || form === null) return;
    isClearedRef.current = true;
    setStage("idle");
    form.requestSubmit(form.querySelector<HTMLButtonElement>('button[type="submit"]'));
  }, [stage]);

  function holdForBeforeSignOut(event: FormEvent<HTMLFormElement>): void {
    if (beforeSignOut === undefined) return;
    if (isClearedRef.current) {
      // The second submit goes through; a later one runs beforeSignOut again.
      isClearedRef.current = false;
      return;
    }
    // A prevented submit does not run the form's action; the second submit does.
    event.preventDefault();
    if (stage !== "idle") return;
    setStage("holding");
    void runBeforeSignOut(beforeSignOut).then(() => setStage("submitting"));
  }

  return (
    <form ref={formRef} action={action} onSubmit={holdForBeforeSignOut} className={className}>
      {next === undefined ? null : <input type="hidden" name="next" value={next} />}
      <Button type="submit" variant={variant} pending={stage === "holding"}>
        {messages.logout.submit}
      </Button>
    </form>
  );
}
