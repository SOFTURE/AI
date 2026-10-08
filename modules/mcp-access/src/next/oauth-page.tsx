// The OAuth consent page, ready to mount with one line:
// `export { OAuthConsentPage as default } from "@softure-ai/mcp-access/next"`.
// The authorization endpoint clients send the person to. Without a session it redirects to the
// login page and back with every parameter (state, challenge, resource). Errors before the client
// and its redirect URI are confirmed are shown here, never redirected; later ones offer a link back
// to the client, never an automatic redirect (anyone can register a redirect URI).
import { requireUser } from "@softure-ai/auth/next";
import { formatMessage } from "@softure-ai/core";
import { getSoftureConfig } from "@softure-ai/core/next";
import { Card } from "@softure-ai/ui";
import { notFound } from "next/navigation";
import { getConsentPath, isOAuthEnabled, readAuthorizationParams, validateAuthorizationRequest } from "../server/oauth-http.js";
import { describeRedirectUri } from "../server/oauth-validation.js";
import { getMcpAccessMessages, getMcpAccessOptions, getMcpAccessRoutes } from "../server/options.js";
import { ConsentError, ConsentForm } from "../ui/consent-form.js";
import { getMcpAccessContext } from "./context.js";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export interface OAuthConsentPageProps {
  readonly searchParams?: SearchParams;
}

const LAYOUT_CLASS = "sft:mx-auto sft:box-border sft:w-full sft:sm:max-w-md sft:px-4 sft:py-4";

export async function OAuthConsentPage({ searchParams }: OAuthConsentPageProps) {
  const config = getSoftureConfig();
  if (!isOAuthEnabled(config)) notFound();
  const query = (await searchParams) ?? {};
  const params = readAuthorizationParams({ get: (name: string) => query[name] });
  const user = await requireUser({ next: getConsentPath(config, params), searchParams: query });

  const messages = getMcpAccessMessages(config);
  const outcome = await validateAuthorizationRequest(await getMcpAccessContext(config), params);
  if (outcome.kind !== "valid") {
    const message =
      outcome.kind === "redirect-error" ? messages.consent.invalidRequest : outcome.reason === "unknown_client" ? messages.consent.unknownClient : messages.consent.redirectMismatch;
    return (
      <main className={LAYOUT_CLASS}>
        <Card title={messages.consent.errorTitle}>
          <ConsentError
            message={message}
            {...(outcome.kind === "redirect-error" ? { backLocation: outcome.location, backTarget: describeRedirectUri(outcome.redirectUri) } : {})}
            messages={messages}
          />
        </Card>
      </main>
    );
  }

  const { client, redirectUri, isWriteRequested } = outcome.request;
  return (
    <main className={LAYOUT_CLASS}>
      <Card title={formatMessage(messages.consent.title, { client: client.clientName })} subtitle={messages.consent.lead}>
        <ConsentForm
          action={getMcpAccessRoutes(config).oauthDecision}
          params={[...params.entries()]}
          clientName={client.clientName}
          redirectTarget={describeRedirectUri(redirectUri)}
          accountEmail={user.email}
          isWriteOffered={isWriteRequested && getMcpAccessOptions(config).allowWrites}
          messages={messages}
        />
      </Card>
    </main>
  );
}
