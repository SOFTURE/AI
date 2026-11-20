// Pages ready to mount with one line: `export { LoginPage as default } from "@softure-ai/auth/next"`.
// Server components: they read the config and the session, and render the forms from `../ui`.
import { formatMessage, type SoftureConfig } from "@softure-ai/core";
import type { AuthFormErrorCode } from "../contract.js";
import { getSoftureConfig } from "@softure-ai/core/next";
import { Card } from "@softure-ai/ui";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { resolveRedirectTarget } from "../redirect-target.js";
import { toSafeNextPath } from "../safe-next-path.js";
import { getAuthOptions, getAuthRoutes } from "../server/options.js";
import { findPasswordResetUser, isPasswordResetEnabled, RESET_TOKEN_PARAM } from "../server/password-reset.js";
import { isRegistrationClosed } from "../server/switches.js";
import { findInvitation, INVITATION_TOKEN_PARAM, isInvitationEnabled, listInvitations, type InvitationView } from "../server/invitations.js";
import { getDeclaredRoles } from "../server/roles.js";
import { ADMIN_ROLE } from "../roles.js";
import { getAuthErrorMessage, getInvitationMessages, type AuthMessages } from "../messages/index.js";
import { getOidcProviders } from "../server/oidc/context.js";
import { ChangePasswordForm, ForgotPasswordForm, LoginForm, RegisterForm, ResetPasswordForm } from "../ui/auth-forms.js";
import { InvitationPanel, type InvitationPanelRow } from "../ui/invitation-panel.js";
import { OidcSignIn } from "../ui/oidc-sign-in.js";
import {
  changePasswordAction,
  forgotPasswordAction,
  inviteAction,
  loginAction,
  oidcSignInAction,
  registerAction,
  resendInvitationAction,
  resetPasswordAction,
  revokeInvitationAction,
} from "./actions.js";
import { getAuthContext } from "./context.js";
import { getCurrentUser, requireRole, requireUser } from "./current-user.js";
import { getAuthMessages } from "./messages.js";
import { INVITATION_NOTICE_PARAM, INVITATION_NOTICES, type InvitationNotice, OIDC_ERROR_PARAM, PASSWORD_RESET_DONE_PARAM } from "./params.js";
import { toUrlSearchParams } from "./search-params.js";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export interface AuthPageProps {
  readonly searchParams?: SearchParams;
}

const LAYOUT_CLASS = "sft:mx-auto sft:box-border sft:w-full sft:sm:max-w-md sft:px-4 sft:py-4";
const WIDE_LAYOUT_CLASS = "sft:mx-auto sft:box-border sft:w-full sft:sm:max-w-3xl sft:px-4 sft:py-4";
const FOOTER_CLASS = "sft:m-0 sft:text-sm sft:text-muted";
const LINK_CLASS = "sft:font-medium sft:text-accent";
/** An error code as auth writes it into `?oidc_error=`; anything else in the URL is not shown. */
const ERROR_CODE = /^[a-z]+\.[a-z_]{1,64}$/;
/** The server keeps 512 characters of a registration field; nothing longer is echoed into the page. */
const MAX_CARRIED_LENGTH = 512;

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

/** Sends a signed-in visitor on from the login or register page, through the app's redirect rewrite. */
async function redirectSignedIn(config: SoftureConfig, next: string, searchParams: SearchParams | undefined): Promise<never> {
  redirect(await resolveRedirectTarget(config, next, toUrlSearchParams(await searchParams)));
}

/**
 * The login page: the OpenID Connect buttons when the app configured providers, then the password form unless
 * `password.enabled` is false. A failed provider sign-in comes back here with `?oidc_error=`, shown above the buttons.
 */
