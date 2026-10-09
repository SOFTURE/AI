// What the blog's components get besides their own data, built from the config alone: the copy, the
// paths, the brand, the disclaimer and the AI disclosure. No request scope and no Next import, so the
// ready-made pages and any other renderer build it the same way.
import type { SoftureConfig } from "@softure-ai/core";
import type { BlogPageContext } from "../ui/page-context.js";
import { getBlogMessages, getBlogOptions, getBlogRoutes } from "./options.js";

export function getPageContext(config: SoftureConfig): BlogPageContext {
  const options = getBlogOptions(config);
  const routes = getBlogRoutes(config);
  return {
    messages: getBlogMessages(config),
    locale: config.locale,
    routes,
    methodPath: options.methodPage ? routes.method : null,
    brand: options.brand?.name ?? null,
    disclaimer: options.disclaimer === undefined ? null : (options.disclaimer[config.locale] ?? options.disclaimer.en),
    clusterAnchorPrefix: options.anchors.cluster,
    aiDisclosure: options.aiDisclosure,
  };
}
