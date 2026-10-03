// An app-owned private page: proxy.ts keeps visitors without a session cookie out, and
// requireUser checks the session itself before anything renders. hasRole only decides whether the
// admin link shows; the admin page checks the role itself.
import { ADMIN_ROLE } from "@softure-ai/auth";
import { hasRole, LogoutButton, requireUser } from "@softure-ai/auth/next";
import { ButtonLink, Card } from "@softure-ai/ui";
import { getMessages } from "../../messages/index.ts";
import config from "../../softure.config.ts";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await requireUser({ next: "/account" });
  const isAdmin = await hasRole(ADMIN_ROLE);
  const messages = getMessages(config.locale);
  return (
    <main className="page">
      <Card title={messages.account.title} subtitle={messages.account.lead}>
        <p data-testid="account-email">{user.email}</p>
        <div className="actions-row">
          <ButtonLink href="/account/password" variant="secondary">
            {messages.account.changePassword}
          </ButtonLink>
          <ButtonLink href="/account/mail" variant="secondary">
            {messages.account.testMail}
          </ButtonLink>
          {isAdmin ? (
            <ButtonLink href="/admin" variant="secondary">
              {messages.account.admin}
            </ButtonLink>
          ) : null}
          <LogoutButton />
        </div>
      </Card>
    </main>
  );
}