export async function LoginPage({ searchParams }: AuthPageProps) {
  const config = getSoftureConfig();
  const routes = getAuthRoutes(config);
  const next = await readNext(searchParams, routes.afterLogin);
  if ((await getCurrentUser()) !== null) await redirectSignedIn(config, next, searchParams);
  const messages = getAuthMessages(config);
  const isPasswordOn = getAuthOptions(config).password.enabled;
  const providers = getOidcProviders(config).map((provider) => ({ id: provider.id, name: provider.name }));
  const oidcError = await readParam(searchParams, OIDC_ERROR_PARAM);
  const isClosed = await isRegistrationClosed(await getAuthContext(config));
  return (
    <AuthLayout title={messages.login.title} lead={messages.login.lead}>
      {providers.length === 0 ? null : (
        <OidcSignIn
          action={oidcSignInAction}
          providers={providers}
          messages={messages}
          next={next}
          error={oidcError !== undefined && ERROR_CODE.test(oidcError) ? getAuthErrorMessage(messages, oidcError as AuthFormErrorCode) : undefined}
          hasDivider={isPasswordOn}
        />
      )}
      {!isPasswordOn ? null : (
        <LoginForm
          action={loginAction}
          messages={messages}
          locale={config.locale}
          next={next}
          registerHref={isClosed ? undefined : routes.register}
          forgotPasswordHref={isPasswordResetEnabled(config) ? routes.forgotPassword : undefined}
          notice={(await readParam(searchParams, PASSWORD_RESET_DONE_PARAM)) === "1" ? messages.resetPassword.success : undefined}
        />
      )}
    </AuthLayout>
  );
}

export interface RegisterPageOptions {
  /** The consent statement, e.g. with links to the terms and the privacy policy. */
  readonly consentLabel?: ReactNode;
  /** The app's own inputs, before the consent checkbox (`auth({ registrationFields })` declares their names). */
  readonly extraFields?: ReactNode;
}

/**
 * A register page with the app's consent label and extra inputs:
 * `export default createRegisterPage({ consentLabel: <>I accept the <a href="/terms">terms</a></> })`.
 * A declared registration field present in the page's URL (`?z=…`) is carried as a hidden input.
 */
export function createRegisterPage(pageOptions: RegisterPageOptions = {}) {
  return async function RegisterPageWithOptions({ searchParams }: AuthPageProps) {
    return renderRegisterPage(searchParams, pageOptions);
  };
}

export async function RegisterPage({ searchParams }: AuthPageProps) {
  return renderRegisterPage(searchParams, {});
}

async function renderRegisterPage(searchParams: SearchParams | undefined, pageOptions: RegisterPageOptions) {
  const config = getSoftureConfig();
  const routes = getAuthRoutes(config);
  const next = await readNext(searchParams, routes.afterLogin);
  const invitationToken = await readParam(searchParams, INVITATION_TOKEN_PARAM);
  if (invitationToken !== undefined) return renderInvitationPage(config, invitationToken, next, pageOptions);
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
  const carried = await readCarriedFields(searchParams, options.registrationFields);
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
        consentLabel={pageOptions.consentLabel}
        extraFields={
          <>
            {carried.map(([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} />
            ))}
            {pageOptions.extraFields}
          </>
        }
      />
    </AuthLayout>
  );
}

/**
 * The register page opened from an invitation link: the form limited to the invited email, whether registration is
 * closed or not (and whoever is signed in: registering ends that session). It only checks the token (mail scanners open
 * links too); the submission consumes it. A dead link gets one neutral page that names no email. The referrer policy is
 * `same-origin`, as on the reset page, so the token never leaves for another site.
 */
async function renderInvitationPage(config: SoftureConfig, token: string, next: string, pageOptions: RegisterPageOptions) {
  const messages = getAuthMessages(config);
  const copy = getInvitationMessages(messages);
  const invitation = await findInvitation(await getAuthContext(config), token);
  const referrerPolicy = <meta name="referrer" content="same-origin" />;
  if (invitation === null) {
    return (
      <AuthLayout title={copy.invalidTitle} lead={copy.invalidBody}>
        {referrerPolicy}
      </AuthLayout>
    );
  }
  const options = getAuthOptions(config);
  return (
    <AuthLayout title={copy.acceptTitle} lead={formatMessage(copy.acceptLead, { email: invitation.email })}>
      {referrerPolicy}
      <RegisterForm
        action={registerAction}
        messages={messages}
        locale={config.locale}
        next={next}
        requireConsent={options.requireConsent}
        minPasswordLength={options.password.minLength}
        consentLabel={pageOptions.consentLabel}
        extraFields={pageOptions.extraFields}
        invitation={{ token, email: invitation.email }}
      />
    </AuthLayout>
  );
}

