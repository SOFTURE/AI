// The privacy page, ready to mount with one line:
// `export { PrivacyPage as default } from "@softure-ai/privacy/next"` in app/account/privacy/page.tsx.
// A server component: without a session it redirects to the login page and back.
import { requireUser } from "@softure-ai/auth/next";
import { getSoftureConfig } from "@softure-ai/core/next";
import { ButtonLink, Card } from "@softure-ai/ui";
import { getPrivacyRoutes } from "../server/options.js";
import { DeleteAccountForm } from "../ui/delete-account-form.js";
import { deleteAccountAction } from "./actions.js";
import { getPrivacyMessages } from "./messages.js";

const LAYOUT_CLASS = "sft:mx-auto sft:box-border sft:flex sft:w-full sft:flex-col sft:gap-4 sft:sm:max-w-md sft:px-4 sft:py-4";
const DESCRIPTION_CLASS = "sft:m-0 sft:text-sm sft:text-muted";
const SECTION_CLASS = "sft:flex sft:flex-col sft:gap-3";

export async function PrivacyPage() {
  const config = getSoftureConfig();
  const routes = getPrivacyRoutes(config);
  await requireUser({ next: routes.account });
  const messages = getPrivacyMessages(config);
  return (
    <main className={LAYOUT_CLASS}>
      <Card title={messages.page.title} subtitle={messages.page.lead} variant="lead">
        <div className={SECTION_CLASS}>
          <p className={DESCRIPTION_CLASS}>{messages.export.description}</p>
          <ButtonLink href={routes.export} download variant="secondary">
            {messages.export.button}
          </ButtonLink>
        </div>
      </Card>
      <Card title={messages.delete.title}>
        <DeleteAccountForm action={deleteAccountAction} messages={messages} locale={config.locale} />
      </Card>
    </main>
  );
}
