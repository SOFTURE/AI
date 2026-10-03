// An app-owned private page: proxy.ts keeps visitors without a session cookie out, and
// requireUser checks the session itself before anything renders. hasRole only decides whether the
// admin link shows; the admin page checks the role itself. "Your data" is a client-side link
// (next/link), so e2e/analytics-channel.spec.ts sees the channel tag survive a client navigation.
// Each view counts the funnel's `account` step with a beacon (e2e/analytics-funnel.spec.ts).
import { FunnelBeacon } from "@softure-ai/analytics/next";
import { ADMIN_ROLE } from "@softure-ai/auth";
import { hasRole, LogoutButton, requireUser } from "@softure-ai/auth/next";
import { ButtonLink, Card } from "@softure-ai/ui";
import Link from "next/link";
import { findSignupChannel } from "../../lib/signup-channels.ts";
import { getMessages } from "../../messages/index.ts";
import config from "../../softure.config.ts";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await requireUser({ next: "/account" });
  const isAdmin = await hasRole(ADMIN_ROLE);
  const messages = getMessages(config.locale);
  const signupChannel = findSignupChannel(user.id);
  return (
    <main className="page">
      <FunnelBeacon step="account" />
      <Card title={messages.account.title} subtitle={messages.account.lead}>
        <p data-testid="account-email">{user.email}</p>
        {signupChannel === null ? null : (
          <p data-testid="account-signup-channel">
            {messages.account.signupChannel} {signupChannel}
          </p>
        )}
        <div className="actions-row">
          <ButtonLink href="/account/password" variant="secondary">
            {messages.account.changePassword}
          </ButtonLink>
          <ButtonLink href="/account/privacy" variant="secondary" LinkComponent={Link}>
            {messages.account.privacy}
          </ButtonLink>
          <ButtonLink href="/account/billing" variant="secondary">
            {messages.account.billing}
          </ButtonLink>
          <ButtonLink href="/account/mcp" variant="secondary">
            {messages.account.assistant}
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
