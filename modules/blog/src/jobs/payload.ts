// The payload of a `blog.indexnow` job: the changed paths, not URLs, so the worker builds the canonical
// URLs from the config it runs with.
import { z } from "zod";

/** seo's IndexNow takes at most this many URLs per request. */
const MAX_PATHS = 10_000;

export const blogIndexNowPayloadSchema = z.strictObject({
  paths: z.array(z.string().startsWith("/").max(2048)).min(1).max(MAX_PATHS),
});

export type BlogIndexNowPayload = z.output<typeof blogIndexNowPayloadSchema>;
