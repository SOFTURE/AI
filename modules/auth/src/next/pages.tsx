// Pages ready to mount with one line: `export { LoginPage as default } from "@softure-ai/auth/next"`.
// Server components: they read the config and the session, and render the forms from `../ui`.
import { getSoftureConfig } from "@softure-ai/core/next";
import { Card } from "@softure-ai/ui";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { toSafeNextPath } from "../safe-next-path.js";
import { getAuthOptions, getAuthRoutes } from "../server/options.js";
import { isRegistrationClosed } from "../server/switches.js";
import { ChangePasswordForm, LoginForm, RegisterForm } from "../ui/auth-forms.js";
import { changePasswordAction, loginAction, registerAction } from "./actions.js";
import { getCurrentUser, requireUser } from "./current-user.js";
import { getAuthMessages } from "./messages.js";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export interface AuthPageProps {
  readonly searchParams?: SearchParams;
}

const LAYOUT_CLASS = "sft:mx-auto sft:box-border sft:w-full sft:sm:max-w-md sft:px-4 sft:py-4";

function AuthLayout({ title, lead, children }: { title: string; lead: string; children: ReactNode }) {
  return (
    <main className={LAYOUT_CLASS}>
      <Card title={title} subtitle={lead}>
        {children}
      </Card>
    </main>
  );
}

async function readNext(searchParams: SearchParams | undefined, fallback: string): Promise<string> {
  const value = (await searchParams)?.next;
  return toSafeNextPath(Array.isArray(value) ? value[0] : value, fallback);
}

export async function LoginPage({ searchParams }: AuthPageProps) {
  const config = getSoftureConfig();
  const routes = getAuthRoutes(config);
  const next = await readNext(searchParams, routes.afterLogin);
  if ((await getCurrentUser()) !== null) redirect(next);
  const messages = getAuthMessages(config);
  return (
    <AuthLayout title={messages.login.title} lead={messages.login.lead}>
      <LoginForm
        action={loginAction}
        messages={messages}
        locale={config.locale}
        next={next}
        registerHref={isRegistrationClosed(config) ? undefined : routes.register}
      />
    </AuthLayout>
  );
}

export async function RegisterPage({ searchParams }: AuthPageProps) {
  const config = getSoftureConfig();
  const routes = getAuthRoutes(config);
  const next = await readNext(searchParams, routes.afterLogin);
  if ((await getCurrentUser()) !== null) redirect(next);
  const messages = getAuthMessages(config);
  if (isRegistrationClosed(config)) {
    return (
      <AuthLayout title={messages.register.closedTitle} lead={messages.register.closedBody}>
        {null}
      </AuthLayout>
    );
  }
  const options = getAuthOptions(config);
  return (
    <AuthLayout title={messages.register.title} lead={messages.register.lead}>
      <RegisterForm
        action={registerAction}
        messages={messages}
        locale={config.locale}
        next={next}
        loginHref={routes.login}
        requireConsent={options.requireConsent}
        minPasswordLength={options.password.minLength}
      />
    </AuthLayout>
  );
}

export async function ChangePasswordPage() {
  const config = getSoftureConfig();
  const routes = getAuthRoutes(config);
  await requireUser({ next: routes.changePassword });
  const messages = getAuthMessages(config);
  return (
    <AuthLayout title={messages.changePassword.title} lead={messages.changePassword.lead}>
      <ChangePasswordForm
        action={changePasswordAction}
        messages={messages}
        locale={config.locale}
        minPasswordLength={getAuthOptions(config).password.minLength}
      />
    </AuthLayout>
  );
}
