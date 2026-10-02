// An admin-only page: requireRole answers "not found" to anyone without the admin role, signed in
// or not. The proxy guard does not cover it, so an anonymous visitor is not sent to the login page.
import { ADMIN_ROLE } from "@softure-ai/auth";
import { requireRole } from "@softure-ai/auth/next";
import { Card } from "@softure-ai/ui";
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
        <AnnounceForm locale={config.locale} />
      </Card>
    </main>
  );
}
