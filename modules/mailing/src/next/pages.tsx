// The unsubscribe page, ready to mount with one line:
// `export { UnsubscribePage as default } from "@softure-ai/mailing/next"`.
// A server component without client JavaScript: the button is a plain form posting a server
// action, so it works in any browser a mail client opens. Opening the page changes nothing (mail
// scanners open links too) and does not check the signature: the submit does. It takes the
// module's signed links and, with `mailing({ legacyUnsubscribe })`, the app's older ones: mount it
// at the old links' path too.
import { getSoftureConfig } from "@softure-ai/core/next";
import { Button, Card, FormError } from "@softure-ai/ui";
import type { ReactNode } from "react";
import { getUnsubscribeLinkParams, readUnsubscribeLink } from "../server/unsubscribe-link.js";
import { unsubscribeAction } from "./actions.js";
import { getMailingMessages } from "./messages.js";
import { UNSUBSCRIBE_STATUS_PARAM } from "./params.js";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export interface UnsubscribePageProps {
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
function UnsubscribeLayout({ title, lead, children }: { title: string; lead: string; children?: ReactNode }) {
  return (
    <main className={LAYOUT_CLASS}>
      <meta name="referrer" content="same-origin" />
      <Card title={title} subtitle={lead}>
        {children}
      </Card>
    </main>
  );
}

export async function UnsubscribePage({ searchParams }: UnsubscribePageProps) {
  const config = getSoftureConfig();
  const messages = getMailingMessages(config).unsubscribe;
  const params = (await searchParams) ?? {};
  const status = readParam(params, UNSUBSCRIBE_STATUS_PARAM);
  if (status === "done") return <UnsubscribeLayout title={messages.doneTitle} lead={messages.doneBody} />;

  const link = readUnsubscribeLink({ get: (name) => readParam(params, name) ?? null }, config);
  const linkParams = link === null ? {} : getUnsubscribeLinkParams(link);
  if (status === "invalid" || link === null || Object.values(linkParams).some((value) => value === "")) {
    return <UnsubscribeLayout title={messages.invalidTitle} lead={messages.invalidBody} />;
  }
  return (
    <UnsubscribeLayout title={messages.title} lead={messages.lead}>
      <form action={unsubscribeAction} className={FORM_CLASS}>
        {Object.entries(linkParams).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        <FormError message={status === "failed" ? messages.failed : undefined} />
        <div>
          <Button type="submit" variant="primary">
            {messages.submit}
          </Button>
        </div>
      </form>
    </UnsubscribeLayout>
  );
}
