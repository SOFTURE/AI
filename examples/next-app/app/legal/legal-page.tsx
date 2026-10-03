// A legal page of the example: the text is the app's (messages/), the version comes from
// privacy({ documents }) in softure.config.ts, and @softure-ai/privacy renders the shell.
import { getPrivacyMessages } from "@softure-ai/privacy/next";
import { getLegalDocument } from "@softure-ai/privacy/server";
import { LegalDocument } from "@softure-ai/privacy/ui";
import type { AppMessages } from "../../messages/index.ts";
import config from "../../softure.config.ts";

type LegalContent = AppMessages["legal"]["terms"];

export function LegalPage({ documentId, content }: { readonly documentId: string; readonly content: LegalContent }) {
  const document = getLegalDocument(config, documentId);
  // The current version took effect on the date of its history entry; the newest entry is first.
  const effectiveFrom = content.changes.find((change) => change.version === document.version)?.date ?? document.version;
  return (
    <main>
      <LegalDocument
        title={content.title}
        version={document.version}
        effectiveFrom={effectiveFrom}
        intro={<p>{content.intro}</p>}
        sections={content.sections.map((section) => ({ id: section.id, title: section.title, content: <p>{section.body}</p> }))}
        changes={content.changes}
        messages={getPrivacyMessages(config)}
        locale={config.locale}
      />
    </main>
  );
}
