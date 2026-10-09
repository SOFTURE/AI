// The unsubscribe page, ready to mount with one line:
// `export { UnsubscribePage as default } from "@softure-ai/mailing/next"`.
// A server component without client JavaScript: the button is a plain form posting a server
// action, so it works in any browser a mail client opens. Opening the page changes nothing (mail
// scanners open links too) and does not check the signature: the submit does. It takes the
// module's signed links and, with `mailing({ legacyUnsubscribe })`, the app's older ones: mount it
// at the old links' path too.
import { getSoftureConfig } from "@softure-ai/core/next";
import { Button, Card, createSlotClassGetter, FormError, type ClassNames } from "@softure-ai/ui";
import type { ComponentType, ReactNode } from "react";
import { getUnsubscribeLinkParams, readUnsubscribeLink } from "../server/unsubscribe-link.js";
import { unsubscribeAction } from "./actions.js";
import { getMailingMessages } from "./messages.js";
import { UNSUBSCRIBE_STATUS_PARAM } from "./params.js";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export interface UnsubscribePageProps {
  readonly searchParams?: SearchParams;
}

/** The page's parts an app can style: the `main` wrapper, the card, the form and the submit button. */
export type UnsubscribePageSlot = "root" | "card" | "form" | "submit";

/** What a custom layout receives: the page's copy, and the form (none on the outcome pages). */
export interface UnsubscribeLayoutProps {
  readonly title: string;
  readonly lead: string;
  readonly children?: ReactNode;
}

export interface UnsubscribePageOptions {
  /** Classes per slot, added to the defaults (or alone with `unstyled`). */
  readonly classNames?: ClassNames<UnsubscribePageSlot>;
  readonly unstyled?: boolean;
  /**
   * Replaces the `main` wrapper and the card, e.g. with the app's header and footer around the copy; the `root` and
   * `card` classes then do not apply. The form inside stays the module's.
   */
  readonly Layout?: ComponentType<UnsubscribeLayoutProps>;
}

const DEFAULT_CLASSES: Readonly<Record<UnsubscribePageSlot, string>> = {
  root: "sft:mx-auto sft:box-border sft:w-full sft:sm:max-w-md sft:px-4 sft:py-4",
  card: "",
  form: "sft:flex sft:flex-col sft:gap-3 sft:font-sans",
  submit: "",
};

function readParam(params: Record<string, string | string[] | undefined>, name: string): string | undefined {
  const value = params[name];
  return Array.isArray(value) ? value[0] : value;
}

type SlotClass = (slot: UnsubscribePageSlot) => string | undefined;

/**
 * The link's token stays out of other sites' Referer headers; `same-origin` (not `no-referrer`)
 * keeps the Origin header Next checks on server actions. The tag is rendered whatever the layout.
 */
function UnsubscribeLayout({ title, lead, children, slot, options }: UnsubscribeLayoutProps & { readonly slot: SlotClass; readonly options: UnsubscribePageOptions }) {
  const { Layout } = options;
  if (Layout !== undefined) {
    return (
      <>
        <meta name="referrer" content="same-origin" />
        <Layout title={title} lead={lead}>
          {children}
        </Layout>
      </>
    );
  }
  const card = slot("card");
  return (
    <main className={slot("root")}>
      <meta name="referrer" content="same-origin" />
      <Card title={title} subtitle={lead} unstyled={options.unstyled} {...(card === undefined ? {} : { classNames: { root: card } })}>
        {children}
      </Card>
    </main>
  );
}

/**
 * The unsubscribe page with the app's classes or layout:
 * `export default createUnsubscribePage({ classNames: { root: "app-narrow" }, Layout: AppShell })`.
 */
export function createUnsubscribePage(options: UnsubscribePageOptions = {}) {
  return async function UnsubscribePageWithOptions({ searchParams }: UnsubscribePageProps) {
    return renderUnsubscribePage(searchParams, options);
  };
}

export async function UnsubscribePage({ searchParams }: UnsubscribePageProps) {
  return renderUnsubscribePage(searchParams, {});
}

async function renderUnsubscribePage(searchParams: SearchParams | undefined, options: UnsubscribePageOptions) {
  const config = getSoftureConfig();
  const messages = getMailingMessages(config).unsubscribe;
  const slot = createSlotClassGetter({ defaults: DEFAULT_CLASSES, classNames: options.classNames, unstyled: options.unstyled });
  const params = (await searchParams) ?? {};
  const status = readParam(params, UNSUBSCRIBE_STATUS_PARAM);
  if (status === "done") return <UnsubscribeLayout title={messages.doneTitle} lead={messages.doneBody} slot={slot} options={options} />;

  const link = readUnsubscribeLink({ get: (name) => readParam(params, name) ?? null }, config);
  const linkParams = link === null ? {} : getUnsubscribeLinkParams(link);
  if (status === "invalid" || link === null || Object.values(linkParams).some((value) => value === "")) {
    return <UnsubscribeLayout title={messages.invalidTitle} lead={messages.invalidBody} slot={slot} options={options} />;
  }
  const submit = slot("submit");
  return (
    <UnsubscribeLayout title={messages.title} lead={messages.lead} slot={slot} options={options}>
      <form action={unsubscribeAction} className={slot("form")}>
        {Object.entries(linkParams).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        <FormError message={status === "failed" ? messages.failed : undefined} unstyled={options.unstyled} />
        <div>
          <Button type="submit" variant="primary" unstyled={options.unstyled} {...(submit === undefined ? {} : { classNames: { root: submit } })}>
            {messages.submit}
          </Button>
        </div>
      </form>
    </UnsubscribeLayout>
  );
}
