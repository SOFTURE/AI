"use server";

// The unsubscribe server action, for an app whose own form posts to it: it takes the signed link
// from the form body, records the opt-out and redirects to the page's outcome. The package page
// does not use it: a server action posts to the page's URL, which carries the link, so the page's
// form posts to the one-click route's bare path instead (route.ts). Next refuses an action whose
// Origin does not match the host.
import { getSoftureConfig } from "@softure-ai/core/next";
import { redirect } from "next/navigation";
import { readUnsubscribeLink } from "../server/unsubscribe-link.js";
import { getMailingContext } from "./context.js";
import { submitPageUnsubscribe } from "./page-submit.js";

export async function unsubscribeAction(formData: FormData): Promise<void> {
  const config = getSoftureConfig();
  const link = readUnsubscribeLink(formData, config);
  redirect(await submitPageUnsubscribe({ config, link, getContext: () => getMailingContext(config) }));
}
