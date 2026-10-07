// The privacy forms and the legal document shell, to compose into the app's own pages. The form
// takes the server action from `@softure-ai/privacy/next` as a prop: no `next/*` import here
// (docs/02-module-standard.md §5).
export {
  DeleteAccountForm,
  type DeleteAccountAction,
  type DeleteAccountFormProps,
  type DeleteAccountFormSlot,
} from "./delete-account-form.js";
export {
  formatLegalDate,
  LegalDocument,
  LegalSection,
  type LegalChange,
  type LegalContentsTitleElement,
  type LegalDocumentMeta,
  type LegalDocumentProps,
  type LegalDocumentSlot,
  type LegalSectionContent,
  type LegalSectionProps,
  type LegalSectionSlot,
} from "./legal-document.js";
export {
  LegalFooter,
  type LegalFooterElement,
  type LegalFooterLink,
  type LegalFooterProps,
  type LegalFooterSlot,
} from "./legal-footer.js";
