// The double opt-in confirmation page, ready to mount with one line:
// `export { ConfirmSignupPage as default } from "@softure-ai/waitlist/next"`.
// A server component without client JavaScript: the button is a plain form posting a server
// action, so it works in any browser a mail client opens. Opening the page changes nothing (mail
// scanners open links too) and does not look the token up: the submit does.
import { getSoftureConfig } from "@softure-ai/core/next";
import { Button, Card, FormError } from "@softure-ai/ui";
import type { ReactNode } from "react";
import { CONFIRMATION_TOKEN_PARAM } from "../server/confirmation-mail.js";
import { getWaitlistMessages } from "../server/options.js";
import { confirmSignupAction } from "./actions.js";
import { CONFIRM_STATUS_PARAM } from "./params.js";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export interface ConfirmSignupPageProps {
  readonly searchParams?: SearchParams;
}

const LAYOUT_CLASS = "sft:mx-auto sft:box-border sft:w-full sft:sm:max-w-md sft:px-4 sft:py-4";
const FORM_CLASS = "sft:flex sft:flex-col sft:gap-3 sft:font-sans";

function readParam(params: Record<string, string | string[] | undefined>, name: string): string | undefined {
  const value = params[name];
  return Array.isArray(value) ? value[0] : value;
}

/**
 * The link's token stays out of other sites' Referer headers; `same-origin` (not `no-referrer`)
 * keeps the Origin header Next checks on server actions.
 */
function ConfirmLayout({ title, lead, children }: { title: string; lead: string; children?: ReactNode }) {
  return (
    <main className={LAYOUT_CLASS}>
      <meta name="referrer" content="same-origin" />
      <Card title={title} subtitle={lead}>
        {children}
      </Card>
    </main>
  );
}

export async function ConfirmSignupPage({ searchParams }: ConfirmSignupPageProps) {
  const messages = getWaitlistMessages(getSoftureConfig()).confirm;
  const params = (await searchParams) ?? {};
  const status = readParam(params, CONFIRM_STATUS_PARAM);
  if (status === "done") return <ConfirmLayout title={messages.doneTitle} lead={messages.doneBody} />;
  if (status === "expired") return <ConfirmLayout title={messages.expiredTitle} lead={messages.expiredBody} />;

  const token = readParam(params, CONFIRMATION_TOKEN_PARAM) ?? "";
  if (status === "invalid" || token === "") return <ConfirmLayout title={messages.invalidTitle} lead={messages.invalidBody} />;
  const error = status === "failed" ? messages.failed : status === "limited" ? messages.limited : undefined;
  return (
    <ConfirmLayout title={messages.title} lead={messages.lead}>
      <form action={confirmSignupAction} className={FORM_CLASS}>
        <input type="hidden" name={CONFIRMATION_TOKEN_PARAM} value={token} />
        <FormError message={error} />
        <div>
          <Button type="submit" variant="primary">
            {messages.submit}
          </Button>
        </div>
      </form>
    </ConfirmLayout>
  );
}
