// An app-owned private page: proxy.ts keeps visitors without a session cookie out, and
// requireUser checks the session itself before anything renders.
import { LogoutButton, requireUser } from "@softure-ai/auth/next";
import { ButtonLink, Card } from "@softure-ai/ui";
import { getMessages } from "../../messages/index.ts";
import config from "../../softure.config.ts";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await requireUser({ next: "/account" });
  const messages = getMessages(config.locale);
  return (
    <main className="page">
      <Card title={messages.account.title} subtitle={messages.account.lead}>
        <p data-testid="account-email">{user.email}</p>
        <div className="actions-row">
          <ButtonLink href="/account/password" variant="secondary">
            {messages.account.changePassword}
          </ButtonLink>
          <LogoutButton />
        </div>
      </Card>
    </main>
  );
}
