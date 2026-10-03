import { getMessages } from "../../../messages/index.ts";
import config from "../../../softure.config.ts";
import { LegalPage } from "../legal-page.tsx";

export default function TermsPage() {
  return <LegalPage documentId="terms" content={getMessages(config.locale).legal.terms} />;
}
