import { Fragment, type ReactNode } from "react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "../ui/breadcrumb.js";
import { cn } from "../lib/utils.js";

export interface PageCrumb {
  label: string;
  // Absent on the current page, the last crumb.
  href?: string;
}

export interface PageHeaderProps {
  title: ReactNode;
  crumbs?: PageCrumb[];
  // The breadcrumb's accessible name in the app's language; the built-in English one when absent.
  crumbsLabel?: string;
  // A lucide icon, never an emoji.
  icon?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  // Content right under the title, before the description (a status line, a picker).
  children?: ReactNode;
  className?: string;
}

// The page's header, once per screen: breadcrumb, page icon, the 40 px title, what follows it, a description and actions.
export function PageHeader({ title, crumbs, crumbsLabel, icon, description, actions, children, className }: PageHeaderProps) {
  return (
    <header data-slot="page-header" className={cn("flex flex-col", className)}>
      {crumbs && crumbs.length > 0 ? (
        <Breadcrumb {...(crumbsLabel === undefined ? {} : { "aria-label": crumbsLabel })}>
          <BreadcrumbList>
            {crumbs.map((crumb, index) => (
              <Fragment key={`${index}-${crumb.label}`}>
                {index > 0 ? <BreadcrumbSeparator /> : null}
                <BreadcrumbItem>
                  {crumb.href === undefined ? (
                    <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink href={crumb.href}>{crumb.label}</BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      ) : null}
      {icon ? (
        <div className="mt-6 mb-2 flex size-14 items-center justify-center rounded-xl bg-secondary [&>svg]:size-8">{icon}</div>
      ) : null}
      <h1 className="text-page-title text-balance">{title}</h1>
      {children}
      {description ? <p className="mt-1 text-body text-muted-foreground">{description}</p> : null}
      {actions ? <div className="mt-3 flex flex-wrap gap-1">{actions}</div> : null}
    </header>
  );
}
