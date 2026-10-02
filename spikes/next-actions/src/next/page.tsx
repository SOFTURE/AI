import { getSoftureConfig } from "@softure-ai/core/next";
import { nextActionsMessages } from "../messages/index.js";
import { echoAction } from "./actions.js";
import { EchoForm } from "./echo-form.js";

/** A server component page shipped in the package: `export { NextActionsPage as default }`. */
export function NextActionsPage() {
  const messages = nextActionsMessages[getSoftureConfig().locale];
  return (
    <main>
      <h1>{messages.title}</h1>
      <EchoForm action={echoAction.bind(null, "page")} messages={messages} />
    </main>
  );
}
