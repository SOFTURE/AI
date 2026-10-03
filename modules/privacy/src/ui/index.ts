// The privacy forms, to compose into the app's own page. They take the server action from
// `@softure-ai/privacy/next` as a prop: no `next/*` import here (docs/02-module-standard.md §5).
export {
  DeleteAccountForm,
  type DeleteAccountAction,
  type DeleteAccountFormProps,
  type DeleteAccountFormSlot,
} from "./delete-account-form.js";
