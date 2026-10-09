// The frame of every blog page: crumbs, the title with its lead, an optional line under it (dates),
// then the content. Links are plain anchors: the pages render on the server and need no client router.
// An app's `context.layout` renders the frame instead, with the same parts.
import { formatMessage } from "@softure-ai/core";
import type { ReactNode } from "react";
import type { Crumb } from "../pages/listing.js";
import { getBlogSlotClass } from "./class-names.js";
import type { BlogPageContext } from "./page-context.js";

export interface BlogLayoutProps {
  readonly context: BlogPageContext;
  readonly title: string;
  readonly lead?: string;
  /** Crumbs up to the page itself; the last one is announced, not shown. */
  readonly crumbs?: readonly Crumb[];
  /** Under the title: dates, reading time. */
  readonly meta?: ReactNode;
  readonly children: ReactNode;
}

export function Breadcrumbs({ crumbs, label, context }: { readonly crumbs: readonly Crumb[]; readonly label: string; readonly context?: Pick<BlogPageContext, "classNames" | "unstyled"> }) {
  const cls = getBlogSlotClass(context ?? {});
  return (
    <nav aria-label={label} className={cls("crumbs")}>
      <ol>
        {crumbs.map((crumb, index) =>
          index === crumbs.length - 1 ? (
            <li key={crumb.path} className={cls("visuallyHidden")} aria-current="page">
              {crumb.name}
            </li>
          ) : (
            <li key={crumb.path}>
              <a href={crumb.path}>{crumb.name}</a>
              <span aria-hidden="true" className={cls("crumbsSeparator")}>
                {"›"}
              </span>
            </li>
          ),
        )}
      </ol>
    </nav>
  );
}

export function BlogLayout({ context, title, lead, crumbs, meta, children }: BlogLayoutProps) {
  if (context.layout !== undefined) {
    const AppLayout = context.layout;
    return (
      <AppLayout context={context} title={title} lead={lead} crumbs={crumbs} meta={meta}>
        {children}
      </AppLayout>
    );
  }
  const cls = getBlogSlotClass(context);
  return (
    <main className={cls("page")}>
      <header className={cls("header")}>
        {crumbs !== undefined && crumbs.length > 1 ? <Breadcrumbs crumbs={crumbs} label={context.messages.pages.breadcrumbs} context={context} /> : null}
        <h1 className={cls("title")}>{title}</h1>
        {lead === undefined ? null : <p className={cls("lead")}>{lead}</p>}
        {meta}
      </header>
      {children}
    </main>
  );
}

/** The signature and the method link under a text, then the disclaimer. */
export function BlogFooterNote({ context, extraLink }: { readonly context: BlogPageContext; readonly extraLink?: { readonly href: string; readonly label: string } }) {
  const copy = context.messages.pages;
  const links = [
    ...(extraLink === undefined ? [] : [extraLink]),
    ...(context.methodPath === null ? [] : [{ href: context.methodPath, label: copy.methodLink }]),
  ];
  const hasSignature = context.brand !== null;
  const cls = getBlogSlotClass(context);
  return (
    <footer className={cls("footerNote")}>
      {hasSignature || links.length > 0 ? (
        <p className={cls("signature")}>
          {context.brand === null ? null : <strong>{formatMessage(copy.signature, { brand: context.brand })}</strong>}
          {links.map((link, index) => (
            <span key={link.href}>
              {hasSignature || index > 0 ? <span aria-hidden="true">{" · "}</span> : null}
              <a href={link.href}>{link.label}</a>
            </span>
          ))}
        </p>
      ) : null}
      {context.disclaimer === null || context.disclaimer === undefined ? null : (
        <aside aria-label={copy.disclaimerLabel} className={cls("disclaimer")}>
          {typeof context.disclaimer === "string" ? <p>{context.disclaimer}</p> : context.disclaimer}
        </aside>
      )}
    </footer>
  );
}

/** Structured data for search engines and assistants; `json` comes from `serializeJsonLd`. */
export function JsonLdScript({ json }: { readonly json: string }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
