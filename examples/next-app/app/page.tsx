import { isEnabled } from "@softure-ai/feature-switches/next";
import { Card, EmptyState, FormError, ThemeSwitch } from "@softure-ai/ui";
import { getDatabase } from "../lib/database.ts";
import { getErrorMessage, getMessages } from "../messages/index.ts";
import { findAppliedMigrations, findEntries } from "../modules/guestbook/queries.ts";
import config, { WELCOME_BANNER_SWITCH } from "../softure.config.ts";
import { AddEntry } from "./add-entry.tsx";

// Reads the database on every request.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const messages = getMessages(config.locale);
  const { db } = await getDatabase();
  const [entries, migrations, hasWelcomeBanner] = await Promise.all([
    findEntries(db),
    findAppliedMigrations(db),
    isEnabled(WELCOME_BANNER_SWITCH),
  ]);

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <h1 className="page-title">{messages.home.title}</h1>
          <p className="page-lead">{messages.home.lead}</p>
          {hasWelcomeBanner ? (
            <p className="page-lead" data-testid="welcome-banner">
              {messages.home.welcomeBanner}
            </p>
          ) : null}
        </div>
        <ThemeSwitch locale={config.locale} />
      </header>

      <Card title={messages.guestbook.title} subtitle={messages.guestbook.subtitle} action={<AddEntry locale={config.locale} />}>
        {!entries.ok ? (
          <FormError message={getErrorMessage(messages, entries.error)} />
        ) : entries.value.length === 0 ? (
          <EmptyState title={messages.guestbook.empty}>{messages.guestbook.emptyBody}</EmptyState>
        ) : (
          <ul className="plain-list" data-testid="guestbook-entries">
            {entries.value.map((entry) => (
              <li key={entry.id}>{entry.message}</li>
            ))}
          </ul>
        )}
      </Card>

      <Card title={messages.migrations.title} subtitle={messages.migrations.subtitle}>
        {!migrations.ok ? (
          <FormError message={getErrorMessage(messages, migrations.error)} />
        ) : migrations.value.length === 0 ? (
          <EmptyState title={messages.migrations.empty} />
        ) : (
          <ul className="plain-list" data-testid="applied-migrations">
            {migrations.value.map((migration) => (
              <li key={`${migration.module}-${migration.version}`}>
                <code>{`${migration.module} ${migration.version} ${migration.name} (${migration.method})`}</code>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </main>
  );
}
