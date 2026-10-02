// The auth forms, to compose into the app's own pages. They take the server actions from
// `@softure-ai/auth/next` as props: no `next/*` import here (docs/02-module-standard.md §5).
export {
  type AuthFormAction,
  type AuthFormSlot,
  ChangePasswordForm,
  type ChangePasswordFormProps,
  LoginForm,
  type LoginFormProps,
  RegisterForm,
  type RegisterFormProps,
} from "./auth-forms.js";