/** The declared registration fields present in the page's URL, carried into the form as hidden inputs. */
async function readCarriedFields(searchParams: SearchParams | undefined, declared: readonly string[]): Promise<[string, string][]> {
  const carried: [string, string][] = [];
  for (const name of declared) {
    const value = await readParam(searchParams, name);
    if (value !== undefined && value !== "") carried.push([name, value.slice(0, MAX_CARRIED_LENGTH)]);
  }
  return carried;
}

/** Not found when `password.enabled` is false: there is no password to change. */
export async function ChangePasswordPage() {
  const config = getSoftureConfig();
  if (!getAuthOptions(config).password.enabled) notFound();
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

/**
 * The admin page of invitations: invite an email with roles, list the sent ones, resend or revoke a pending one. Not
 * found for anyone without `admin` (signed in or not) and when the app passed no `invitations.send`.
 */
export async function InvitationsPage({ searchParams }: AuthPageProps) {
  const config = getSoftureConfig();
  await requireRole(ADMIN_ROLE);
  if (!isInvitationEnabled(config)) notFound();
  const messages = getAuthMessages(config);
  const copy = getInvitationMessages(messages);
  const views = await listInvitations(await getAuthContext(config));
  const notice = readInvitationNotice(await readParam(searchParams, INVITATION_NOTICE_PARAM));
  return (
    <main className={WIDE_LAYOUT_CLASS}>
      <Card title={copy.title} subtitle={copy.lead}>
        <InvitationPanel
          rows={views.map((view) => toInvitationRow(view, messages, config))}
          roles={[...getDeclaredRoles(config)]}
          inviteAction={inviteAction}
          resendAction={resendInvitationAction}
          revokeAction={revokeInvitationAction}
          messages={messages}
          notice={notice === undefined ? undefined : copy[notice]}
          locale={config.locale}
        />
      </Card>
    </main>
  );
}

function readInvitationNotice(value: string | undefined): InvitationNotice | undefined {
  return INVITATION_NOTICES.find((notice) => notice === value);
}

/** One invitation in the app's copy, its dates in the app's locale and time zone. */
export function toInvitationRow(view: InvitationView, messages: AuthMessages, config: SoftureConfig): InvitationPanelRow {
  const copy = getInvitationMessages(messages);
  const format = new Intl.DateTimeFormat(config.locale, { dateStyle: "medium", timeStyle: "short", timeZone: config.timezone });
  const date = (value: Date) => format.format(value);
  const details = [
    view.roles.length === 0 ? copy.noRoles : formatMessage(copy.rolesList, { roles: view.roles.join(", ") }),
    view.invitedBy === null
      ? formatMessage(copy.invitedOn, { date: date(view.createdAt) })
      : formatMessage(copy.invitedBy, { email: view.invitedBy.email, date: date(view.createdAt) }),
  ];
  if (view.status === "pending") details.push(formatMessage(copy.expiresOn, { date: date(view.expiresAt) }));
  if (view.acceptedAt !== null) details.push(formatMessage(copy.acceptedOn, { date: date(view.acceptedAt) }));
  if (view.revokedAt !== null) details.push(formatMessage(copy.revokedOn, { date: date(view.revokedAt) }));
  return {
    id: view.id,
    title: formatMessage(copy.itemTitle, { email: view.email, status: copy.status[view.status] }),
    details,
    isOpen: view.status === "pending" || view.status === "expired",
  };
}
