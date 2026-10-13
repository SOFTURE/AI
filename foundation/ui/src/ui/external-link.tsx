"use client";

import { useUiCopyProps } from "./locale.js";
import { type ExternalLinkProps, ServerExternalLink } from "./server-external-link.js";

// `ServerExternalLink` with the locale and copy of the nearest `UiLocaleProvider` (a provider reaches client
// components only). Its props, slots and `getExternalRel` live in the server-safe module.

/** A link that opens in a new tab and says so to assistive technology. */
export function ExternalLink({ locale, messages, ...props }: ExternalLinkProps) {
  return <ServerExternalLink {...props} {...useUiCopyProps("externalLink", { locale, messages })} />;
}
