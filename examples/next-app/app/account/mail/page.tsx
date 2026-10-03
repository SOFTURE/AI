// Sends a test mail to the signed-in user (proxy.ts guards /account, requireUser checks the session).
import { requireUser } from "@softure-ai/auth/next";
import { Card } from "@softure-ai/ui";
import { getMessages } from "../../../messages/index.ts";
import config from "../../../softure.config.ts";
import { TestMailForm } from "./test-mail-form.tsx";

export const dynamic = "force-dynamic";

export default async function TestMailPage() {
  await requireUser({ next: "/account/mail" });
  const messages = getMessages(config.locale);
  return (
    <main className="page">
      <Card title={messages.mail.title} subtitle={messages.mail.lead}>
        <TestMailForm locale={config.locale} />
      </Card>
    </main>
  );
}
