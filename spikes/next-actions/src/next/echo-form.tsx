"use client";

import { useActionState } from "react";
import type { NextActionsMessages } from "../messages/index.js";
import type { EchoState } from "./echo.js";

export interface EchoFormProps {
  readonly action: (previous: EchoState | null, formData: FormData) => Promise<EchoState>;
  readonly messages: NextActionsMessages;
}

export function EchoForm({ action, messages }: EchoFormProps) {
  const [state, formAction, isPending] = useActionState(action, null);
  return (
    <form action={formAction}>
      <label>
        {messages.inputLabel}
        <input name="text" required />
      </label>
      <button type="submit" disabled={isPending}>
        {messages.submit}
      </button>
      {state === null ? null : (
        <output data-testid="echo">
          {messages.result}: {JSON.stringify(state)}
        </output>
      )}
    </form>
  );
}
