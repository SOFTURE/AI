// Pages ready to mount with one line: `export { LoginPage as default } from "@softure-ai/auth/next"`.
// Server components: they read the config and the session, and render the forms from `../ui`.
import type { SoftureConfig } from "@softure-ai/core";
import { getSoftureConfig } from "@softure-ai/core/next";
import { Card } from "@softure-ai/ui";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { resolveRedirectTarget } from "../redirect-target.js";
import { toSafeNextPath } from "../safe-next-path.js";
import { getAuthOptions, getAuthRoutes } from "../server/options.js";
import { findPasswordResetUser, isPasswordResetEnabled, RESET_TOKEN_PARAM } from "../server/password-reset.js";
import { isRegistrationClosed } from "../server/switches.js";
import { ChangePasswordForm, ForgotPasswordForm, LoginForm, RegisterForm, ResetPasswordForm } from "../ui/auth-forms.js";
import { changePasswordAction, forgotPasswordAction, loginAction, registerAction, resetPasswordAction } from "./actions.js";
import { getAuthContext } from "./context.js";
import { getCurrentUser, requireUser } from "./current-user.js";
import { getAuthMessages } from "./messages.js";
import { PASSWORD_RESET_DONE_PARAM } from "./params.js";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export interface AuthPageProps {
  readonly searchParams?: SearchParams;
}

const LAYOUT_CLASS = "sft:mx-auto sft:box-border sft:w-full sft:sm:max-w-md sft:px-4 sft:py-4";
const FOOTER_CLASS = "sft:m-0 sft:text-sm sft:text-muted";
const LINK_CLASS = "sft:font-medium sft:text-accent";

function AuthLayout({ title, lead, children }: { title: string; lead: string; children: ReactNode }) {
  return (
    <main className={LAYOUT_CLASS}>
      <Card title={title} subtitle={lead}>
        {children}
      </Card>
    </main>
  );
}

async function readParam(searchParams: SearchParams | undefined, name: string): Promise<string | undefined> {
  const value = (await searchParams)?.[name];
  return Array.isArray(value) ? value[0] : value;
}

async function readNext(searchParams: SearchParams | undefined, fallback: string): Promise<string> {
  return toSafeNextPath(await readParam(searchParams, "next"), fallback);
}

/** The page's own query, every value of a repeated name kept, for the app's redirect rewrite. */
async function readSearchParams(searchParams: SearchParams | undefined): Promise<URLSearchParams> {
  const query = new URLSearchParams();
  for (const [name, value] of Object.entries((await searchParams) ?? {})) {
    for (const item of Array.isArray(value) ? value : [value]) if (item !== undefined) query.append(name, item);
  }
  return query;
}

/** Sends a signed-in visitor on from the login or register page, through the app's redirect rewrite. */
async function redirectSignedIn(config: SoftureConfig, next: string, searchParams: SearchParams | undefined): Promise<never> {
  redirect(await resolveRedirectTarget(config, next, await readSearchParams(searchParams)));
}

export async function LoginPage({ searchParams }: AuthPageProps) {
  const config = getSoftureConfig();
  const routes = getAuthRoutes(config);
  const next = await readNext(searchParams, routes.afterLogin);
  if ((await getCurrentUser()) !== null) await redirectSignedIn(config, next, searchParams);
  const messages = getAuthMessages(config);
  const isClosed = await isRegistrationClosed(await getAuthContext(config));
  return (
    <AuthLayout title={messages.login.title} lead={messages.login.lead}>
      <LoginForm
        action={loginAction}
        messages={messages}
        locale={config.locale}
        next={next}
        registerHref={isClosed ? undefined : routes.register}
        forgotPasswordHref={isPasswordResetEnabled(config) ? routes.forgotPassword : undefined}
        notice={(await readParam(searchParams, PASSWORD_RESET_DONE_PARAM)) === "1" ? messages.resetPassword.success : undefined}
      />
    </AuthLayout>
  );
}

export async function RegisterPage({ searchParams }: AuthPageProps) {
  const config = getSoftureConfig();
  const routes = getAuthRoutes(config);
  const next = await readNext(searchParams, routes.afterLogin);
  if ((await getCurrentUser()) !== null) await redirectSignedIn(config, next, searchParams);
  const messages = getAuthMessages(config);
  if (await isRegistrationClosed(await getAuthContext(config))) {
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

/** Asks for a reset link. Not found when the app configured no sender. */
export function ForgotPasswordPage() {
  const config = getSoftureConfig();
  if (!isPasswordResetEnabled(config)) notFound();
  const messages = getAuthMessages(config);
  return (
    <AuthLayout title={messages.forgotPassword.title} lead={messages.forgotPassword.lead}>
      <ForgotPasswordForm
        action={forgotPasswordAction}
        messages={messages}
        locale={config.locale}
        ttlMinutes={getAuthOptions(config).passwordReset.ttlMinutes}
        loginHref={getAuthRoutes(config).login}
      />
    </AuthLayout>
  );
}

/**
 * The page a reset link opens. It only checks the token (mail scanners open links too); the form
 * submission consumes it. Its referrer policy is `same-origin`: the token in its URL never goes to
 * another site, and the form still sends the Origin header Next checks on server actions
 * (`no-referrer` would turn it into `null`, and Next would refuse the plain HTML form).
 */
export async function ResetPasswordPage({ searchParams }: AuthPageProps) {
  const config = getSoftureConfig();
  if (!isPasswordResetEnabled(config)) notFound();
  const routes = getAuthRoutes(config);
  const messages = getAuthMessages(config);
  const token = (await readParam(searchParams, RESET_TOKEN_PARAM)) ?? "";
  const user = token === "" ? null : await findPasswordResetUser(await getAuthContext(config), token);
  const referrerPolicy = <meta name="referrer" content="same-origin" />;
  if (user === null) {
    return (
      <AuthLayout title={messages.resetPassword.invalidTitle} lead={messages.resetPassword.invalidBody}>
        {referrerPolicy}
        <p className={FOOTER_CLASS}>
          <a href={routes.forgotPassword} className={LINK_CLASS}>
            {messages.resetPassword.requestNew}
          </a>
        </p>
      </AuthLayout>
    );
  }
  return (
    <AuthLayout title={messages.resetPassword.title} lead={messages.resetPassword.lead}>
      {referrerPolicy}
      <ResetPasswordForm
        action={resetPasswordAction}
        messages={messages}
        locale={config.locale}
        token={token}
        minPasswordLength={getAuthOptions(config).password.minLength}
      />
    </AuthLayout>
  );
}
