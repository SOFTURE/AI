// The Next.js adapter: the request's channel for actions, hooks and pages, the funnel endpoint and
// the funnel steps for pages. `<ChannelKeeper />` has its own entry point, `/next/channel-keeper`.
export {
  attributeRegistration,
  countFunnelStep,
  countRegistration,
  getChannel,
  getChannelFromSearchParams,
  type RegisteredUserEvent,
  type RegistrationAttribution,
  type SearchParamsInput,
} from "./channel.js";
export { getAnalyticsContext } from "./context.js";
export { FunnelBeacon, FunnelPixel, type FunnelStepProps } from "./funnel.js";
export { createFunnelRoute, type FunnelRoute } from "./route.js";
