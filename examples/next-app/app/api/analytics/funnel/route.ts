// GET (pixel) and POST (beacon) /api/analytics/funnel: the funnel endpoint of @softure-ai/analytics.
import { createFunnelRoute } from "@softure-ai/analytics/next";

export const { GET, POST } = createFunnelRoute();
