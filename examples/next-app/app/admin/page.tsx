// An admin-only page: requireRole answers "not found" to anyone without the admin role, signed in
// or not. The proxy guard does not cover it, so an anonymous visitor is not sent to the login page.
import { ADMIN_ROLE } from "@softure-ai/auth";
import { requireRole } from "@softure-ai/auth/next";
import { ButtonLink, Card } from "@softure-ai/ui";
import { BILLING_ADMIN_PATH } from "../../lib/invoice-requests.ts";
import { getMessages } from "../../messages/index.ts";
import config from "../../softure.config.ts";
import { AnnounceForm } from "./announce-form.tsx";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireRole(ADMIN_ROLE);
  const messages = getMessages(config.locale);
  return (
    <main className="page">
      <Card title={messages.admin.title} subtitle={messages.admin.lead}>
        <div className="stack">
          <AnnounceForm locale={config.locale} />
          <div>
            <ButtonLink href={BILLING_ADMIN_PATH} variant="secondary">
              {messages.admin.grantPlans}
            </ButtonLink>
          </div>
        </div>
      </Card>
    </main>
  );
}
