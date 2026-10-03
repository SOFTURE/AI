// Where the signed-in account stands with @softure-ai/billing: the badge and the notice in one line
// each, a link to the plans, and a write the billing guard decides on (proxy.ts guards /account, requireUser checks the
// session).
import { requireUser } from "@softure-ai/auth/next";
import { CurrentAccessBadge, CurrentAccessNotice } from "@softure-ai/billing/next";
import { ButtonLink, Card } from "@softure-ai/ui";
import Link from "next/link";
import { getMessages } from "../../../messages/index.ts";
import config from "../../../softure.config.ts";
import { MemberEntryForm } from "./member-entry-form.tsx";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  await requireUser({ next: "/account/billing" });
  const messages = getMessages(config.locale);
  return (
    <main className="page">
      <Card title={messages.billing.title} subtitle={messages.billing.lead}>
        <div className="stack">
          <div>
            <CurrentAccessBadge />
          </div>
          <CurrentAccessNotice LinkComponent={Link} />
          <div>
            <ButtonLink href="/payment" variant="secondary" LinkComponent={Link}>
              {messages.billing.seePlans}
            </ButtonLink>
          </div>
          <MemberEntryForm locale={config.locale} />
        </div>
      </Card>
    </main>
  );
}
