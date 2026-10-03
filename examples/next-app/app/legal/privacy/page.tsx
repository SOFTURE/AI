import { getMessages } from "../../../messages/index.ts";
import config from "../../../softure.config.ts";
import { LegalPage } from "../legal-page.tsx";

export default function PrivacyPolicyPage() {
  return <LegalPage documentId="privacy-policy" content={getMessages(config.locale).legal.privacy} />;
}
